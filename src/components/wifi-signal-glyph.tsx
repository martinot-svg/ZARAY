import type { SVGProps } from 'react';

/** Three fine Wi-Fi arcs based on the supplied reference, without heavy fills. */
export default function WifiSignalGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 499 359"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.07"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path vectorEffect="non-scaling-stroke" d="M 21 135 C 138 -15 360 -15 478 135" />
      <path vectorEffect="non-scaling-stroke" d="M 86 196 C 171 88 328 88 413 196" />
      <path vectorEffect="non-scaling-stroke" d="M 152 257 C 202 190 296 190 346 257" />
      <circle className="zaray-wifi-glyph-dot" cx="249" cy="315" r="4.5" stroke="none" fill="currentColor" />
    </svg>
  );
}
