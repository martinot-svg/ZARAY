/**
 * Generate Z'Accueil's instant, geographically consistent first frame.
 *
 * The shader's starting camera orientation, clouds, illumination, and alpha
 * are baked into a transparent 1024px image at BUILD time. A small WebP is
 * inlined in a CSS module, making the planet visible on the very first CSS
 * paint without fetching ANY image, executing JavaScript, or creating WebGL.
 * A full-size, high-priority same-origin image replaces the tiny first paint
 * while both NASA atlases are loading; the animated canvas then crossfades in.
 *
 * NASA Blue Marble surface/cloud maps, already downloaded by build-earth-rotation.
 * The illustration is a static historical satellite-based composite, not weather.
 */
import sharp from 'sharp';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';

const root = process.cwd();
const path = name => join(root, 'public', 'brand', name);
const cssPath = join(root, 'src', 'components', 'earth-first-frame.module.css');
const atlasNames = ['zaccueil-earth-land-texture.webp', 'zaccueil-earth-clouds-texture.webp'];
const OUT_SIZE = 1024;
const PI = Math.PI;
const TWO_PI = 2 * PI;
const TILT = 0.4084;
const START_ROTATION = 0.565;
const SUN = [-0.42, 0.46, 0.76];
const SUN_LENGTH = Math.hypot(...SUN);

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const fract = x => x - Math.floor(x);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

async function readAtlas(name) {
  const { data, info } = await sharp(path(name))
    .removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 2048 || info.height !== 1024 || info.channels !== 3) {
    throw new Error(name + ': unexpected atlas format');
  }
  return data;
}

function getPixel(raw, u, v) {
  const x = clamp(Math.round(fract(u) * 2047), 0, 2047);
  const y = clamp(Math.round((1 - v) * 1023), 0, 1023);
  const index = (y * 2048 + x) * 3;
  return [raw[index] / 255, raw[index + 1] / 255, raw[index + 2] / 255];
}

try {
  const [land, clouds] = await Promise.all(atlasNames.map(readAtlas));
  const pixels = Buffer.alloc(OUT_SIZE * OUT_SIZE * 4);
  for (let y = 0; y < OUT_SIZE; y++) {
    const ny = 1 - 2 * (y + 0.5) / OUT_SIZE;
    for (let x = 0; x < OUT_SIZE; x++) {
      const nx = 2 * (x + 0.5) / OUT_SIZE - 1;
      const offset = (y * OUT_SIZE + x) * 4;
      const r2 = nx * nx + ny * ny;
      if (r2 >= 1) continue;
      const z = Math.sqrt(1 - r2);
      const sy = ny * Math.cos(TILT) - z * Math.sin(TILT);
      const sz = ny * Math.sin(TILT) + z * Math.cos(TILT);
      const longitude = Math.atan2(nx, sz);
      const latitude = Math.asin(clamp(sy, -1, 1));
      const u = fract(0.5 + longitude / TWO_PI + START_ROTATION);
      const v = 0.5 + latitude / PI;
      const rgb = getPixel(land, u, v);
      const cloudBrightness = getPixel(clouds, u, v)[0];
      const diffuse = Math.max(0, (nx * SUN[0] + ny * SUN[1] + z * SUN[2]) / SUN_LENGTH);
      const cloudOpacity = smoothstep(0.08, 0.80, cloudBrightness) * 0.86;
      const atmosphere = Math.pow(1 - z, 7) * 0.5;
      const litCloud = [0.76, 0.86, 0.96].map(c => c * (0.73 + 0.27 * diffuse));
      const atmoColor = [0.075, 0.34, 0.72];
      for (let i = 0; i < 3; i++) {
        const surface = Math.pow(rgb[i] * (0.59 + 0.41 * diffuse), 0.95);
        const value = surface * (1 - cloudOpacity) + litCloud[i] * cloudOpacity + atmoColor[i] * atmosphere;
        pixels[offset + i] = Math.round(255 * clamp(value, 0, 1));
      }
      const alpha = 1 - smoothstep(0.980, 1, Math.sqrt(r2));
      pixels[offset + 3] = Math.round(255 * alpha);
    }
  }

  const full = await sharp(pixels, { raw: { width: OUT_SIZE, height: OUT_SIZE, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100, effort: 4 }).toBuffer();
  const stillFile = 'zaccueil-earth-instant-still.webp';
  await writeFile(path(stillFile), full);

  const tiny = await sharp(full)
    .resize(144, 144, { kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 67, alphaQuality: 90, effort: 5 }).toBuffer();
  const base64 = tiny.toString('base64');
  const css = [
    '/* Generated from NASA Blue Marble maps by scripts/build-earth-first-frame.mjs.',
    '   This tiny image is IN the CSS: the Earth is visible on first paint.',
    '   The same shader camera and cloud composition are used by WebGL. */',
    '.preview {',
    '  --zaray-earth-first-frame: url("data:image/webp;base64,' + base64 + '");',
    '}',
    '',
  ].join('\n');
  await writeFile(cssPath, css);
  console.log('[ZARAY Earth] Instant first frame: 1024x1024, ' +
    Math.round(full.length / 1024) + ' KiB; inlined CSS preview ' +
    Math.round(tiny.length / 1024) + ' KiB');
} catch (error) {
  console.error('[ZARAY Earth] Could not build first-paint atlas preview:', error);
  process.exitCode = 1;
}
