import { useState, useEffect } from 'react';

/**
 * Returns true when the page has been scrolled past the given threshold.
 * Also toggles `body.app-scrolled` so CSS custom property --app-header-height
 * updates automatically for all sticky elements.
 */
export function useScrollShrink(threshold = 10): boolean {
  const [scrolled, setScrolled] = useState(() =>
    typeof window !== 'undefined' && window.scrollY > threshold
  );

  useEffect(() => {
    const handler = () => {
      const s = window.scrollY > threshold;
      setScrolled(s);
      document.body.classList.toggle('app-scrolled', s);
    };
    // Sync on mount
    document.body.classList.toggle('app-scrolled', window.scrollY > threshold);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [threshold]);

  return scrolled;
}
