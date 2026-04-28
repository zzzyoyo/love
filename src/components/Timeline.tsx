'use client';

import { useEffect, useState } from 'react';
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

export default function Timeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

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

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setAuthError('');

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setAuthError('请先解锁后查看回忆');
        setEvents([]);
        return;
      }

      // Retrieve everything ordered by event_date desc
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .order('event_date', { ascending: false });

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
        setEvents(signedEvents as TimelineEvent[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D0B8B0]"></div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="text-center py-20 text-gray-400">
        {authError}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        还没有记录任何回忆哦，赶快添加第一条日记吧！🌟
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 relative">
      <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-1 bg-[#E8DDD8] transform md:-translate-x-1/2 rounded-full hidden md:block"></div>
      
      {events.map((event, index) => (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          key={event.id}
          className={`flex flex-col md:flex-row mb-12 relative items-center gap-6 ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}
        >
          {/* 中间的时间轴节点（心形图标）- 仅大屏显示 */}
          <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 w-8 h-8 rounded-full bg-[#D0B8B0] border-4 border-[#FAFAF9] z-10 items-center justify-center">
             <div className="w-2 h-2 rounded-full bg-white"></div>
          </div>
          
          <div className="w-full md:w-1/2 px-2">
            <div className="bg-white p-5 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-t-4 border-[#E8DDD8] relative">
              
              <div className="text-sm font-semibold text-stone-500 mb-3 bg-[#FAFAF9] inline-block px-3 py-1 rounded-full">
                {format(new Date(event.event_date), 'yyyy年MM月dd日')}
              </div>
              
              {event.media_url && (
                <div className="mb-4 rounded-xl overflow-hidden shadow-inner bg-gray-100">
                  {event.media_type === 'video' ? (
                    <video
                      src={event.media_url}
                      controls
                      className="w-full h-auto max-h-[60vh] object-contain bg-black"
                    />
                  ) : (
                    <img
                      src={event.media_url}
                      alt="Love diary memory"
                      className="w-full h-auto object-cover rounded-xl"
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
    </div>
  );
}
