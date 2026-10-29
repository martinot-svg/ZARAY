'use client';

import { useEffect, useRef } from 'react';

/**
 * One lightweight canvas replaces eight independently rasterized, subpixel SVGs.
 * A shared, monotonic clock drives all arcs at the same linear speed:
 * fixed radial spacing, no crossings, no separate paint animations.
 * ZARAY's original backdrop, stars, theme button and layouts remain intact.
 */
const WAVE_DURATION = 30; // seconds per emitted wave
const WAVE_COUNT = 8;
const INITIAL_STROKE = 0.07; // CSS pixels, intentionally ultra-fine
const FINAL_STROKE = 0.09;

export default function RadioWaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const field = canvas?.parentElement;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !field || !context) return;

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

        // Eight wavefronts, one spatial coordinate system and one clock.
        // A constant delta in phase gives an exact constant distance between
        // arcs; the last fades away as a new one emerges at the transmitter.
        for (let index = 0; index < WAVE_COUNT; index++) {
          const phase = ((activeSeconds / WAVE_DURATION) + index / WAVE_COUNT) % 1;
          const radius = minimumRadius + radiusSpan * phase;
          const lineWidth = INITIAL_STROKE + (FINAL_STROKE - INITIAL_STROKE) * phase;
          const fadeIn = Math.min(1, phase / 0.07);
          const fadeOut = Math.pow(1 - phase, 1.5);
          context.globalAlpha = 0.92 * fadeIn * fadeOut;
          context.lineWidth = lineWidth;

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
  }, []);

  return <div className="zaray-wifi-wavefield" data-active="false" aria-hidden="true">
    <canvas ref={canvasRef} className="zaray-wifi-wave-canvas" />
  </div>;
}
