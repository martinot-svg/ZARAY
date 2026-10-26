'use client';

import { useEffect } from 'react';

/**
 * Accessibility safety net for dynamically coloured ZARAY surfaces.
 * CSS design tokens remain the primary source of colours. This guard only
 * corrects text whose *rendered* contrast is below WCAG AA thresholds.
 */
export function ContrastGuardian() {
  useEffect(() => {
    const corrected = new Map<HTMLElement, { color: string; priority: string }>();
    let pending = false;
    let auditing = false;
    let destroyed = false;
    const placeholderOriginal = new Map<HTMLElement, { value: string; priority: string }>();
    const watchOptions: MutationObserverInit = {
      subtree: true, childList: true, attributes: true, characterData: true,
    };
    let observer: MutationObserver;
    const rgb = (value: string): [number, number, number, number] | null => {
      const match = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
      if (!match) return null;
      const alpha = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : Number(match[4])) : 1;
      return [Number(match[1]), Number(match[2]), Number(match[3]), alpha];
    };
    const over = (top: number[], bottom: number[]): number[] => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      return a ? [0, 1, 2].map(i => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a) : [0, 0, 0, 0];
    };
    const luminance = (c: number[]) => {
      const linear = c.slice(0, 3).map(v => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const contrast = (a: number[], b: number[]) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const background = (element: HTMLElement): number[] => {
      const stack: HTMLElement[] = [];
      for (let node: HTMLElement | null = element; node; node = node.parentElement) stack.push(node);
      let color: number[] = [255, 255, 255, 1]; // Canvas fallback
      for (const node of stack.reverse()) {
        const computed = getComputedStyle(node);
        const layer = rgb(computed.backgroundColor);
        if (layer) color = over(layer, color);
      }
      return color;
    };
    const hasText = (element: HTMLElement) =>
      Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim());
    const inspect = () => {
      if (auditing) return;
      auditing = true;
      observer?.disconnect(); // No self-triggered mutation loops; still observe app changes.
      try {
        for (const node of corrected.keys()) if (!node.isConnected) corrected.delete(node);
        for (const node of placeholderOriginal.keys()) if (!node.isConnected) placeholderOriginal.delete(node);
        const nodes = document.body.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,p,span,a,button,label,small,strong,em,li,td,th,dt,dd,div,input,textarea,select,option,summary,legend,figcaption,caption,blockquote,pre,code,time,output,header,footer,nav,[role="alert"],[role="status"],[role="button"],[role="tab"]');
        nodes.forEach(element => {
          if (element.closest('[data-contrast-ignore],svg,canvas,[aria-hidden="true"]')) return;
          if (!hasText(element) && !element.matches('input,textarea,select,option')) return;
          if (element.matches('input[type="hidden"],input[type="checkbox"],input[type="radio"],input[type="range"],input[type="color"],input[type="image"]')) return;
          const existing = corrected.get(element);
          if (existing) {
            element.style.removeProperty('color');
            if (existing.color) element.style.setProperty('color', existing.color, existing.priority);
            corrected.delete(element);
          }
          const style = getComputedStyle(element);
          if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return;
          const fg = rgb(style.color);
          if (!fg) return;
          const bg = background(element);
          if (element.matches('input,textarea')) {
            const muted = [88, 104, 91, 1]; // Accessible muted ink on light fields.
            const dark = [17, 25, 20, 1], light = [255, 255, 255, 1];
            const suggested = contrast(muted, bg) >= 4.5 ? '#58685b'
              : contrast(dark, bg) >= contrast(light, bg) ? '#111914' : '#ffffff';
            if (!placeholderOriginal.has(element)) placeholderOriginal.set(element, {
              value: element.style.getPropertyValue('--zaray-placeholder-color'),
              priority: element.style.getPropertyPriority('--zaray-placeholder-color'),
            });
            if (element.style.getPropertyValue('--zaray-placeholder-color') !== suggested)
              element.style.setProperty('--zaray-placeholder-color', suggested);
          }
          const rendered = over(fg, bg);
          const size = parseFloat(style.fontSize);
          const bold = Number(style.fontWeight) >= 700 || style.fontWeight === 'bold';
          const threshold = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
          if (contrast(rendered, bg) >= threshold) return;
          const dark = [17, 25, 20, 1], light = [255, 255, 255, 1];
          const replacement = contrast(dark, bg) >= contrast(light, bg) ? '#111914' : '#ffffff';
          corrected.set(element, { color: element.style.getPropertyValue('color'), priority: element.style.getPropertyPriority('color') });
          element.style.setProperty('color', replacement, 'important');
        });
      } finally {
        auditing = false;
        if (!destroyed) observer.observe(document.documentElement, watchOptions);
      }
    };
    const schedule = () => {
      if (pending || destroyed) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; if (!destroyed) inspect(); });
    };
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, watchOptions);
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', schedule);
    window.addEventListener('resize', schedule);
    // CSS pseudo-classes change visual contrast without DOM mutations.
    const interactionEvents = ['pointerover','pointerout','focusin','focusout','input','change'];
    interactionEvents.forEach(event => document.addEventListener(event, schedule, true));
    schedule();
    return () => {
      destroyed = true;
      observer.disconnect();
      media.removeEventListener('change', schedule);
      window.removeEventListener('resize', schedule);
      interactionEvents.forEach(event => document.removeEventListener(event, schedule, true));
      placeholderOriginal.forEach((original, element) => {
        element.style.removeProperty('--zaray-placeholder-color');
        if (original.value) element.style.setProperty('--zaray-placeholder-color', original.value, original.priority);
      });
      corrected.forEach((original, element) => {
        element.style.removeProperty('color');
        if (original.color) element.style.setProperty('color', original.color, original.priority);
      });
    };
  }, []);
  return null;
}
