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
const SIGNED_URL_TTL_MS = 55 * 60 * 1000;

type SignedUrlEntry = { url: string; expiresAt: number };
type TimelineCache = {
  events: TimelineEvent[] | null;
  page: number;
  hasMore: boolean;
  totalCount: number | null;
  monthOptions: { year: number; month: number; label: string }[];
  selectedYear: number | '';
  selectedMonth: number | '';
  signedUrlByPath: Record<string, SignedUrlEntry>;
};

const timelineCache: TimelineCache = {
  events: null,
  page: 0,
  hasMore: true,
  totalCount: null,
  monthOptions: [],
  selectedYear: '',
  selectedMonth: '',
  signedUrlByPath: {},
};

const normalizeMediaPath = (rawUrl: string) => {
  if (!rawUrl) return { filePath: '', shouldSign: false, fallbackUrl: '' };
  if (rawUrl.startsWith('http')) {
    const publicPrefix = '/storage/v1/object/public/love-media/';
    const signedPrefix = '/storage/v1/object/sign/love-media/';
    const publicIndex = rawUrl.indexOf(publicPrefix);
    const signedIndex = rawUrl.indexOf(signedPrefix);

    if (publicIndex !== -1) {
      return {
        filePath: rawUrl.slice(publicIndex + publicPrefix.length),
        shouldSign: true,
        fallbackUrl: rawUrl,
      };
    }

    if (signedIndex !== -1) {
      let filePath = rawUrl.slice(signedIndex + signedPrefix.length);
      const queryIndex = filePath.indexOf('?');
      if (queryIndex !== -1) {
        filePath = filePath.slice(0, queryIndex);
      }
      return { filePath, shouldSign: true, fallbackUrl: rawUrl };
    }

    return { filePath: '', shouldSign: false, fallbackUrl: rawUrl };
  }

  return { filePath: rawUrl, shouldSign: true, fallbackUrl: rawUrl };
};

export default function Timeline({ newEvent }: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isFetchingRef = useRef(false);
  const [events, setEvents] = useState<TimelineEvent[]>(
    () => timelineCache.events ?? []
  );
  const [loading, setLoading] = useState(() => !timelineCache.events);
  const [loadingMore, setLoadingMore] = useState(false);
  const [authError, setAuthError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [page, setPage] = useState(() => timelineCache.page ?? 0);
  const [hasMore, setHasMore] = useState(() => timelineCache.hasMore ?? true);
  const [totalCount, setTotalCount] = useState<number | null>(
    () => timelineCache.totalCount ?? null
  );
  const [monthOptions, setMonthOptions] = useState<
    { year: number; month: number; label: string }[]
  >(() => timelineCache.monthOptions ?? []);
  const [selectedYear, setSelectedYear] = useState<number | ''>(
    () => timelineCache.selectedYear ?? ''
  );
  const [selectedMonth, setSelectedMonth] = useState<number | ''>(
    () => timelineCache.selectedMonth ?? ''
  );

  const getSignedUrl = async (rawUrl: string) => {
    const { filePath, shouldSign, fallbackUrl } = normalizeMediaPath(rawUrl);
    if (!shouldSign) return { signedUrl: fallbackUrl, filePath };

    const cached = timelineCache.signedUrlByPath[filePath];
    if (cached && cached.expiresAt > Date.now()) {
      return { signedUrl: cached.url, filePath };
    }

    const { data, error } = await supabase.storage
      .from('love-media')
      .createSignedUrl(filePath, 60 * 60);

    if (error) {
      console.error('Error creating signed url:', error);
      return { signedUrl: '', filePath };
    }

    timelineCache.signedUrlByPath[filePath] = {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_MS,
    };

    return { signedUrl: data.signedUrl, filePath };
  };

  const sortByEventDateAsc = (list: TimelineEvent[]) =>
    [...list].sort((a, b) => {
      const dateDiff =
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

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
      if (isFetchingRef.current && !replace) return;
      isFetchingRef.current = true;
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setAuthError('');
      setInfoMessage('');

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setAuthError('请先解锁再查看回忆');
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
            const { signedUrl } = await getSignedUrl(event.media_url);
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
      isFetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isActive) return;
      if (!data.session) {
        setAuthError('请先解锁再查看回忆');
        setEvents([]);
        setLoading(false);
        return;
      }

      if (timelineCache.events?.length) {
        setLoading(false);
        if (!timelineCache.monthOptions.length) {
          fetchBounds();
        }
        return;
      }

      fetchPage(0, true);
      fetchBounds();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setAuthError('');
          if (timelineCache.events?.length) {
            setLoading(false);
            return;
          }
          fetchPage(0, true);
          fetchBounds();
        } else {
          setAuthError('请先解锁再查看回忆');
          setEvents([]);
          timelineCache.events = null;
          timelineCache.page = 0;
          timelineCache.hasMore = true;
          timelineCache.totalCount = null;
          timelineCache.monthOptions = [];
          timelineCache.selectedYear = '';
          timelineCache.selectedMonth = '';
          timelineCache.signedUrlByPath = {};
        }
      }
    );

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!newEvent) return;
    let isActive = true;

    const addNewEvent = async () => {
      const signed = newEvent.media_url
        ? await getSignedUrl(newEvent.media_url)
        : { signedUrl: '', filePath: '' };
      if (!isActive) return;
      const normalizedEvent = signed.signedUrl
        ? { ...newEvent, media_url: signed.signedUrl }
        : newEvent;

      setEvents((prev) => {
        if (prev.some((event) => event.id === normalizedEvent.id)) {
          return prev;
        }
        return sortByEventDateAsc([normalizedEvent, ...prev]);
      });
    };

    addNewEvent();

    return () => {
      isActive = false;
    };
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

  const stateRef = useRef({ page, loadingMore, hasMore, fetchPage });

  useEffect(() => {
    stateRef.current = { page, loadingMore, hasMore, fetchPage };
  });

  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const {
          page: currPage,
          loadingMore: isLoad,
          hasMore: hasM,
          fetchPage: doFetch,
        } = stateRef.current;
        if (!isLoad && hasM) {
          doFetch(currPage + 1, false);
        }
      },
      { rootMargin: '200px' }
    );

    observerRef.current.observe(node);
  }, []);

  useEffect(() => {
    timelineCache.events = events;
    timelineCache.page = page;
    timelineCache.hasMore = hasMore;
    timelineCache.totalCount = totalCount;
    timelineCache.monthOptions = monthOptions;
    timelineCache.selectedYear = selectedYear;
    timelineCache.selectedMonth = selectedMonth;
  }, [events, page, hasMore, totalCount, monthOptions, selectedYear, selectedMonth]);

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
      <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2 bg-white/90 backdrop-blur px-3 py-2 rounded-xl shadow-md">
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

      <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-[#E8DDD8] transform -translate-x-1/2 rounded-full"></div>

      {events.map((event, index) => (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          key={event.id}
          className={`flex flex-row relative items-center gap-4 ${index % 2 === 0 ? 'flex-row-reverse' : ''}`}
          style={{
            marginTop: index === 0 ? 0 : -THUMB_CENTER_GAP,
          }}
        >
          <div className="flex absolute left-1/2 transform -translate-x-1/2 w-8 h-8 rounded-full bg-[#D0B8B0] border-4 border-[#FAFAF9] z-10 items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white"></div>
          </div>

          <div
            className={`w-1/2 px-2 flex ${
              index % 2 === 0 ? 'justify-start' : 'justify-end'
            }`}
          >
            <div className="inline-block bg-white p-5 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-t-4 border-[#E8DDD8] relative max-w-full">
              <div className="text-sm font-semibold text-stone-500 mb-3 bg-[#FAFAF9] inline-block px-3 py-1 rounded-full whitespace-nowrap">
                {format(new Date(event.event_date), 'yyyy.MM.dd')}
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
                        const { signedUrl } = await getSignedUrl(
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
                        const { signedUrl } = await getSignedUrl(
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
