'use client';

import { useEffect, useRef } from 'react';

/**
 * Mobile login keyboard choreography.
 *
 * VisualViewport reports the *visible* part of a mobile page when the virtual
 * keyboard appears. Keep the logo and form in the same coordinate system and
 * smoothly move both above that viewport's bottom edge. Nothing runs on tablet
 * or desktop; short screens keep ordinary document scrolling.
 */
export function useMobileLoginKeyboardGlide() {
  const shellRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const card = shell?.querySelector<HTMLElement>('.login-card');
    const logo = shell?.querySelector<HTMLElement>('.login-brand');
    if (!shell || !card || !logo) return;

    const mobile = window.matchMedia('(max-width: 700px)');
    const viewport = window.visualViewport;
    let largestVisibleHeight = viewport?.height ?? window.innerHeight;
    let frame = 0;
    let disposed = false;

    const clear = () => {
      shell.style.removeProperty('--login-keyboard-lift');
      shell.classList.remove('login-keyboard-open');
    };

    const measure = () => {
      frame = 0;
      if (disposed) return;

      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      if (!mobile.matches || (viewport && viewport.scale > 1.05)) {
        clear();
        return;
      }

      // Remember the unobstructed viewport; Android may resize innerHeight
      // itself while the keyboard is open, so a one-off innerHeight comparison
      // is not reliable.
      largestVisibleHeight = Math.max(largestVisibleHeight, height);
      const focused = document.activeElement;
      const editing = focused instanceof HTMLElement &&
        card.contains(focused) &&
        focused.matches('input:not([type="hidden"]), textarea, select') &&
        !(focused instanceof HTMLInputElement && focused.readOnly);

      // Ignore browser toolbars (~40-80px), pinch-zoom and mere focus rings.
      if (!editing || largestVisibleHeight - height < 130) {
        clear();
        return;
      }

      // Subtract the *rendered* animation transform so successive resize
      // events don't accumulate an ever-growing translation.
      const cssTransform = getComputedStyle(card).transform;
      const animatedY = cssTransform === 'none'
        ? 0
        : new DOMMatrixReadOnly(cssTransform).m42;
      const unshiftedBottom = card.getBoundingClientRect().bottom - animatedY;
      const unshiftedLogoTop = logo.getBoundingClientRect().top - animatedY;
      const visibleBottom = top + height - 12;
      const desired = Math.min(0, Math.round(visibleBottom - unshiftedBottom));

      // Keep the logo on screen when there is room. When the viewport is too
      // short, normal page scrolling stays available for the focused field.
      const upperBound = Math.round(top + 8 - unshiftedLogoTop);
      const lift = Math.min(0, Math.max(desired, upperBound));
      if (lift < -1) {
        shell.style.setProperty('--login-keyboard-lift', `${lift}px`);
        shell.classList.add('login-keyboard-open');
      } else {
        clear();
      }
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const onOrientation = () => {
      largestVisibleHeight = viewport?.height ?? window.innerHeight;
      clear();
      schedule();
    };

    // Capture focus from the same screen, including password inputs.
    shell.addEventListener('focusin', schedule);
    shell.addEventListener('focusout', schedule);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', onOrientation);
    mobile.addEventListener('change', schedule);
    schedule();

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      shell.removeEventListener('focusin', schedule);
      shell.removeEventListener('focusout', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', onOrientation);
      mobile.removeEventListener('change', schedule);
      clear();
    };
  }, []);

  return shellRef;
}
