'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface UnlockGateProps {
  onUnlock: () => void;
}

export default function UnlockGate({ onUnlock }: UnlockGateProps) {
  const [date, setDate] = useState('');
  const [question, setQuestion] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toCuteError = (raw: string) => {
    if (raw.includes('答案不正确') || raw.includes('解锁失败')) {
      return '错啦！！！🖕️😠';
    }
    return raw;
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, question, message }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || '解锁失败');
      }

      await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });

      onUnlock();
    } catch (err: unknown) {
      const messageText =
        err instanceof Error ? err.message : '出现了一点小问题';
      setError(toCuteError(messageText));
      setTimeout(() => setError(''), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#FAFAF9]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-xl w-full max-w-md text-center"
      >
        <div className="flex justify-center mb-6 text-[#D0B8B0]">
          <Heart size={48} className="fill-current animate-pulse" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">zyr和zw的专属回忆💕</h1>

        <form onSubmit={handleUnlock} className="space-y-6">
          <div className="text-left">
            <label className="block text-sm font-medium text-stone-500 mb-1">
              我们在一起的日期是哪天？ 
            </label>
            <input
              type="text"
              placeholder="YYYY-MM-DD"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E8DDD8] bg-white/50"
              required
            />
          </div>

          <div className="text-left">
            <label className="block text-sm font-medium text-stone-500 mb-1">
              zyr 最爱问 zw 什么问题？
            </label>
            <input
              type="text"
              placeholder="请输入答案..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E8DDD8] bg-white/50"
              required
            />
          </div>

          <div className="text-left">
            <label className="block text-sm font-medium text-stone-500 mb-1">
              zw 最想对 zyr 说的话是？
            </label>
            <input
              type="text"
              placeholder="请输入答案..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E8DDD8] bg-white/50"
              required
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#EEE6E2] hover:bg-[#E2D6D0] text-stone-600 font-semibold rounded-xl transition-colors shadow-md flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span>{loading ? '验证中...' : '打开'}</span>
            <Heart size={18} />
          </motion.button>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-stone-500 text-sm mt-4 bg-[#F8F3F1] rounded-full px-4 py-2 inline-block"
            >
              {error}
            </motion.p>
          )}
        </form>
      </motion.div>
    </div>
  );
}
