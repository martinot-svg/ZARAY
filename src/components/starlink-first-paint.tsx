/**
 * Server-rendered satellite silhouettes, visible from first paint and when
 * WebGL is unavailable. The actual animated spacecraft are 3D WebGL meshes.
 *
 * These detailed perspective snapshots are backups, not fake claims of a
 * certified SpaceX CAD model; their 2D gradients suggest metal and solar
 * cells until WebGL is ready.
 */
const visible = [
  { id: 'a', x: 680, y: -96, size: 1.0, className: 'one' },
  { id: 'b', x: 868, y: -14, size: 0.82, className: 'two' },
  { id: 'c', x: 1060, y: 94, size: 0.68, className: 'three' },
] as const;

export default function StarlinkFirstPaint() {
  return <svg className="zaray-starlink-first-paint"
    viewBox="0 0 1185 1185" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="zaray-satellite-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#d8e4ea" />
        <stop offset="25%" stopColor="#7e96a8" />
        <stop offset="61%" stopColor="#e2eff3" />
        <stop offset="100%" stopColor="#455e71" />
      </linearGradient>
      <linearGradient id="zaray-satellite-panel" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor="#234764" />
        <stop offset="35%" stopColor="#102b47" />
        <stop offset="70%" stopColor="#1c4d71" />
        <stop offset="100%" stopColor="#071a30" />
      </linearGradient>
      <pattern id="zaray-satellite-cells" width="15" height="11"
        patternUnits="userSpaceOnUse">
        <path d="M 15 0 L 0 0 0 11" fill="none"
          stroke="#8bb0c2" strokeWidth="0.65" opacity="0.8" />
        <path d="M 7.5 0 V 11" stroke="#5c8099"
          strokeWidth="0.38" opacity="0.48" />
      </pattern>
    </defs>
    {visible.map(s => (
      <g key={s.id} transform={`translate(${s.x} ${s.y}) scale(${s.size})`}
        className={'zaray-starlink-first-craft zaray-starlink-first-' + s.className}>
        <g className="zaray-starlink-first-drift">
          {/* Perspective-distorted deployed solar arrays with individual cells */}
          <path d="M -20 -17 L -127 -37 L -120 11 L -20 23 Z"
            fill="url(#zaray-satellite-panel)" stroke="#cad8e1" strokeWidth="2" />
          <path d="M -20 -17 L -127 -37 L -120 11 L -20 23 Z"
            fill="url(#zaray-satellite-cells)" opacity=".72" />
          <path d="M 19 -18 L 121 -40 L 132 7 L 19 23 Z"
            fill="url(#zaray-satellite-panel)" stroke="#cad8e1" strokeWidth="2" />
          <path d="M 19 -18 L 121 -40 L 132 7 L 19 23 Z"
            fill="url(#zaray-satellite-cells)" opacity=".72" />
          <path d="M -20 2 L -28 -2 M 19 2 L 29 -4"
            stroke="#dce7ec" strokeWidth="3.1" fill="none" />
          {/* Faceted metal bus: front, side and top have distinct light values */}
          <path d="M -22 -15 L 10 -24 L 29 -8 L 24 22 L -12 28 L -23 12 Z"
            fill="url(#zaray-satellite-metal)" stroke="#e2edf1" strokeWidth="1.5" />
          <path d="M 10 -24 L 29 -8 L 24 22 L 13 8 Z" fill="#627c8d" />
          <path d="M -22 -15 L 10 -24 L 29 -8 L -4 -1 Z" fill="#dcebf0" />
          <path d="M -11 2 L 6 -2 L 9 16 L -11 19 Z" fill="#20384e"
            stroke="#a7c3d3" strokeWidth="1" />
          <path d="M -5 2 V 18 M 1 0 V 17 M -11 9 L 8 7"
            stroke="#6f94aa" strokeWidth=".7" />
          {/* Metallic RF dishes and optical equipment */}
          <ellipse cx="-15" cy="-8" rx="7" ry="4.5"
            fill="#c5d4dc" stroke="#f1f8fa" strokeWidth="1" />
          <ellipse cx="19" cy="-10" rx="5" ry="3"
            fill="#9cb4c4" stroke="#eef4f7" strokeWidth="1" />
          <circle cx="14" cy="14" r="3" fill="#83b5d6"
            stroke="#d8edf7" strokeWidth="1" />
        </g>
      </g>
    ))}
  </svg>;
}
