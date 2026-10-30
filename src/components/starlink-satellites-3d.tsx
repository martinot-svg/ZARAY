'use client';

import { useEffect, useRef } from 'react';
import StarlinkFirstPaint from './starlink-first-paint';

/**
 * Three physically modeled Starlink V2 Mini-inspired satellites.
 *
 * Technical reference: SpaceX Starlink technology / Gen2 V2 Mini: a thin
 * compact flat bus, TWO deployed solar wings, phased-array payload and
 * navigation/laser hardware. This is original parametric THREE-DIMENSIONAL
 * geometry (not a 2D SVG or an official SpaceX CAD file).
 *
 * Camera: a stable illustrative local orbital view above the same Earth's
 * rim. The three craft never fade away or jump to the beginning of a path.
 * Smooth visible motion cycles (260/320/400 seconds), NOT live TLE tracking.
 * The real orbital period in low Earth orbit is ~95 min; this visual is an
 * intentionally slow, stable artistic close-up, not an orbital simulation.
 *
 * Small native WebGL renderer avoids a dependency, a network-loaded model,
 * and a second very large Three.js bundle on mobile. All materials, normals,
 * solar cell grids and pose are genuine 3D geometry and lighting.
 */

const DESIGN_GLOBE_SIZE = 1185;
const GAP_RATIO = 0.13;
const FRAME_INTERVAL = 1000 / 30;

type Vec3 = [number, number, number];
type OrbitingCraft = {
  x: number; y: number; size: number; period: number;
  phase: number; pitch: number; yaw: number; roll: number;
  dx: number; dy: number;
};

const CRAFT: readonly OrbitingCraft[] = [
  // Earth-local coordinates matched to the user's 1366x644 horizon.
  // Craft move about 0.8–1.7 px/s at peak on desktop, visibly but gently.
  // The motions reverse smoothly without teleporting, fading or vanishing.
  { x: 680, y: -96, size: 17.5, period: 260, phase: 0.35,
    pitch: -0.31, yaw: -0.37, roll: -0.11, dx: 72, dy: 13 },
  { x: 868, y: -14, size: 15.0, period: 320, phase: 2.30,
    pitch: 0.28, yaw: 0.46, roll: 0.14, dx: 64, dy: 12 },
  { x: 1060, y: 94, size: 13.5, period: 400, phase: 4.25,
    pitch: -0.20, yaw: -0.54, roll: 0.17, dx: 56, dy: 11 },
];

const VERTEX = [
  'attribute vec3 aPosition;',
  'attribute vec3 aNormal;',
  'attribute vec3 aColor;',
  'uniform vec2 uViewport;',
  'uniform vec2 uCenter;',
  'uniform float uScale;',
  'uniform vec3 uAngles;',
  'varying vec3 vColor;',
  'vec3 spin(vec3 p) {',
  '  float cx = cos(uAngles.x), sx = sin(uAngles.x);',
  '  float cy = cos(uAngles.y), sy = sin(uAngles.y);',
  '  float cz = cos(uAngles.z), sz = sin(uAngles.z);',
  '  p = vec3(p.x, p.y*cx - p.z*sx, p.y*sx + p.z*cx);',
  '  p = vec3(p.x*cy + p.z*sy, p.y, -p.x*sy + p.z*cy);',
  '  return vec3(p.x*cz - p.y*sz, p.x*sz + p.y*cz, p.z);',
  '}',
  'void main() {',
  '  vec3 p = spin(aPosition);',
  '  vec3 n = normalize(spin(aNormal));',
  '  vec3 light = normalize(vec3(-0.55, 0.72, 1.00));',
  '  float lambert = max(dot(n, light), 0.0);',
  '  float highlight = pow(max(dot(reflect(-light,n), vec3(0.,0.,1.)),0.), 22.);',
  '  vec3 lit = aColor * (0.48 + 0.52*lambert) + vec3(0.29,0.33,0.37)*highlight;',
  '  vColor = min(lit,vec3(1.));',
  '  float lens = 1.0 / (1.0 + p.z*0.045);',
  '  vec2 px = uCenter + p.xy*uScale*lens;',
  '  vec2 ndc = vec2(px.x/uViewport.x*2.0-1.0, 1.0-px.y/uViewport.y*2.0);',
  '  gl_Position = vec4(ndc, clamp(-p.z/15.0,-0.95,0.95), 1.0);',
  '}',
].join('\n');

const FRAGMENT = [
  'precision mediump float;',
  'varying vec3 vColor;',
  'void main() { gl_FragColor = vec4(vColor, 1.0); }',
].join('\n');

function buildStarlinkV2Mini(): Float32Array {
  const points: number[] = [];
  const aluminum: Vec3 = [0.61, 0.69, 0.74];
  const rim: Vec3 = [0.34, 0.43, 0.52];
  const dark: Vec3 = [0.065, 0.108, 0.158];
  const photovoltaic: Vec3 = [0.055, 0.137, 0.230];

  function quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Vec3) {
    const e1 = [b[0]-a[0],b[1]-a[1],b[2]-a[2]];
    const e2 = [c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const n: Vec3 = [
      e1[1]*e2[2]-e1[2]*e2[1],
      e1[2]*e2[0]-e1[0]*e2[2],
      e1[0]*e2[1]-e1[1]*e2[0],
    ];
    const len = Math.hypot(...n) || 1;
    const normal = n.map(v=>v/len);
    for (const v of [a,b,c,a,c,d]) {
      points.push(...v,...normal,...color);
    }
  }

  function box(x: number, y: number, z: number,
    w: number, h: number, depth: number, side: Vec3, face: Vec3 = side) {
    const x0=x-w/2,x1=x+w/2,y0=y-h/2,y1=y+h/2,z0=z-depth/2,z1=z+depth/2;
    quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],face);
    quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],side);
    quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],side);
    quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],side);
    quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],side);
    quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],side);
  }

  function disk(x: number, y: number, z: number, radius: number,
    color: Vec3, segments=12) {
    for (let i=0;i<segments;i++) {
      const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
      const c: Vec3=[x,y,z], v1: Vec3=[x+radius*Math.cos(a),y+radius*Math.sin(a),z];
      const v2: Vec3=[x+radius*Math.cos(b),y+radius*Math.sin(b),z];
      quad(c,v1,v2,c,color);
    }
  }

  // Small volumetric reflector antennas with raised rims and feed centers.
  // V2 Mini spacecraft have E-band parabolic antennas: unlike a painted
  // white circle, each 3D bowl has real depth and reacts to directional light.
  function reflector(x: number, y: number, front: number, radius: number) {
    const rings = 4, sections = 16;
    const ringColor: Vec3 = [0.66, 0.75, 0.81];
    for (let row = 0; row < rings; row++) {
      const inner = radius * row / rings;
      const outer = radius * (row + 1) / rings;
      const zi = front + 0.11 * Math.pow(inner / radius, 2);
      const zo = front + 0.11 * Math.pow(outer / radius, 2);
      for (let slice = 0; slice < sections; slice++) {
        const a = 2 * Math.PI * slice / sections;
        const b = 2 * Math.PI * (slice + 1) / sections;
        const p0: Vec3 = [x + inner * Math.cos(a), y + inner * Math.sin(a), zi];
        const p1: Vec3 = [x + outer * Math.cos(a), y + outer * Math.sin(a), zo];
        const p2: Vec3 = [x + outer * Math.cos(b), y + outer * Math.sin(b), zo];
        const p3: Vec3 = [x + inner * Math.cos(b), y + inner * Math.sin(b), zi];
        const tone = (slice % 3) * 0.024;
        quad(p0, p1, p2, p3, [
          ringColor[0] - tone, ringColor[1] - tone, ringColor[2] - tone
        ]);
      }
    }
    disk(x, y, front + 0.022, radius * 0.18, [0.16, 0.26, 0.34]);
    disk(x, y, front + 0.027, radius * 0.08, [0.80, 0.91, 0.96]);
  }

  // Flat compact communications bus, shaped like a real V2 Mini rather than
  // the large parabolic-dish spacecraft in the photographic user reference.
  box(0,0,0.04,1.93,1.39,0.39,rim,aluminum);
  box(0,0,0.275,1.68,1.20,0.10,[0.35,0.42,0.47],[0.43,0.49,0.54]);
  box(0,-0.51,0.345,1.62,0.12,0.07,[0.61,0.66,0.69]);
  box(0,0.52,0.345,1.62,0.10,0.07,[0.44,0.52,0.59]);

  // Eight RF phased-array apertures and 3 laser/navigation ports.
  const ap=[[-0.55,-0.24],[-0.2,-0.24],[0.19,-0.24],[0.55,-0.24],
            [-0.55,0.17],[-0.2,0.17],[0.19,0.17],[0.55,0.17]];
  for (const [x,y] of ap) {
    box(x,y,0.349,0.25,0.28,0.025,[0.18,0.24,0.28],[0.16,0.24,0.31]);
    box(x,y,0.37,0.19,0.22,0.014,[0.27,0.32,0.36],[0.22,0.33,0.41]);
  }
  reflector(-0.69, 0.43, 0.395, 0.148);
  reflector( 0.69, 0.43, 0.395, 0.148);
  // Central star-tracker and optical terminal with glass aperture.
  disk(0,-0.48,0.411,0.085,[0.10,0.15,0.20]);
  disk(0,-0.48,0.423,0.043,[0.55,0.74,0.83]);

  // Hinges, graphite deployers, braces and connectors.
  for (const sign of [-1,1]) {
    const sx=sign*1.08;
    box(sx,-0.22,-0.015,0.47,0.095,0.10,[0.46,0.52,0.56]);
    box(sx,0.25,-0.015,0.47,0.095,0.10,[0.46,0.52,0.56]);
    box(sign*1.10,0,0.055,0.18,0.62,0.15,[0.39,0.48,0.56]);

    // Dual deployable solar-array wings: TWO flat framed black-blue panels.
    const cx=sign*3.04;
    // Broader deployed wings so solar-cell details remain perceptible in 3D.
    box(cx,0,-0.10,3.64,2.10,0.065,[0.37,0.45,0.54],dark);
    box(cx,0,0.001,3.48,1.95,0.024,[0.09,0.16,0.25],photovoltaic);
    const start=cx-1.69;
    for (let col=0; col<9; col++) {
      for (let row=0;row<4;row++) {
        const cellX=start+(col+0.5)*3.38/9;
        const cellY=-0.91+(row+0.5)*1.82/4;
        const shimmer=(col+row)%3===0?1.18:(col+row)%3===1?0.87:1.0;
        box(cellX,cellY,0.026,0.338,0.407,0.006,
          [0.05,0.11,0.19],
          [0.045*shimmer,0.14*shimmer,0.245*shimmer]);
        // Tiny shiny busbars: individual solar cells are actual rectangles.
        box(cellX,cellY,0.033,0.010,0.378,0.003,[0.25,0.37,0.45]);
      }
    }
    // The perimeter and central spars are structural 3D struts.
    box(cx,-1.025,0.04,3.65,0.036,0.055,aluminum);
    box(cx,1.025,0.04,3.65,0.036,0.055,aluminum);
    box(cx-1.81,0,0.04,0.032,2.10,0.054,aluminum);
    box(cx+1.81,0,0.04,0.032,2.10,0.054,aluminum);
    box(cx,0,0.035,0.031,2.00,0.042,[0.54,0.62,0.67]);
    box(sign*1.12,0,-0.03,0.55,0.085,0.09,aluminum);
  }

  // Ion thruster housing on the far side; fine rear-facing rim.
  box(0,0.04,-0.31,0.53,0.55,0.18,[0.28,0.33,0.38]);
  disk(0,0.04,-0.417,0.20,[0.12,0.19,0.26]);
  return new Float32Array(points);
}

function compile(gl: WebGLRenderingContext, kind: number, source: string) {
  const shader=gl.createShader(kind);
  if (!shader) return null;
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
    console.warn('[ZARAY Starlink 3D] Shader:',gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function StarlinkSatellites3D() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const containerRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const canvas=canvasRef.current;
    const container=containerRef.current;
    if (!canvas || !container) return;

    const gl=canvas.getContext('webgl',{
      alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power',
    });
    if (!gl) return;

    const vertex=compile(gl,gl.VERTEX_SHADER,VERTEX);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,FRAGMENT);
    if (!vertex || !fragment) return;
    const program=gl.createProgram();
    const buffer=gl.createBuffer();
    if (!program || !buffer) return;

    gl.attachShader(program,vertex);
    gl.attachShader(program,fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {
      console.warn('[ZARAY Starlink 3D] Link:',gl.getProgramInfoLog(program));
      return;
    }

    const geometry=buildStarlinkV2Mini();
    const vertexCount=geometry.length/9;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,geometry,gl.STATIC_DRAW);
    const stride=9*4;
    for (const [name,size,offset] of [
      ['aPosition',3,0],['aNormal',3,12],['aColor',3,24],
    ] as const) {
      const loc=gl.getAttribLocation(program,name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,offset);
    }
    const uViewport=gl.getUniformLocation(program,'uViewport');
    const uCenter=gl.getUniformLocation(program,'uCenter');
    const uScale=gl.getUniformLocation(program,'uScale');
    const uAngles=gl.getUniformLocation(program,'uAngles');
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    let dead=false,visible=true,frameId=0,lastFrame=-Infinity;
    let reduceMotion=false;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');

    function render(now:number) {
      if (!gl || !canvas || !container || dead) return;
      const width=Math.max(1,container.clientWidth);
      const dpr=Math.min(window.devicePixelRatio||1,1.6);
      const pixels=Math.min(1600,Math.round(width*dpr));
      const canvasPixelsY=Math.round(pixels*(1+GAP_RATIO));
      if (canvas.width!==pixels || canvas.height!==canvasPixelsY) {
        canvas.width=pixels;
        canvas.height=canvasPixelsY;
        gl.viewport(0,0,pixels,canvasPixelsY);
      }
      const height=width*(1+GAP_RATIO);
      const gap=width*GAP_RATIO;
      const ratio=width/DESIGN_GLOBE_SIZE;
      const meshRatio=Math.max(ratio,0.61);
      gl.useProgram(program);
      gl.uniform2f(uViewport,width,height);
      gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

      // Epoch-based smooth positions: revisiting Z'Accueil doesn't snap the
      // spacecraft to the start of a short animation or flash in/out.
      const seconds=reduceMotion?0:(Date.now()/1000);
      for (const craft of CRAFT) {
        const t=2*Math.PI*seconds/craft.period+craft.phase;
        const x=(craft.x+craft.dx*Math.sin(t))*ratio;
        const y=(craft.y+craft.dy*Math.cos(t))*ratio+gap;
        gl.uniform2f(uCenter,x,y);
        gl.uniform1f(uScale,craft.size*meshRatio);
        gl.uniform3f(uAngles,
          craft.pitch+0.045*Math.sin(t),
          craft.yaw+0.085*Math.cos(t),
          craft.roll+0.025*Math.sin(t));
        gl.drawArrays(gl.TRIANGLES,0,vertexCount);
      }
      // Hide the server-rendered perspective fallback only after real 3D
      // triangles have actually been drawn successfully by the GPU.
      if (gl.getError() === gl.NO_ERROR) {
        container.dataset.satellitesReady = 'true';
      }
      lastFrame=now;
    }

    function tick(now:number) {
      frameId=0;
      if (dead || !visible || document.hidden || reduceMotion) return;
      if (now-lastFrame>=FRAME_INTERVAL) render(now);
      frameId=requestAnimationFrame(tick);
    }

    function refresh() {
      if (frameId) cancelAnimationFrame(frameId);
      frameId=0;
      if (dead) return;
      reduceMotion=media.matches;
      render(performance.now());
      if (!document.hidden && visible && !reduceMotion) {
        frameId=requestAnimationFrame(tick);
      }
    }

    const observer=new IntersectionObserver(entries=>{
      visible=entries[0]?.isIntersecting??false;
      refresh();
    },{threshold:0.001});
    observer.observe(container);
    const resize=new ResizeObserver(refresh);
    resize.observe(container);
    media.addEventListener('change',refresh);
    document.addEventListener('visibilitychange',refresh);
    refresh();

    return ()=>{
      dead=true;
      if (frameId) cancelAnimationFrame(frameId);
      observer.disconnect();
      resize.disconnect();
      media.removeEventListener('change',refresh);
      document.removeEventListener('visibilitychange',refresh);
      container.dataset.satellitesReady = 'false';
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  },[]);

  return <div ref={containerRef} className="zaray-starlink-3d-layer"
    data-satellites-ready="false" aria-hidden="true">
    <StarlinkFirstPaint />
    <canvas ref={canvasRef} className="zaray-starlink-3d-canvas" />
  </div>;
}
