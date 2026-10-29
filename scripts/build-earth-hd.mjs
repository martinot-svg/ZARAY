/**
 * Prepare a high-density image for Z'Accueil from the transparent Earth
 * photograph supplied by the user and already committed to the repository.
 *
 * Display improvements: Lanczos3 2x resampling, gentle sharpening, high
 * quality WebP with full alpha fidelity, and consistent output selection.
 *
 * This improves raster smoothness on dense screens; it does NOT invent new
 * photographic detail beyond the source's native 624 x 587 pixels.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const source = join(process.cwd(), 'public', 'brand', 'zaccueil-earth-from-user-hd.avif');
const destination = join(process.cwd(), 'public', 'brand', 'zaccueil-earth-render-2x.webp');

try {
  const metadata = await sharp(source).metadata();
  if (metadata.width !== 624 || metadata.height !== 587 || !metadata.hasAlpha) {
    throw new Error('Unexpected Earth source size or missing transparent alpha channel');
  }
  await mkdir(join(process.cwd(), 'public', 'brand'), { recursive: true });

  const output = await sharp(source)
    .resize({
      width: metadata.width * 2,
      height: metadata.height * 2,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: 0.72, m1: 0.45, m2: 1.35 })
    .webp({ quality: 96, alphaQuality: 100, effort: 5 })
    .toBuffer();

  await writeFile(destination, output);
  const target = await sharp(output).metadata();
  if (target.width !== 1248 || target.height !== 1174 || !target.hasAlpha) {
    throw new Error('HD export validation failed: dimensions or transparency changed');
  }
  console.log('[ZARAY Earth] High-density transparent rendering:', target.width + 'x' + target.height, Math.round(output.length / 1024) + ' KiB');
} catch (error) {
  console.error('[ZARAY Earth] Unable to create HD Z’Accueil image:', error);
  process.exitCode = 1;
}
