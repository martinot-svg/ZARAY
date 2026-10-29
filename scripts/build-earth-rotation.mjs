/**
 * Source-backed, independent Earth surface and cloud maps for Z'Accueil.
 *
 * NASA Blue Marble (2002), Goddard Space Flight Center:
 * - cloud-free land/ocean/sea-ice: record 57730
 * - global cloud mosaic: record 57747
 *
 * The 2048x1024 atlases use matching equirectangular coordinates.
 * We download at BUILD time; the app fetches ONLY same-origin .webp assets.
 * Failure to obtain either source fails the build rather than masquerading
 * composite/fixed clouds as animated ones.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const sources = [
  {
    name: 'cloud-free surface',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg',
    dest: 'zaccueil-earth-land-texture.webp',
    quality: 90,
  },
  {
    name: 'cloud coverage',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg',
    dest: 'zaccueil-earth-clouds-texture.webp',
    quality: 94,
  },
];

async function download(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ZARAY/1.0 (NASA Blue Marble Earth visual)' },
    });
    if (!response.ok) throw new Error(source.name + ': HTTP ' + response.status);
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length < 50000 || raw.length > 10000000) throw new Error(source.name + ': unexpected file size');
    const metadata = await sharp(raw).metadata();
    if (metadata.width !== 2048 || metadata.height !== 1024) {
      throw new Error(source.name + ': expected 2048 x 1024 equirectangular map; got ' + metadata.width + 'x' + metadata.height);
    }
    return raw;
  } finally {
    clearTimeout(timeout);
  }
}

try {
  // Fail atomically if either atlas is unavailable or invalid.
  const atlases = await Promise.all(sources.map(async source => {
    const bytes = await download(source);
    const webp = await sharp(bytes).webp({ quality: source.quality, effort: 4 }).toBuffer();
    const metadata = await sharp(webp).metadata();
    if (metadata.width !== 2048 || metadata.height !== 1024) {
      throw new Error('Unexpected encoded dimensions for ' + source.name);
    }
    return { source, webp };
  }));

  await mkdir(join(process.cwd(), 'public', 'brand'), { recursive: true });
  for (const { source, webp } of atlases) {
    await writeFile(join(process.cwd(), 'public', 'brand', source.dest), webp);
    console.log('[ZARAY Earth] NASA ' + source.name + ': 2048x1024, ' + Math.round(webp.length / 1024) + ' KiB');
  }
} catch (error) {
  console.error('[ZARAY Earth] Source-backed clouds build failed:', error);
  process.exitCode = 1;
}
