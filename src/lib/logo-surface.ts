export type LogoTone = 'light' | 'dark';
export type RGBA = { r: number; g: number; b: number; a: number };

/** Parse computed CSS rgb()/rgba() values, including modern space/slash syntax. */
export function parseCssColor(value: string): RGBA | null {
  const match = value.match(/^rgba?\((.*)\)$/i);
  if (!match) return null;
  const parts = match[1].replace(/[,/]/g, ' ').trim().split(/\s+/);
  if (parts.length < 3) return null;
  const channel = (v: string) => v.endsWith('%') ? Number.parseFloat(v) * 2.55 : Number.parseFloat(v);
  const alpha = (v: string) => v.endsWith('%') ? Number.parseFloat(v) / 100 : Number.parseFloat(v);
  const r=channel(parts[0]), g=channel(parts[1]), b=channel(parts[2]);
  const a=parts[3] === undefined ? 1 : alpha(parts[3]);
  if (![r,g,b,a].every(Number.isFinite)) return null;
  return { r: Math.max(0, Math.min(255,r)), g: Math.max(0, Math.min(255,g)),
    b: Math.max(0, Math.min(255,b)), a: Math.max(0, Math.min(1,a)) };
}

function over(foreground: RGBA, background: RGBA): RGBA {
  const a = foreground.a + background.a * (1-foreground.a);
  if (a===0) return {r:0,g:0,b:0,a:0};
  return { a, r:(foreground.r*foreground.a+background.r*background.a*(1-foreground.a))/a,
    g:(foreground.g*foreground.a+background.g*background.a*(1-foreground.a))/a,
    b:(foreground.b*foreground.a+background.b*background.a*(1-foreground.a))/a };
}
function luminance(c: RGBA): number {
  const linear=(v:number)=>{const s=v/255; return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;};
  return .2126*linear(c.r)+.7152*linear(c.g)+.0722*linear(c.b);
}
export function toneForColor(c: RGBA): LogoTone { return luminance(c) < .179 ? 'dark' : 'light'; }

/**
 * Inspect the ACTUAL painted ancestor surfaces, from nearest to farthest.
 * Transparent elements are ignored; translucent ones are alpha-composited.
 * Dark/light system preference is only a fallback if no surface is painted.
 * A data-logo-surface attribute is an explicit fallback for backgrounds made of photos.
 */
export function surfaceTone(node: HTMLElement, win: Window): LogoTone {
  let accumulated: RGBA={r:0,g:0,b:0,a:0};
  let explicit: LogoTone | null=null;
  for (let parent: HTMLElement | null=node.parentElement; parent; parent=parent.parentElement) {
    const override=parent.getAttribute('data-logo-surface');
    if (!explicit && (override==='light' || override==='dark')) explicit=override;
    const style=win.getComputedStyle(parent);
    const painted=parseCssColor(style.backgroundColor);
    if(painted && painted.a>0) accumulated=over(accumulated,painted);
    if (accumulated.a>=.99) return toneForColor(accumulated);
  }
  if(explicit) return explicit;
  const dark=win.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const base: RGBA=dark?{r:10,g:13,b:11,a:1}:{r:255,g:255,b:255,a:1};
  return toneForColor(over(accumulated,base));
}
