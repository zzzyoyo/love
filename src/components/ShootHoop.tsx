'use client';

export default function ShootHoop() {
  return (
    <div className="fixed bottom-24 right-8 md:right-16 w-32 h-48 pointer-events-none z-0 opacity-90 transition-opacity flex flex-col items-center" aria-hidden="true">
      <style>{`
        @keyframes custom-shoot-ball {
          0% {
            transform: translate(-120px, 120px) rotate(0deg) scale(0.6);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          30% {
            transform: translate(-40px, -30px) rotate(180deg) scale(1.1);
          }
          50% {
            transform: translate(0px, -5px) rotate(360deg) scale(0.95);
            opacity: 1;
          }
          60% {
            transform: translate(0px, 40px) rotate(450deg) scale(0.9);
          }
          70% {
            transform: translate(0px, 80px) rotate(540deg) scale(0.8);
            opacity: 0;
          }
          100% {
            transform: translate(0px, 120px) rotate(720deg) scale(0.7);
            opacity: 0;
          }
        }
        .animate-custom-shoot {
          animation: custom-shoot-ball 3.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
          transform-origin: center;
          display: inline-block;
        }
      `}</style>
      <div className="relative w-full h-full flex flex-col items-center">
        {/* 篮板 */}
        <div className="absolute top-4 w-20 h-16 border-[3px] border-stone-200/80 bg-white/40 rounded-sm z-[10] shadow-sm">
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-5 border-2 border-orange-400/70"></div>
        </div>

        {/* 篮网和整个篮筐底座 (z-index: 10, 在篮球后方) */}
        <div className="absolute top-[3.3rem] w-14 h-16 z-[10] flex flex-col items-center">
          {/* 完整的椭圆篮筐 */}
          <div className="w-14 h-[1.1rem] border-[3.5px] border-orange-500 rounded-[50%] absolute top-0"></div>
          {/* 篮网 */}
          <div className="w-10 h-12 border-x-2 border-b-2 border-stone-300/80 border-dashed rounded-b-xl mt-[0.6rem]"></div>
        </div>

        {/* ===================== 动画篮球 ===================== */}
        {/* 篮球的初始位置设为篮筐正上方中心区域附近，靠动画改变 transform */}
        <div className="absolute top-[2.8rem] text-4xl z-[15] drop-shadow-md animate-custom-shoot">
          🏀
        </div>

        {/* 前半圈蓝筐 (z-index: 20, 在篮球前方，形成穿过的视觉差) */}
        <div className="absolute top-[3.3rem] w-14 h-[1.1rem] z-[20]" style={{ clipPath: 'inset(50% 0 0 0)' }}>
           <div className="w-full h-full border-[3.5px] border-orange-500 rounded-[50%]"></div>
        </div>
      </div>
    </div>
  );
}
