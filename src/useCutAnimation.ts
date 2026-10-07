import { useEffect, useState } from 'react';

export function useCutAnimation(key: string, duration: number) {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [clock, setClock] = useState({ key, time: 0 });
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(media.matches);
    media.addEventListener('change', changed);
    changed();
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (reduced) return;
    const started = performance.now();
    let request = 0;
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      const time = Math.min(duration, now - started);
      setClock({ key, time });
      if (time < duration) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(request); };
  }, [key, duration, reduced]);
  return { elapsed: reduced ? duration : clock.key === key ? clock.time : 0, reduced };
}
