/**
 * Build an actual equirectangular 360° Earth texture with real coastlines,
 * oceans and photographed clouds from NASA's Blue Marble satellite mosaic.
 * Source: NASA Earth Observatory, Blue Marble (2002), record 57735.
 * Sources are fetched at BUILD time. No external browser request is needed.
 * Failure aborts deployment rather than shipping a fake spinning JPEG.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const urls = [
  'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57735/land_ocean_ice_cloud_2048.jpg',
  'https://designheritage.mit.edu/_dh_debug/THREEjs_122/examples/textures/land_ocean_ice_cloud_2048.jpg',
  'https://gis.humboldt.edu/Archive/Libraries/ThreeJS/113/examples/textures/land_ocean_ice_cloud_2048.jpg',
];
const out = join(process.cwd(), 'public', 'brand', 'zaccueil-earth-spherical-texture.webp');

async function download(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ZARAY/1.0 (NASA Blue Marble Earth visual)' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 110000 || bytes.length > 8000000) throw new Error('Unexpected image size');
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== 2048 || metadata.height !== 1024) {
      throw new Error('Source must be 2048x1024 equirectangular, got ' + metadata.width + 'x' + metadata.height);
    }
    return bytes;
  } finally {
    clearTimeout(timer);
  }
}

let raw;
let sourceUrl;
for (const url of urls) {
  try {
    raw = await download(url);
    sourceUrl = url;
    break;
  } catch (error) {
    console.warn('[ZARAY rotating Earth] Image source unavailable:', url, String(error));
  }
}
if (!raw) {
  console.error('[ZARAY rotating Earth] NASA atlas unavailable. Declining to publish a static/fake rotation.');
  process.exitCode = 1;
} else {
  try {
    const compressed = await sharp(raw)
      .webp({ quality: 91, effort: 4 })
      .toBuffer();
    const metadata = await sharp(compressed).metadata();
    if (metadata.width !== 2048 || metadata.height !== 1024) throw new Error('Invalid encoded atlas');
    await mkdir(join(process.cwd(), 'public', 'brand'), { recursive: true });
    await writeFile(out, compressed);
    console.log('[ZARAY rotating Earth] 2048x1024 NASA texture ready:', Math.round(compressed.length/1024) + ' KiB from ' + sourceUrl);
  } catch (error) {
    console.error('[ZARAY rotating Earth] Could not prepare globe texture:', error);
    process.exitCode = 1;
  }
}
