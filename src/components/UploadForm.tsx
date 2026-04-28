'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, UploadCloud, Calendar, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';

export default function UploadForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState('');
  const [content, setContent] = useState('');

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    setFile(null);
    setDate('');
    setContent('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !content) {
      toast.error('请填写日期和想说的话哦');
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error('请先解锁后再上传');
        setLoading(false);
        return;
      }

      let mediaUrl = '';
      let mediaType = 'image';

      if (file) {
        // 判断类型
        mediaType = file.type.startsWith('video/') ? 'video' : 'image';
        
        // 生成唯一文件名 (当前时间戳 + 随机字符串)
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // 上传到 supabase storage
        const { error: uploadError } = await supabase.storage
          .from('love-media')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error('上传文件失败: ' + uploadError.message);
        }

        mediaUrl = filePath;
      }

      // 写入到数据库
      const { error: dbError } = await supabase
        .from('timeline_events')
        .insert({
          event_date: date,
          content: content,
          media_url: mediaUrl,
          media_type: mediaType,
        });

      if (dbError) {
        throw new Error('保存日记失败: ' + dbError.message);
      }

      toast.success('专属回忆添加成功！🎉');
      handleClose();

      // 刷新页面，或者你可以用 context 更新列表
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || '出现了一点小意外呀');
      } else {
        toast.error('出现了一点小意外呀');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      
      {/* 悬浮按钮 */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 15 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleOpen}
        className="fixed bottom-8 right-8 bg-[#EEE6E2] p-4 rounded-full shadow-md shadow-stone-200/50 z-50 flex items-center justify-center text-stone-600 border border-[#FFF]"
        aria-label="Add Memeroy"
      >
        <Plus size={32} />
      </motion.button>

      {/* 模态弹窗 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative"
            >
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-[#D0B8B0] transition-colors bg-[#F5F2F0] rounded-full p-1"
              >
                <X size={24} />
              </button>

              <div className="flex flex-col items-center mb-6 mt-2">
                <div className="bg-[#F0EBE9] p-3 rounded-full mb-3 text-[#D0B8B0]">
                  <HeartPulseIcon />
                </div>
                <h2 className="text-2xl font-bold text-stone-700 font-serif">
                  记录新的一天
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Date Selection */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <Calendar size={18} className="text-[#C5B3AA]"/> 选择日期
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#D0B8B0] focus:ring-4 focus:ring-[#E8DDD8]/50 text-gray-600 transition-all font-medium"
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <UploadCloud size={18} className="text-[#C5B3AA]"/> 
                    上传照片 / 视频 (可选)
                  </label>
                  
                  <div className="relative border-2 border-dashed border-stone-200 hover:border-[#D0B8B0] transition-colors rounded-2xl bg-[#F5F2F0]/50 flex flex-col items-center justify-center p-8 cursor-pointer overflow-hidden group">
                    <input
                      type="file"
                      id="memory-file"
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    
                    {file ? (
                      <div className="text-center z-0 relative flex flex-col items-center">
                        <div className="w-16 h-16 bg-[#F0EBE9] rounded-2xl flex items-center justify-center text-[#D0B8B0] mb-2 shadow-inner">
                          {file.type.startsWith('video/') ? "🎥" : "🖼️"}
                        </div>
                        <p className="font-medium text-stone-600 truncate max-w-xs">{file.name}</p>
                        <p className="text-xs text-[#C5B3AA] mt-1">点击更改</p>
                      </div>
                    ) : (
                      <div className="text-center z-0 text-gray-400 group-hover:text-[#C5B3AA] transition-colors flex flex-col items-center">
                        <UploadCloud size={32} className="mb-2 opacity-50"/>
                        <p className="font-medium">点击此处选择文件</p>
                        <p className="text-xs mt-1 opacity-70">支持图片或短视频</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content Area */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <FileText size={18} className="text-[#C5B3AA]"/> 想说的情话
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="今天发生了什么好玩的事？有什么想告诉ta的..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#D0B8B0] focus:ring-4 focus:ring-[#E8DDD8]/50 text-gray-700 transition-all resize-none shadow-sm"
                  ></textarea>
                </div>

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                  type="submit"
                  className="w-full bg-[#EEE6E2] text-stone-600 font-bold py-4 rounded-xl shadow-lg shadow-stone-200 hover:shadow-xl hover:shadow-stone-300 transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2 text-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      正在保存到回忆里...
                    </>
                  ) : (
                    <>封存回忆 💌</>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Simple internal icon for UI
function HeartPulseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
  );
}