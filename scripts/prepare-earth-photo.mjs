/**
 * Ships an actual NASA International Space Station photograph with ZARAY.
 * Source: NASA Johnson Space Center, ISS053-E-115170 (18 October 2017),
 * https://eol.jsc.nasa.gov/SearchPhotos/photo.pl?frame=115170&mission=ISS053&roll=E
 * NASA photography is generally public domain. Only the photo is downloaded:
 * no remote request is made when an end user visits Z'Accueil.
 *
 * Fail the build rather than silently shipping a missing background image.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = 'https://eol.jsc.nasa.gov/DatabaseImages/ESC/large/ISS053/ISS053-E-115170.JPG';
const target = join(process.cwd(), 'public', 'brand', 'earth-from-orbit-nasa.jpg');
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 25000);

try {
  const response = await fetch(origin, {
    signal: controller.signal,
    headers: { 'User-Agent': 'ZARAY/1.0 (public NASA Earth photography)' },
  });
  if (!response.ok) throw new Error('NASA HTTP ' + response.status);
  const photo = Buffer.from(await response.arrayBuffer());
  const validJpeg = photo[0] === 0xff && photo[1] === 0xd8 && photo[photo.length - 2] === 0xff && photo[photo.length - 1] === 0xd9;
  if (!validJpeg || photo.length < 75000 || photo.length > 25000000) {
    throw new Error('Invalid or incomplete NASA JPEG (' + photo.length + ' bytes)');
  }
  await mkdir(join(process.cwd(), 'public', 'brand'), { recursive: true });
  await writeFile(target, photo);
  console.log('[ZARAY Earth] Real NASA ISS photograph installed locally (' + Math.round(photo.length / 1024) + ' KiB).');
} catch (error) {
  console.error('[ZARAY Earth] NASA photography could not be downloaded. Keeping prior production untouched:', error);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
