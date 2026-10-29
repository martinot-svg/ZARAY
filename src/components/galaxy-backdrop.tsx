'use client';

import { useEffect, useState } from 'react';
import RadioWaveCanvas from '@/components/radio-wave-canvas';

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
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
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
    <RadioWaveCanvas />
  </div>;
}
