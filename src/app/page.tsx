/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect } from 'react';
import UnlockGate from '@/components/UnlockGate';
import Timeline, { type TimelineEvent } from '@/components/Timeline';
import UploadForm from '@/components/UploadForm';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [newEvent, setNewEvent] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    let isActive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isActive) return;
      setIsUnlocked(!!data.session);
      setIsChecking(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsUnlocked(!!session);
      }
    );

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  if (isChecking) return null;

  return (
    <main className="min-h-screen bg-[#FAFAF9] text-stone-700 font-sans">
      {!isUnlocked ? (
        <UnlockGate onUnlock={handleUnlock} />
      ) : (
        <div className="relative pb-24 h-full"> 
          {/* header area */}
          <header className="pt-10 pb-6 text-center">
            <h1 className="text-4xl font-extrabold text-stone-700 drop-shadow-sm font-serif flex justify-center items-center gap-2">
              <span>zyr & zw</span> 
              <span>的恋爱日记</span>
            </h1>
          </header>

          <Timeline newEvent={newEvent} />
          <UploadForm onUploaded={(event) => setNewEvent(event)} />
        </div>
      )}
    </main>
  );
}
