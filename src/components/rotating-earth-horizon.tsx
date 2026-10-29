'use client';

import { useEffect, useRef } from 'react';
import firstFrame from './earth-first-frame.module.css';
import EarthSatellites from './earth-satellites';

/**
 * A true textured 3D globe with a separate, subtly moving cloud layer.
 * Never rotate a flat photo. Decorative and limited to Z'Accueil.
 *
 * NASA Blue Marble (2002): cloud-free continents and photographed cloud cover
 * are bundled as separate local maps at build time. They are historic satellite
 * composites, NOT live meteorological data. The relative drift is a visual
 * time-lapse of atmospheric circulation, not a forecast.
 * The 3D Earth's existing 240-second revolution and framing are unchanged.
 */
const REVOLUTION_MS = 240_000;
// Clouds move relative to the land: a deliberately subtle 12-min full drift.
// This is artistic time-lapse, not the real speed or direction of local winds.
const CLOUD_DRIFT_MS = 720_000;
const FRAME_INTERVAL_MS = 1000 / 30;
const LAND_TEXTURE_URL = '/brand/zaccueil-earth-land-texture.webp';
const CLOUD_TEXTURE_URL = '/brand/zaccueil-earth-clouds-texture.webp';

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vPoint;
void main() {
  vPoint = aPosition;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

varying vec2 vPoint;
uniform sampler2D uEarth;
uniform sampler2D uClouds;
uniform float uRotation;
uniform float uCloudDrift;

const float PI = 3.141592653589793;
const float TWO_PI = 6.283185307179586;

void main() {
  // Orthographic projection: camera looking straight at a 3D sphere.
  float radius2 = dot(vPoint, vPoint);
  if (radius2 >= 1.0) discard;
  float z = sqrt(max(0.0, 1.0 - radius2));
  vec3 viewNormal = vec3(vPoint.xy, z);

  // 23.4° axial inclination: the equator and clouds are not static stripes.
  const float tilt = 0.4084;
  vec3 surface = vec3(
    viewNormal.x,
    viewNormal.y * cos(tilt) - viewNormal.z * sin(tilt),
    viewNormal.y * sin(tilt) + viewNormal.z * cos(tilt)
  );

  // The longitude changes continuously; every pixel samples a different
  // part of the REAL 360-degree NASA atlas as the planet rotates.
  float longitude = atan(surface.x, surface.z);
  float latitude = asin(clamp(surface.y, -1.0, 1.0));
  vec2 uv = vec2(fract(0.5 + longitude / TWO_PI + uRotation),
                 0.5 + latitude / PI);

  // Cloud-free NASA surface rotates with the Earth.
  vec3 earth = texture2D(uEarth, uv).rgb;
  float diffuse = max(dot(viewNormal, normalize(vec3(-0.42, 0.46, 0.76))), 0.0);
  earth *= 0.59 + 0.41 * diffuse;
  earth = pow(earth, vec3(0.95));

  // A separate photographic cloud mosaic drifts across the continents.
  // Latitude-dependent zonal motion avoids a rigid, sticker-like overlay.
  // The simulated offset is deliberately time-lapsed and is NOT live weather.
  float latitudeWind = 0.75 + 0.18 * sin(latitude * 5.5);
  vec2 cloudUV = vec2(fract(uv.x + uCloudDrift * latitudeWind), uv.y);
  float cloudBrightness = texture2D(uClouds, cloudUV).r;
  float cloudOpacity = smoothstep(0.08, 0.80, cloudBrightness) * 0.86;
  vec3 litClouds = vec3(0.76, 0.86, 0.96) * (0.73 + 0.27 * diffuse);
  earth = mix(earth, litClouds, cloudOpacity);

  // A very thin blue atmospheric limb; never a rectangular background.
  float atmosphere = pow(1.0 - z, 7.0);
  earth += vec3(0.075, 0.34, 0.72) * atmosphere * 0.50;
  float radius = sqrt(radius2);
  float alpha = 1.0 - smoothstep(0.980, 1.0, radius);
  gl_FragColor = vec4(earth, alpha);
}
`;

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

export default function RotatingEarthHorizon() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      powerPreference: 'low-power',
    });
    if (!gl) return; // Existing HD transparent Earth remains the fallback.

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const coords = gl.createBuffer();
    const landTexture = gl.createTexture();
    const cloudTexture = gl.createTexture();
    if (!coords || !landTexture || !cloudTexture) return;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, coords);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    const uRotation = gl.getUniformLocation(program, 'uRotation');
    const uCloudDrift = gl.getUniformLocation(program, 'uCloudDrift');
    const uEarth = gl.getUniformLocation(program, 'uEarth');
    const uClouds = gl.getUniformLocation(program, 'uClouds');
    gl.uniform1i(uEarth, 0);
    gl.uniform1i(uClouds, 1);

    let disposed = false;
    let visible = true;
    let reducedMotion = false;
    let loaded = false;
    let animationId = 0;
    let lastTime = 0;
    let lastDraw = 0;
    let accumulatedMs = 0;

    const resize = () => {
      const diameter = Math.max(1, container.clientWidth);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      // Preserve the cloud and coastal detail on the enlarged 1185px globe.
      const deviceSize = Math.min(1536, Math.round(diameter * pixelRatio));
      if (canvas.width !== deviceSize || canvas.height !== deviceSize) {
        canvas.width = deviceSize;
        canvas.height = deviceSize;
        gl.viewport(0, 0, deviceSize, deviceSize);
      }
    };

    const draw = () => {
      if (!loaded || disposed) return;
      resize();
      gl.useProgram(program);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Begin over Africa/Indian Ocean like the user's Blue Marble reference.
      const orbit = (0.565 + accumulatedMs / REVOLUTION_MS) % 1;
      gl.uniform1f(uRotation, orbit);
      gl.uniform1f(uCloudDrift, (accumulatedMs / CLOUD_DRIFT_MS) % 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const frame = (now: number) => {
      animationId = 0;
      if (disposed || document.hidden || !visible || reducedMotion || !loaded) return;
      if (lastTime) accumulatedMs += Math.min(now - lastTime, 100);
      lastTime = now;
      if (now - lastDraw >= FRAME_INTERVAL_MS) {
        draw();
        lastDraw = now;
      }
      animationId = requestAnimationFrame(frame);
    };

    const syncMotion = () => {
      if (disposed) return;
      if (animationId) cancelAnimationFrame(animationId);
      animationId = 0;
      lastTime = 0;
      if (loaded) draw();
      if (loaded && !document.hidden && visible && !reducedMotion) {
        animationId = requestAnimationFrame(frame);
      }
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => {
      reducedMotion = motionQuery.matches;
      syncMotion();
    };
    reducedMotion = motionQuery.matches;
    motionQuery.addEventListener('change', onMotionChange);
    document.addEventListener('visibilitychange', syncMotion);
    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      syncMotion();
    }, { threshold: 0.01 });
    intersectionObserver.observe(container);

    // Only reveal the WebGL globe once BOTH maps are ready, avoiding brief
    // white/black flashes and ghost clouds baked onto the continents.
    const images = [new Image(), new Image()];
    const textures = [landTexture, cloudTexture];
    const urls = [LAND_TEXTURE_URL, CLOUD_TEXTURE_URL];
    let pending = images.length;
    let failed = false;
    images.forEach((image, index) => {
      image.onload = () => {
        if (disposed || failed) return;
        gl.activeTexture(index === 0 ? gl.TEXTURE0 : gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures[index]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        pending -= 1;
        if (pending === 0) {
          loaded = true;
          draw();
          container.dataset.earthReady = 'true';
          syncMotion();
        }
      };
      image.onerror = () => {
        // If one map is missing, keep the original HD globe as fallback.
        failed = true;
        if (!disposed) container.dataset.earthReady = 'false';
      };
      image.src = urls[index];
    });

    return () => {
      disposed = true;
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
      }
      if (animationId) cancelAnimationFrame(animationId);
      motionQuery.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', syncMotion);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      container.dataset.earthReady = 'false';
      gl.deleteTexture(landTexture);
      gl.deleteTexture(cloudTexture);
      gl.deleteBuffer(coords);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  // The server renders a baked first frame immediately. The CSS module's
  // tiny inline WebP displays before hydration or ANY image request, while
  // the priority still loads the matching high-definition frame. The WebGL
  // canvas transitions on top only after both atlas textures are ready.
  return <div ref={containerRef} className={'zaray-earth-horizon ' + firstFrame.preview}
    data-earth-ready="false" aria-hidden="true">
    <img className="zaray-earth-hd-still"
      src="/brand/zaccueil-earth-instant-still.webp" alt=""
      fetchPriority="high" loading="eager" decoding="async" draggable={false} />
    <canvas ref={canvasRef} className="zaray-rotating-earth-canvas" />
    <EarthSatellites />
  </div>;
}
