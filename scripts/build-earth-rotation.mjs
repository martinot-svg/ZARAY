/**
 * ZARAY Earth: NASA Blue Marble 2048x1024 textures.
 * Prefer an immutable, pinned public GitHub mirror and validate its Git blob
 * SHA-1. Fall back to the original NASA source when needed.
 * No secrets, router credentials or customer data are processed here.
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const pinnedMirror = 'https://raw.githubusercontent.com/Depal-Jakub/orbital-bloom/887e86895ce3ba18c2e4949a9e4fe77df9bbbf30/public/assets';
const mirror = process.env.ZARAY_ASSET_MIRROR || pinnedMirror;
const sources = [
  {
    name: 'cloud-free surface',
    dest: 'zaccueil-earth-land-texture.webp',
    quality: 90,
    locations: [
      { url: `${mirror}/earth-day-2048.jpg`, blobSha: 'bb5f75df5eba852ed6372b3859a9871318f4693a' },
      { url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg' },
    ],
  },
  {
    name: 'cloud coverage',
    dest: 'zaccueil-earth-clouds-texture.webp',
    quality: 94,
    locations: [
      { url: `${mirror}/earth-clouds-2048.jpg`, blobSha: '86d8b2d16dbafbcb1aa5cd996cbab2b0afc9606b' },
      { url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg' },
    ],
  },
];

async function download(source) {
  const failures = [];
  for (const location of source.locations) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(location.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ZARAY/1.0 (NASA Blue Marble Earth visual)' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length < 50000 || raw.length > 10000000) throw new Error('Unexpected file size');
      if (location.blobSha) {
        const gitBlobHash = createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex');
        if (gitBlobHash !== location.blobSha) throw new Error('Pinned mirror integrity mismatch');
      }
      const metadata = await sharp(raw).metadata();
      if (metadata.width !== 2048 || metadata.height !== 1024) {
        throw new Error(`Invalid size: ${metadata.width}x${metadata.height}`);
      }
      return raw;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`NASA ${source.name} unavailable: ${failures.join(' | ')}`);
}

try {
  const atlases = await Promise.all(sources.map(async source => {
    const raw = await download(source);
    const webp = await sharp(raw).webp({ quality: source.quality, effort: 4 }).toBuffer();
    const metadata = await sharp(webp).metadata();
    if (metadata.width !== 2048 || metadata.height !== 1024) {
      throw new Error('Invalid encoded atlas dimensions for ' + source.name);
    }
    return { source, webp };
  }));
  await mkdir(join(process.cwd(), 'public', 'brand'), { recursive: true });
  for (const { source, webp } of atlases) {
    await writeFile(join(process.cwd(), 'public', 'brand', source.dest), webp);
    console.log('[ZARAY Earth] ' + source.name + ': 2048x1024, ' + Math.round(webp.length / 1024) + ' KiB');
  }
} catch (error) {
  console.error('[ZARAY Earth] Validated source textures unavailable:', error);
  process.exitCode = 1;
}
