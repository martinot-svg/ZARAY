/**
 * Z'Accueil: extract the real clouds and curved limb from the Blue Marble.
 * The supplied user image is a blue-enhanced, transparent rendering of the
 * Apollo 17 Earth view. This reproducible local variant uses the identical
 * Apollo 17 source photograph (NASA AS17-148-22727), via Wikimedia Commons.
 *
 * Source: https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17_with_transparent_background.png
 * Never invent an ellipse or overlay a rectangular sky. The file ships with
 * the application, so Z'Accueil doesn't fetch images from external websites.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const source = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/The_Earth_seen_from_Apollo_17_with_transparent_background.png/960px-The_Earth_seen_from_Apollo_17_with_transparent_background.png';
const output = join(process.cwd(), 'public', 'brand', 'zaccueil-blue-marble-limb.webp');
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
const smoothstep = t => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

try {
  const response = await fetch(source, {
    signal: controller.signal,
    headers: { 'User-Agent': 'ZARAYApp/1.0 (https://zaray.vercel.app; Earth visual source from Wikimedia Commons)' },
  });
  if (!response.ok) throw new Error('Wikimedia Apollo 17 source returned HTTP ' + response.status);
  const original = Buffer.from(await response.arrayBuffer());
  if (original.length < 100000 || original.length > 12000000) {
    throw new Error('Unexpected Blue Marble source size: ' + original.length);
  }
  // Match the framing and orbital curve of the user-supplied Earth image.
  // Stage operations separately so crop and rotation order is deterministic.
  const sized = await sharp(original)
    .resize(1254, 1254, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const turned = await sharp(sized).rotate(180).png().toBuffer();
  const { data, info } = await sharp(turned)
    .extract({ left: 620, top: 0, width: 510, height: 360 })
    .resize({ width: 600 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4 || width !== 600 || height < 400) {
    throw new Error('Unexpected transparent Earth crop shape');
  }
  const rgba = Buffer.from(data);
  // Keep natural alpha along the genuine globe rim. Feather only the bottom
  // and right file edges to avoid the harsh cuts seen in previous revisions.
  for (let y = 0; y < height; y++) {
    const bottom = 1 - smoothstep((y / (height - 1) - .81) / .19);
    for (let x = 0; x < width; x++) {
      const right = 1 - smoothstep((x / (width - 1) - .73) / .27);
      const i = (y * width + x) * 4;
      rgba[i + 3] = Math.round(rgba[i + 3] * bottom * right);
    }
  }
  const processed = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .modulate({ saturation: 1.72, brightness: 1.15 })
    .webp({ quality: 88, alphaQuality: 100, effort: 4 })
    .toBuffer();
  await mkdir(join(process.cwd(), 'public', 'brand'), { recursive: true });
  await writeFile(output, processed);
  console.log('[ZARAY Earth] Apollo 17 Blue Marble transparent crop installed:', width + 'x' + height, Math.round(processed.length / 1024) + ' KiB');
} catch (error) {
  // Production cannot be declared finished if the photographic asset fails.
  console.error('[ZARAY Earth] Failed to prepare Blue Marble horizon:', error);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
