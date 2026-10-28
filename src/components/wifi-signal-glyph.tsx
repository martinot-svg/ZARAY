import type { SVGProps } from 'react';

/**
 * Exact Wi-Fi silhouette traced from the reference supplied for ZARAY:
 * three independent filled arcs and the lower circular transmitter.
 * One shape is reused for the theme-icon waves and the background broadcast.
 */
export default function WifiSignalGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 499 359" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M0 117 L41 153 L83 111 L123 85 L179 63 L239 54 L296 58 L354 75 L389 93 L415 111 L457 153 L498 117 L459 77 L406 40 L375 25 L338 12 L303 4 L266 0 L232 0 L184 6 L123 25 L94 39 L59 61 L32 83 Z" />
      <path d="M66 177 L105 214 L128 190 L163 165 L190 153 L223 145 L275 145 L323 159 L363 184 L391 214 L432 177 L401 145 L360 117 L313 98 L269 90 L212 92 L159 107 L107 137 Z" />
      <path d="M132 239 L172 277 L191 254 L215 239 L238 233 L266 234 L285 240 L302 250 L326 277 L366 238 L343 213 L308 191 L271 180 L237 179 L209 184 L178 197 L154 214 Z" />
      <path className="zaray-wifi-glyph-dot" d="M243 268 L224 275 L214 284 L206 298 L204 320 L209 335 L224 351 L242 358 L256 358 L274 351 L285 341 L293 325 L294 306 L287 288 L278 278 L260 269 Z" />
    </svg>
  );
}
