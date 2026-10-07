'use client';
import { useEffect, useState } from 'react';
import { localDateKey } from '@/lib/work-dashboard.mjs';

// Due dates are calendar days in the viewer's device timezone, never UTC instants.
// Recheck after sleep/focus and at local midnight, including 23/25-hour DST days.
export function useWorkDay() {
  const [today, setToday] = useState('');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = new Date();
      setToday(localDateKey(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(update, midnight.getTime() - now.getTime() + 100);
    };
    update();
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return today;
}
