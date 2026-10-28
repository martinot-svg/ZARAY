'use client';

import { useEffect, useRef, useState } from 'react';
import WifiSignalGlyph from '@/components/wifi-signal-glyph';

/** Decorative-only star layer. The original page gradient stays in CSS. */
const stars = Array.from({ length: 74 }, (_, index) => {
  const rand = (seed: number) => {
    const v = Math.sin((index + 1) * seed * 127.1) * 43758.5453123;
    return v - Math.floor(v);
  };
  return {
    left: (2 + rand(1.7) * 96).toFixed(2) + '%',
    top: (3 + rand(2.3) * 94).toFixed(2) + '%',
    size: (0.7 + rand(3.8) * 1.45).toFixed(2) + 'px',
    delay: (-rand(4.4) * 12).toFixed(2) + 's',
    duration: (6 + rand(5.2) * 8).toFixed(2) + 's',
    opacity: (0.19 + rand(6.1) * 0.38).toFixed(2),
  };
});
const meteors = [
  { left: '82%', top: '12%', delay: '-7s', duration: '23s' },
  { left: '59%', top: '28%', delay: '-16s', duration: '31s' },
  { left: '95%', top: '48%', delay: '-26s', duration: '37s' },
];

export default function GalaxyBackdrop() {
  const [reducedMotion, setReducedMotion] = useState(true);
  const waveFieldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);


  // Anchor the broadcast to the *real* Sun/Moon icon, even after responsive
  // layout changes or client-side navigation. No coordinates are hardcoded.
  useEffect(() => {
    const field = waveFieldRef.current;
    if (!field) return;
    let frame = 0;
    const updateOrigin = () => {
      frame = 0;
      const visibleIcon = Array.from(document.querySelectorAll<HTMLElement>('.zaray-theme-switch .zaray-theme-icon'))
        .find((icon) => {
          const rect = icon.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 &&
            rect.right > 0 && rect.bottom > 0 &&
            rect.left < window.innerWidth && rect.top < window.innerHeight;
        });
      if (!visibleIcon) {
        field.dataset.active = 'false';
        return;
      }
      const rect = visibleIcon.getBoundingClientRect();
      field.style.setProperty('--zaray-wifi-x', `${rect.left + rect.width / 2}px`);
      field.style.setProperty('--zaray-wifi-y', `${rect.top + rect.height / 2}px`);
      // A viewport-relative extent makes the waves reach desktop, tablet and mobile edges.
      field.style.setProperty('--zaray-wifi-scale',
        String(Math.min(22, Math.max(9, Math.hypot(window.innerWidth, window.innerHeight) / 108))));
      field.dataset.active = 'true';
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateOrigin);
    };
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('scroll', scheduleUpdate, true);
    scheduleUpdate();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div className="zaray-galaxy-backdrop zaray-original-backdrop" aria-hidden="true">
    <div className="zaray-starfield">
      {stars.map((star, index) => <span key={index} className="zaray-twinkle-star"
        style={{
          left: star.left, top: star.top, width: star.size, height: star.size,
          opacity: Number(star.opacity), animationDelay: star.delay,
          animationDuration: star.duration,
        }} />)}
      {!reducedMotion && meteors.map((meteor, index) =>
        <span key={index} className="zaray-shooting-star" style={{
          left: meteor.left, top: meteor.top, animationDelay: meteor.delay,
          animationDuration: meteor.duration,
        }} />)}
    </div>
    <div className="zaray-wifi-wavefield" ref={waveFieldRef} data-active="false">
      <WifiSignalGlyph className="zaray-wifi-global-pulse" />
    </div>
  </div>;
}
