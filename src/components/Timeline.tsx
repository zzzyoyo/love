'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export interface TimelineEvent {
  id: string;
  media_url: string;
  media_type: 'video' | 'image';
  content: string;
  event_date: string;
  created_at: string;
}

interface TimelineProps {
  newEvent?: TimelineEvent | null;
}

const PAGE_SIZE = 10;
const THUMB_HEIGHT = 224;
const THUMB_CENTER_GAP = THUMB_HEIGHT / 2;

export default function Timeline({ newEvent }: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authError, setAuthError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [monthOptions, setMonthOptions] = useState<
    { year: number; month: number; label: string }[]
  >([]);
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('');

  const resolveSignedUrl = async (rawUrl: string) => {
    if (!rawUrl) return '';

    let filePath = rawUrl;
    if (rawUrl.startsWith('http')) {
      const publicPrefix = '/storage/v1/object/public/love-media/';
      const signedPrefix = '/storage/v1/object/sign/love-media/';
      const publicIndex = rawUrl.indexOf(publicPrefix);
      const signedIndex = rawUrl.indexOf(signedPrefix);

      if (publicIndex !== -1) {
        filePath = rawUrl.slice(publicIndex + publicPrefix.length);
      } else if (signedIndex !== -1) {
        filePath = rawUrl.slice(signedIndex + signedPrefix.length);
        const queryIndex = filePath.indexOf('?');
        if (queryIndex !== -1) {
          filePath = filePath.slice(0, queryIndex);
        }
      } else {
        return rawUrl;
      }
    }

    const { data, error } = await supabase.storage
      .from('love-media')
      .createSignedUrl(filePath, 60 * 60);

    if (error) {
      console.error('Error creating signed url:', error);
      return '';
    }

    return data.signedUrl;
  };

  const buildSignedUrl = async (rawUrl: string) => {
    if (!rawUrl) return { signedUrl: '', filePath: '' };

    let filePath = rawUrl;
    if (rawUrl.startsWith('http')) {
      const publicPrefix = '/storage/v1/object/public/love-media/';
      const signedPrefix = '/storage/v1/object/sign/love-media/';
      const publicIndex = rawUrl.indexOf(publicPrefix);
      const signedIndex = rawUrl.indexOf(signedPrefix);

      if (publicIndex !== -1) {
        filePath = rawUrl.slice(publicIndex + publicPrefix.length);
      } else if (signedIndex !== -1) {
        filePath = rawUrl.slice(signedIndex + signedPrefix.length);
        const queryIndex = filePath.indexOf('?');
        if (queryIndex !== -1) {
          filePath = filePath.slice(0, queryIndex);
        }
      }
    }

    const { data, error } = await supabase.storage
      .from('love-media')
      .createSignedUrl(filePath, 60 * 60);

    if (error) {
      console.error('Error creating signed url:', error);
      return { signedUrl: '', filePath };
    }

    return { signedUrl: data.signedUrl, filePath };
  };

  const sortByEventDateAsc = (list: TimelineEvent[]) =>
    [...list].sort(
      (a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );

  const buildMonthOptions = (start: Date, end: Date) => {
    const options: { year: number; month: number; label: string }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= last) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth() + 1;
      options.push({
        year,
        month,
        label: `${year}年${String(month).padStart(2, '0')}月`,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return options;
  };

  const fetchBounds = async () => {
    const { data: minData, error: minError } = await supabase
      .from('timeline_events')
      .select('event_date')
      .order('event_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: maxData, error: maxError } = await supabase
      .from('timeline_events')
      .select('event_date')
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (minError || maxError || !minData?.event_date || !maxData?.event_date) {
      setMonthOptions([]);
      return;
    }

    const start = new Date(minData.event_date);
    const end = new Date(maxData.event_date);
    setMonthOptions(buildMonthOptions(start, end));
  };

  const fetchPage = async (pageIndex: number, replace = false) => {
    try {
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setAuthError('');
      setInfoMessage('');

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setAuthError('请先解锁后查看回忆');
        setEvents([]);
        return;
      }

      const startIndex = pageIndex * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('timeline_events')
        .select('*', { count: 'exact' })
        .order('event_date', { ascending: true })
        .range(startIndex, endIndex);

      if (error) {
        console.error('Error fetching events:', error);
        setAuthError('暂时无法获取回忆，请稍后再试');
      } else if (data) {
        const signedEvents = await Promise.all(
          (data as TimelineEvent[]).map(async (event) => {
            if (!event.media_url) return event;
            const signedUrl = await resolveSignedUrl(event.media_url);
            return {
              ...event,
              media_url: signedUrl || event.media_url,
            };
          })
        );

        setTotalCount(count ?? totalCount);
        setHasMore(
          count !== null
            ? (pageIndex + 1) * PAGE_SIZE < count
            : (signedEvents as TimelineEvent[]).length === PAGE_SIZE
        );
        setPage(pageIndex);
        setEvents((prev) => {
          const merged = replace ? signedEvents : [...prev, ...signedEvents];
          const unique = new Map<string, TimelineEvent>();
          merged.forEach((event) => unique.set(event.id, event));
          return sortByEventDateAsc(Array.from(unique.values()));
        });
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPage(0, true);
    fetchBounds();
  }, []);

  useEffect(() => {
    if (!newEvent) return;
    setEvents((prev) => {
      if (prev.some((event) => event.id === newEvent.id)) {
        return prev;
      }
      return sortByEventDateAsc([newEvent, ...prev]);
    });
  }, [newEvent]);

  const years = useMemo(
    () => Array.from(new Set(monthOptions.map((item) => item.year))),
    [monthOptions]
  );

  const monthsForYear = useMemo(() => {
    if (!selectedYear) return [];
    return monthOptions
      .filter((item) => item.year === selectedYear)
      .map((item) => item.month);
  }, [monthOptions, selectedYear]);

  const handleJumpToMonth = async (year: number, month: number) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { count: monthCount } = await supabase
      .from('timeline_events')
      .select('id', { count: 'exact', head: true })
      .gte('event_date', startDate)
      .lt('event_date', endDate);

    if (!monthCount) {
      setInfoMessage('该月份暂无记录');
      return;
    }

    const { count: beforeCount } = await supabase
      .from('timeline_events')
      .select('id', { count: 'exact', head: true })
      .lt('event_date', startDate);

    const targetPage = Math.floor((beforeCount ?? 0) / PAGE_SIZE);
    await fetchPage(targetPage, true);

    if (timelineRef.current) {
      timelineRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchPage(page + 1, false);
  };

  const handleLoadMoreRef = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPage(page + 1, false);
  }, [loadingMore, hasMore, page]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMoreRef();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [handleLoadMoreRef]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D0B8B0]"></div>
      </div>
    );
  }

  if (authError) {
    return <div className="text-center py-20 text-gray-400">{authError}</div>;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        还没有记录任何回忆哦，赶快添加第一条日记吧！🌟
      </div>
    );
  }

  return (
    <div ref={timelineRef} className="max-w-3xl mx-auto px-4 py-8 relative">
      <div className="fixed top-4 right-4 z-50 flex flex-wrap items-center justify-end gap-3 bg-white/90 backdrop-blur px-3 py-2 rounded-xl shadow-md">
        <select
          value={selectedYear}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedYear(value ? Number(value) : '');
            setSelectedMonth('');
            setInfoMessage('');
          }}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-600 bg-white/80"
        >
          <option value="">选择年份</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}年
            </option>
          ))}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => {
            const value = e.target.value;
            const month = value ? Number(value) : '';
            setSelectedMonth(month);
            setInfoMessage('');
            if (selectedYear && month) {
              handleJumpToMonth(selectedYear, month);
            }
          }}
          className="border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-600 bg-white/80"
          disabled={!selectedYear}
        >
          <option value="">选择月份</option>
          {monthsForYear.map((month) => (
            <option key={month} value={month}>
              {String(month).padStart(2, '0')}月
            </option>
          ))}
        </select>
      </div>

      {infoMessage && (
        <div className="fixed top-16 right-4 z-50 text-right text-xs text-stone-400 bg-white/90 backdrop-blur px-3 py-2 rounded-xl shadow-md">
          {infoMessage}
        </div>
      )}

      <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-1 bg-[#E8DDD8] transform md:-translate-x-1/2 rounded-full hidden md:block"></div>

      {events.map((event, index) => (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          key={event.id}
          className={`flex flex-col md:flex-row relative items-center gap-4 ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
          style={{
            marginTop: index === 0 ? 0 : -THUMB_CENTER_GAP,
          }}
        >
          <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 w-8 h-8 rounded-full bg-[#D0B8B0] border-4 border-[#FAFAF9] z-10 items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white"></div>
          </div>

          <div
            className={`w-full md:w-1/2 px-2 flex ${
              index % 2 === 0 ? 'md:justify-start' : 'md:justify-end'
            }`}
          >
            <div className="inline-block bg-white p-5 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-t-4 border-[#E8DDD8] relative max-w-full">
              <div className="text-sm font-semibold text-stone-500 mb-3 bg-[#FAFAF9] inline-block px-3 py-1 rounded-full">
                {format(new Date(event.event_date), 'yyyy年MM月dd日')}
              </div>

              {event.media_url && (
                <div className="mb-4 rounded-xl overflow-hidden shadow-inner bg-gray-100 h-56 flex items-center justify-center">
                  {event.media_type === 'video' ? (
                    <video
                      src={event.media_url}
                      controls
                      preload="metadata"
                      data-path={event.media_url}
                      onError={async (e) => {
                        const target = e.currentTarget;
                        const { signedUrl } = await buildSignedUrl(
                          target.dataset.path || ''
                        );
                        if (signedUrl) {
                          target.src = signedUrl;
                        }
                      }}
                      className="w-auto h-56 max-w-full object-contain bg-black"
                    />
                  ) : (
                    <img
                      src={event.media_url}
                      alt="Love diary memory"
                      loading="lazy"
                      decoding="async"
                      data-path={event.media_url}
                      onError={async (e) => {
                        const target = e.currentTarget;
                        const { signedUrl } = await buildSignedUrl(
                          target.dataset.path || ''
                        );
                        if (signedUrl) {
                          target.src = signedUrl;
                        }
                      }}
                      className="w-auto h-56 max-w-full object-contain rounded-xl bg-white cursor-zoom-in"
                      onClick={() =>
                        window.open(event.media_url, '_blank', 'noopener,noreferrer')
                      }
                    />
                  )}
                </div>
              )}

              <p className="text-gray-700 leading-relaxed whitespace-pre-line text-lg font-medium font-serif">
                {event.content}
              </p>
            </div>
          </div>
        </motion.div>
      ))}

      <div className="flex flex-col items-center gap-3 pt-2">
        {hasMore && (
          <div className="text-xs text-stone-400">
            {loadingMore ? '加载中...' : '向下滚动加载更多'}
          </div>
        )}
        <div ref={loadMoreRef} className="h-4 w-full" />
        {!hasMore && totalCount !== null && totalCount > 0 && (
          <div className="text-xs text-stone-400">已经到底啦</div>
        )}
      </div>
    </div>
  );
}
