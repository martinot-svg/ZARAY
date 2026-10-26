'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';

/** Numbers always originate in application data; only their visual presentation is interpolated. */
export function MotionCount({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (!Number.isFinite(value) || value <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    setDisplay(0);
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  const format = (n: number) => Number(n).toLocaleString('fr-FR');
  return <span className={className}><span className="motion-sr-only">{format(value)}</span><span aria-hidden="true">{format(display)}</span></span>;
}

/** Retains exiting messages just long enough to animate out, without delaying user actions. */
export function MotionFeedback({ message, kind = 'success' }: { message: string; kind?: 'success' | 'error' }) {
  const [shown, setShown] = useState<{ message: string; kind: 'success' | 'error' } | null>(
    message ? { message, kind } : null,
  );
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (message) {
      setShown({ message, kind });
      setExiting(false);
      return;
    }
    setExiting(true);
    const timer = window.setTimeout(() => setShown(null), 180);
    return () => window.clearTimeout(timer);
  }, [message, kind]);
  if (!shown) return null;
  return <div className={`alert alert-${shown.kind} motion-feedback${exiting ? ' is-exiting' : ''}`}
    role={shown.kind === 'error' ? 'alert' : 'status'} aria-live={shown.kind === 'error' ? 'assertive' : 'polite'}>
    {shown.message}
  </div>;
}

export function MotionSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton-list motion-skeleton" role="status" aria-label="Chargement des données">
    {Array.from({ length: Math.min(Math.max(rows, 1), 6) }, (_, index) => <span key={index} aria-hidden="true" />)}
    <span className="motion-sr-only">Chargement en cours…</span>
  </div>;
}

/** Accessible disclosure for sections that already exist in the product. */
export function MotionDisclosure({ title, description, children, defaultOpen = true }: {
  title: string; description?: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <section className="panel motion-disclosure">
    <button className="motion-disclosure-trigger" type="button" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(current => !current)}>
      <span><strong className="panel-title">{title}</strong>
        {description && <span className="muted motion-disclosure-description">{description}</span>}
      </span><span className="motion-disclosure-chevron" aria-hidden="true">⌄</span>
    </button>
    <div id={id} className={`motion-disclosure-content${open ? ' is-open' : ''}`}
      aria-hidden={!open} inert={!open}>
      <div className="motion-disclosure-inner">{children}</div>
    </div>
  </section>;
}
