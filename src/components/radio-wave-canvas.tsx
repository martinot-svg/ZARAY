'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * One lightweight canvas replaces many independently rasterized, subpixel SVGs.
 * A shared, monotonic clock drives all arcs at the same linear speed:
 * fixed radial spacing, no crossings, no separate paint animations.
 * ZARAY's original backdrop, stars, theme button and layouts remain intact.
 */
const WAVE_DURATION = 15; // seconds per emitted wave; twice the previous speed
const WAVE_COUNT = 16; // half the previous gap, without overlapping arcs
// Subpixel strokes fragmented during rasterization. A softly translucent
// half-pixel core creates the same delicacy with a continuous edge.
const INITIAL_STROKE = 0.5; // CSS pixels, steady delicate fiber
const FINAL_STROKE = 0.7;
const HALO_EXTRA_WIDTH = 1.6; // lightweight glow, not a costly shadowBlur

export default function RadioWaveCanvas() {
  const pathname = usePathname();
  // Radio waves belong only to the public arrival and authentication experience.
  // Z’Accueil and all subsequent account/company pages retain the starfield
  // but no longer render any radio wave graphics.
  const publicBackdrop = pathname === '/' || [
    '/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe',
  ].some(route => pathname === route || pathname.startsWith(route + '/'));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const field = canvas?.parentElement;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!publicBackdrop || !canvas || !field || !context) return;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let anchorFrame = 0;
    let lastFrameTime = 0;
    let activeSeconds = 0;
    let width = 0;
    let height = 0;
    let emitterX: number | null = null;
    let emitterY: number | null = null;
    let disposed = false;

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      // Avoid expensive full-screen 3× and 4× canvases on mobile devices.
      const density = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0);
    };

    const locateEmitter = () => {
      anchorFrame = 0;
      if (disposed) return;
      const icon = Array.from(document.querySelectorAll<HTMLElement>(
        '.zaray-theme-switch .zaray-theme-icon',
      )).find((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 &&
          bounds.left < width && bounds.top < height &&
          bounds.right > 0 && bounds.bottom > 0;
      });

      if (!icon) {
        emitterX = null;
        emitterY = null;
        field.dataset.active = 'false';
        return;
      }
      const bounds = icon.getBoundingClientRect();
      emitterX = bounds.left + bounds.width / 2;
      emitterY = bounds.top + bounds.height / 2;
      field.dataset.active = 'true';
    };

    const scheduleLocateEmitter = () => {
      if (!anchorFrame) anchorFrame = window.requestAnimationFrame(locateEmitter);
    };

    const draw = (time: number) => {
      frame = 0;
      if (disposed || document.hidden || motionPreference.matches) return;

      if (lastFrameTime > 0) {
        // Freeze the animation across background-tab pauses instead of jumping.
        activeSeconds += Math.min((time - lastFrameTime) / 1000, 0.08);
      }
      lastFrameTime = time;
      context.clearRect(0, 0, width, height);

      if (emitterX !== null && emitterY !== null) {
        const diagonal = Math.hypot(width, height);
        const minimumRadius = 4;
        const radiusSpan = diagonal * 1.25 - minimumRadius;
        const light = document.documentElement.getAttribute('data-zaray-theme') === 'light';
        context.strokeStyle = light ? '#167647' : '#a2ffd0';
        context.lineCap = 'round';

        // Sixteen wavefronts, one spatial coordinate system and one clock.
        // A constant delta in phase gives an exact constant distance between
        // arcs; the last fades away as a new one emerges at the transmitter.
        for (let index = 0; index < WAVE_COUNT; index++) {
          const phase = ((activeSeconds / WAVE_DURATION) + index / WAVE_COUNT) % 1;
          const radius = minimumRadius + radiusSpan * phase;
          const lineWidth = INITIAL_STROKE + (FINAL_STROKE - INITIAL_STROKE) * phase;
          const fadeIn = Math.min(1, phase / 0.07);
          const fadeOut = Math.pow(1 - phase, 1.5);
          const visibility = fadeIn * fadeOut;

          // Faithful outer Wi-Fi arc. The original source path had endpoints
          // (21,135), (478,135), upper handles (138,-15), (360,-15) and its
          // transmitter at (249,315). The path is transformed mathematically
          // in canvas space, without scaling the physical stroke thickness.
          const scale = radius / 295;
          context.save();
          context.translate(emitterX, emitterY);
          context.rotate(-3 * Math.PI / 4); // only toward bottom-left
          context.beginPath();
          context.moveTo(-228 * scale, -180 * scale);
          context.bezierCurveTo(
            -111 * scale, -330 * scale,
            111 * scale, -330 * scale,
            229 * scale, -180 * scale,
          );
          // Double-pass on the SAME continuous Bezier path, keeping every
          // wavefront in its existing position and preventing a dotted look.
          // The diffuse halo is faint; the thin core defines the filament.
          context.lineWidth = lineWidth + HALO_EXTRA_WIDTH;
          context.globalAlpha = 0.045 * visibility;
          context.stroke();
          context.lineWidth = lineWidth;
          context.globalAlpha = 0.27 * visibility;
          context.stroke();
          context.restore();
        }
        context.globalAlpha = 1;
      }
      frame = window.requestAnimationFrame(draw);
    };

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastFrameTime = 0;
    };

    const updatePlayback = () => {
      stop();
      if (document.hidden || motionPreference.matches) {
        context.clearRect(0, 0, width, height);
        return;
      }
      frame = window.requestAnimationFrame(draw);
    };

    const onResize = () => {
      resize();
      scheduleLocateEmitter();
    };

    resize();
    locateEmitter();
    updatePlayback();

    const observer = new MutationObserver(scheduleLocateEmitter);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', scheduleLocateEmitter, true);
    document.addEventListener('visibilitychange', updatePlayback);
    motionPreference.addEventListener('change', updatePlayback);

    return () => {
      disposed = true;
      stop();
      if (anchorFrame) window.cancelAnimationFrame(anchorFrame);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', scheduleLocateEmitter, true);
      document.removeEventListener('visibilitychange', updatePlayback);
      motionPreference.removeEventListener('change', updatePlayback);
    };
  }, [publicBackdrop]);

  if (!publicBackdrop) return null;

  return <div className="zaray-wifi-wavefield" data-active="false" aria-hidden="true">
    <canvas ref={canvasRef} className="zaray-wifi-wave-canvas" />
  </div>;
}
