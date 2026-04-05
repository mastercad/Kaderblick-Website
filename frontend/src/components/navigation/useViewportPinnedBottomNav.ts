import React from 'react';

export const MOBILE_BOTTOM_NAV_HEIGHT = 56;
export const MOBILE_BOTTOM_NAV_SAFE_AREA = 'env(safe-area-inset-bottom, 0px)';

export type ViewportPinnedNavStyle = {
  left: number;
  top: number;
  width: number;
};

function isIosStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const isIos = /iP(hone|ad|od)/.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches === true
    || window.matchMedia?.('(display-mode: fullscreen)').matches === true
    || window.matchMedia?.('(display-mode: minimal-ui)').matches === true
  );
}

export function useViewportPinnedBottomNav(enabled: boolean, navHeight: number): ViewportPinnedNavStyle | null {
  const [style, setStyle] = React.useState<ViewportPinnedNavStyle | null>(null);

  React.useLayoutEffect(() => {
    if (!enabled || typeof window === 'undefined' || !isIosStandalonePwa() || !window.visualViewport) {
      setStyle(null);
      return undefined;
    }

    const viewport = window.visualViewport;
    let frameId = 0;

    const update = () => {
      frameId = 0;
      const next = {
        left:  Math.round(viewport.offsetLeft),
        top:   Math.round(viewport.offsetTop + viewport.height - navHeight),
        width: Math.round(viewport.width),
      };
      setStyle(prev =>
        prev && prev.left === next.left && prev.top === next.top && prev.width === next.width
          ? prev : next
      );
    };

    const scheduleUpdate = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(update);
    };

    scheduleUpdate();
    viewport.addEventListener('resize', scheduleUpdate);
    viewport.addEventListener('scroll', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    document.addEventListener('visibilitychange', scheduleUpdate);

    return () => {
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
      viewport.removeEventListener('resize', scheduleUpdate);
      viewport.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
      window.removeEventListener('pageshow', scheduleUpdate);
      document.removeEventListener('visibilitychange', scheduleUpdate);
    };
  }, [enabled, navHeight]);

  return style;
}
