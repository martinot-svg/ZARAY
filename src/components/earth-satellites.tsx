/**
 * Three restrained Starlink-like spacecraft around the existing Z'Accueil globe.
 *
 * No network data, no logos, no fake "Wi-Fi" arcs, and no visible orbit rings.
 * Trajectories are stylized visible orbital passes roughly 550 km above Earth:
 * Earth's radius is 592.5 units on this matching sphere viewBox, orbital radius
 * about 644 units. The vehicles are drawn larger than strict astronomical
 * scale because 10-m spacecraft would be subpixel next to an Earth this size.
 *
 * SSR SVG/SMIL means satellites are present at the first paint, independent
 * of WebGL, JS hydration, and the globe's delayed 3D atlas loading.
 * Slow independent paths and fades indicate passage into/out of view; they
 * are visualizations, NOT actual tracked Starlink satellites or TLE positions.
 */
const satellites = [
  {
    id: 'one',
    // Orbit visible segment tangent to the planet's limb, radius ~644.
    orbit: 'M 362 -6 C 480 -63 673 -80 830 -5 C 944 44 1030 124 1102 222',
    duration: '102s',
    start: '-40s',
    scale: 1,
    opacity: 0.92,
  },
  {
    id: 'two',
    // A second pass in the opposite direction and a slightly higher plane.
    orbit: 'M 1114 231 C 1001 72 835 -12 633 -59 C 525 -79 426 -58 342 8',
    duration: '133s',
    start: '-65s',
    scale: 0.83,
    opacity: 0.82,
  },
  {
    id: 'three',
    // A subtly inclined independent pass over the same orbital limb.
    orbit: 'M 400 -26 C 518 -77 645 -70 762 -31 C 916 15 1014 102 1081 202',
    duration: '162s',
    start: '-104s',
    scale: 0.71,
    opacity: 0.72,
  },
] as const;

function Spacecraft({ scale }: { scale: number }) {
  return <g transform={`scale(${scale})`}>
    {/* Low-profile single solar-panel wing; dark blue PV cells and a small bus.
        No cartoon antenna, station, orbit circle, or glowing "Wi-Fi" rings. */}
    <rect x="-9.8" y="-2.5" width="16.5" height="4.8" rx="0.45"
      fill="#172a3b" stroke="#8199ac" strokeWidth="0.50" />
    <path d="M -6.9 -2.2 V 2.1 M -3.4 -2.2 V 2.1 M 0 -2.2 V 2.1 M 3.4 -2.2 V 2.1"
      stroke="#56839c" strokeWidth="0.38" opacity="0.88" />
    <path d="M -9.1 0 H 5.9" stroke="#698aa3" strokeWidth="0.31" opacity="0.9" />
    <rect x="6.2" y="-2.0" width="4.1" height="4.0" rx="0.55"
      fill="#9aabb6" stroke="#d7e7ed" strokeWidth="0.48" />
    <path d="M 8.2 -2.9 L 8.2 -2.05 M 8.2 2.05 L 8.2 2.75"
      stroke="#b2c4d1" strokeWidth="0.35" />
    <circle cx="8.25" cy="-0.75" r="0.62" fill="#e7f5fb" opacity="0.95" />
  </g>;
}

export default function EarthSatellites() {
  return <svg className="zaray-earth-satellites" viewBox="0 0 1185 1185"
    preserveAspectRatio="xMidYMid meet" focusable="false"
    aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <g className="zaray-satellites-motionless">
      <g transform="translate(540 -43) rotate(-7)" opacity="0.88"><Spacecraft scale={0.95} /></g>
      <g transform="translate(755 -20) rotate(18)" opacity="0.78"><Spacecraft scale={0.82} /></g>
      <g transform="translate(970 75) rotate(38)" opacity="0.70"><Spacecraft scale={0.70} /></g>
    </g>
    {satellites.map(satellite => (
      <g key={satellite.id} opacity={satellite.opacity}>
        <g className="zaray-orbiting-spacecraft">
          <Spacecraft scale={satellite.scale} />
          <animateMotion path={satellite.orbit}
            dur={satellite.duration} begin={satellite.start}
            rotate="auto" calcMode="paced" repeatCount="indefinite" />
          <animate attributeName="opacity"
            values="0;1;1;0;0"
            keyTimes="0;0.075;0.86;0.94;1"
            dur={satellite.duration} begin={satellite.start}
            repeatCount="indefinite" />
        </g>
      </g>
    ))}
  </svg>;
}
