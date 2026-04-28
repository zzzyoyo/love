'use client';

import { useEffect, useState } from 'react';

const EMOJIS = ['❤️', '🏀', '🧡', '💛', '💖', '🏀', '💕'];

export default function FloatingElements() {
  const [elements, setElements] = useState<{ id: number; emoji: string; left: string; animationDuration: string; delay: string; fontSize: string }[]>([]);

  useEffect(() => {
    // 仅在客户端生成，避免 SSR 报错（Hydration Mismatch）
    const items = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      left: `${Math.random() * 90 + 5}%`, // 5% 到 95%
      animationDuration: `${Math.random() * 8 + 6}s`, // 6s 到 14s
      delay: `${Math.random() * 5}s`,
      fontSize: `${Math.random() * 1 + 1.2}rem`, // 1.2rem 到 2.2rem
    }));
    setElements(items);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {elements.map((el) => (
        <div
          key={el.id}
          className="absolute bottom-[-10%] float-animation"
          style={{
            left: el.left,
            animationDuration: el.animationDuration,
            animationDelay: el.delay,
            fontSize: el.fontSize,
            opacity: 0.6,
          }}
        >
          {el.emoji}
        </div>
      ))}
    </div>
  );
}
