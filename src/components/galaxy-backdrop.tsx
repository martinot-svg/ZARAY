'use client';

import { useEffect, useRef } from 'react';

/**
 * ZARAY's shared, non-interactive background. A single WebGL2 draw call renders
 * continuously evolving nebulae, multi-depth stardust, halos and luminous flows.
 * No textures, libraries, timers driving React renders, or personal data.
 */
// Retain the motion phase when navigating between ZARAY modules.
let sharedGalaxyClock = 0;

const vertexSource = `#version 300 es
precision highp float;
void main() {
  vec2 xy = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(xy * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0,0.0)), w.x),
    mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0,1.0)), w.x), w.y);
}
float fbm(vec2 p) {
  float n = 0.0;
  float a = 0.52;
  mat2 rot = mat2(1.63, 1.21, -1.21, 1.63);
  for (int i = 0; i < 3; i++) {
    n += a * noise2(p);
    p = rot * p + vec2(11.13, 4.71);
    a *= 0.49;
  }
  return n;
}
float stars(vec2 p, float scale, vec2 velocity, float seed, float threshold) {
  vec2 q = p * scale + velocity * u_time;
  vec2 cell = floor(q);
  vec2 center = vec2(hash21(cell + seed), hash21(cell + seed + 13.4));
  vec2 distanceToStar = fract(q) - (0.24 + 0.52 * center);
  float presence = smoothstep(threshold, 1.0, hash21(cell + seed + 6.3));
  float radius = mix(0.015, 0.038, hash21(cell + seed + 8.6));
  float sparkle = exp(-dot(distanceToStar, distanceToStar) / (radius * radius));
  float glow = exp(-length(distanceToStar) * 22.0) * 0.095;
  float breathing = 0.90 + 0.10 * sin(u_time * 0.27 + hash21(cell) * 6.283);
  return presence * (sparkle + glow) * breathing;
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time;
  // Long, mutually incommensurate periods prevent short visible looping.
  vec2 path1 = vec2(0.21 * sin(t * 0.083) + t * 0.009, 0.17 * cos(t * 0.061) - t * 0.005);
  vec2 path2 = vec2(-0.16 * cos(t * 0.071) - t * 0.004, 0.13 * sin(t * 0.097) + t * 0.008);
  vec2 distortion = vec2(fbm(p * 1.8 + path2), fbm(p * 1.72 - path1 + 5.7)) - 0.52;

  float vaporA = fbm(p * 2.18 + distortion * 1.55 + path1);
  float vaporB = fbm((p + vec2(0.9, -0.33)) * 2.85 - distortion * 1.18 + path2);
  float ribbon = smoothstep(0.39, 0.81, vaporA) * exp(-pow(p.y + 0.16 * sin(p.x * 1.52 + t * 0.043) + 0.08, 2.0) * 2.5);
  float billow = smoothstep(0.42, 0.83, vaporB) * exp(-pow(p.x * 0.54 + p.y + 0.22, 2.0) * 1.48);

  // Depth: deep black backdrop with diffuse emerald clouds and mist.
  vec3 color = vec3(0.0037, 0.010, 0.0061);
  float haze = noise2(p * 0.92 + 0.17 * distortion + path2 * 0.34);
  color += vec3(0.007, 0.028, 0.013) * haze;
  color += vec3(0.022, 0.28, 0.047) * ribbon * 0.91;
  color += vec3(0.014, 0.20, 0.089) * billow * 0.68;
  float fineCloud = smoothstep(0.46, 0.75, noise2(p * 4.1 - path1 * 1.25 + distortion));
  color += vec3(0.012, 0.072, 0.032) * fineCloud * (ribbon + billow);

  // Slowly wandering emerald halos — luminous without aggressive neon.
  vec2 haloA = p - vec2(-0.51 + 0.16 * sin(t * 0.048), -0.28 + 0.12 * cos(t * 0.055));
  vec2 haloB = p - vec2(0.61 + 0.18 * cos(t * 0.042), 0.30 + 0.15 * sin(t * 0.063));
  color += vec3(0.016, 0.11, 0.020) * exp(-dot(haloA * vec2(1.0, 1.36), haloA * vec2(1.0, 1.36)) * 2.0);
  color += vec3(0.008, 0.095, 0.032) * exp(-dot(haloB, haloB) * 2.4);

  // Continuous subtle photon streams, moving independently of the clouds.
  float streamA = p.y - (0.16 * sin(p.x * 1.61 + t * 0.058) - 0.10);
  float streamB = p.y - (0.10 * sin(p.x * 1.92 - t * 0.051) + 0.28);
  float flowA = exp(-abs(streamA) * 29.0) * smoothstep(0.41, 0.77, noise2(vec2(p.x * 2.2 - t * 0.12, p.y * 3.0 + 9.1)));
  float flowB = exp(-abs(streamB) * 33.0) * smoothstep(0.45, 0.78, noise2(vec2(p.x * 2.0 + t * 0.09, p.y * 3.6 + 16.3)));
  color += vec3(0.017, 0.13, 0.043) * flowA * 0.37;
  color += vec3(0.008, 0.091, 0.032) * flowB * 0.32;

  // Three moving depth planes: remote dust, middle stars and near glints.
  vec2 starUV = p + vec2(13.1, 4.7);
  float farDust = stars(starUV, 31.0, vec2(0.007, -0.006), 4.2, 0.83);
  float midStars = stars(starUV, 19.0, vec2(-0.018, 0.011), 16.7, 0.91);
  float nearStars = stars(starUV, 10.0, vec2(0.027, 0.019), 29.8, 0.96);
  color += vec3(0.29, 0.54, 0.35) * farDust * 0.41;
  color += vec3(0.71, 0.91, 0.74) * midStars * 0.73;
  color += vec3(0.84, 1.0, 0.86) * nearStars * 0.84;

  // Calm, contrast-safe presentation rather than a saturated science-fiction game.
  color = 1.0 - exp(-color * 1.13);
  color *= 1.0 - 0.16 * smoothstep(0.42, 1.55, length(p));
  fragColor = vec4(color, 1.0);
}`;

function buildProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader unavailable');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('ZARAY galaxy shader: ' + info);
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  let fragment: WebGLShader;
  try { fragment = compile(gl.FRAGMENT_SHADER, fragmentSource); }
  catch (error) { gl.deleteShader(vertex); throw error; }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    throw new Error('WebGL program unavailable');
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('ZARAY galaxy program: ' + info);
  }
  return program;
}

export default function GalaxyBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 760px)');
    const connection = navigator as Navigator & { connection?: { saveData?: boolean } };
    const dataSaver = Boolean(connection.connection?.saveData);
    const fps = dataSaver ? 1 : mobile.matches ? 24 : (navigator.hardwareConcurrency || 4) <= 4 ? 24 : 35;
    const maxPixels = mobile.matches ? 440_000 : 950_000;

    let gl: WebGL2RenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let resolution: WebGLUniformLocation | null = null;
    let time: WebGLUniformLocation | null = null;
    let frame = 0;
    let then = 0;
    let elapsed = sharedGalaxyClock;
    let quality = 1;
    let slowFrames = 0;
    let disposed = false;
    let lost = false;
    let rendererLive = false;
    const showFallback = () => {
      rendererLive = false;
      canvas.parentElement?.setAttribute('data-zaray-galaxy-renderer','fallback');
    };
    const showWebGL = () => {
      // Switching modes changes the DOM only once, not 24–35 times per second.
      if (rendererLive) return;
      rendererLive = true;
      canvas.parentElement?.setAttribute('data-zaray-galaxy-renderer','webgl');
    };

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      then = 0;
    };
    const resize = () => {
      if (!gl || lost) return;
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, mobile.matches ? 1.0 : 1.25);
      const density = Math.min(ratio * quality, Math.sqrt(maxPixels / (width * height)));
      const w = Math.max(1, Math.round(width * density));
      const h = Math.max(1, Math.round(height * density));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const draw = (now: number) => {
      frame = 0;
      if (disposed || lost || document.hidden || !gl || !program) return;
      if (then !== 0 && now - then < 1000 / fps - 1) {
        frame = window.requestAnimationFrame(draw);
        return;
      }
      const gap = then ? Math.min(now - then, 55) : 0;
      then = now;
      if (!motionPreference.matches && !dataSaver) {
        elapsed += gap / 1000;
        sharedGalaxyClock = elapsed;
      }

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      showWebGL();

      // Decrease fill rate only after sustained slow frames; never allocate in the loop.
      if (gap > (1000 / fps) * 1.6) slowFrames += 1;
      else slowFrames = Math.max(0, slowFrames - 2);
      if (slowFrames > 90 && quality > 0.7) {
        quality = Math.max(0.7, quality - 0.12);
        slowFrames = 0;
        resize();
      }
      if (!motionPreference.matches && !dataSaver) frame = window.requestAnimationFrame(draw);
    };
    const start = () => {
      stop();
      if (!disposed && !lost && !document.hidden && gl && program) {
        frame = window.requestAnimationFrame(draw);
      }
    };
    const initialize = () => {
      if (disposed) return;
      showFallback();
      try {
        gl = canvas.getContext('webgl2', {
          alpha: false, antialias: false, depth: false, stencil: false,
          preserveDrawingBuffer: false, powerPreference: 'low-power',
        });
        if (!gl) return; // The CSS layer is a static, accessible fallback.
        program = buildProgram(gl);
        vao = gl.createVertexArray();
        resolution = gl.getUniformLocation(program, 'u_resolution');
        time = gl.getUniformLocation(program, 'u_time');
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        resize();
        start();
      } catch (error) {
        console.warn('ZARAY galaxy uses a static fallback on this device:', error);
        program = null;
        gl = null;
      }
    };
    const visibility = () => { if (document.hidden) stop(); else start(); };
    const preferenceChanged = () => {
      elapsed = motionPreference.matches ? 0 : sharedGalaxyClock;
      start();
    };
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; stop(); showFallback(); };
    const contextRestored = () => { lost = false; program = null; vao = null; initialize(); };

    initialize();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', start);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    motionPreference.addEventListener('change', preferenceChanged);

    return () => {
      disposed = true;
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('pageshow', start);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      motionPreference.removeEventListener('change', preferenceChanged);
      if (gl && !lost) {
        if (program) gl.deleteProgram(program);
        if (vao) gl.deleteVertexArray(vao);
      }
    };
  }, []);

  return <div className="zaray-galaxy-backdrop" aria-hidden="true">
    <canvas ref={canvasRef} className="zaray-galaxy-canvas" />
  </div>;
}
