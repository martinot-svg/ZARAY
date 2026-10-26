import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** ICO file with embedded 16, 32 and 48 px transparent PNG images (no extra dependency). */
const root = process.cwd();
const sizes = [16, 32, 48];
const bitmaps = await Promise.all(sizes.map(size => readFile(join(root, 'public', `favicon-${size}x${size}.png`))));
const count = sizes.length;
const directory = Buffer.alloc(6 + 16 * count);
directory.writeUInt16LE(0, 0);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(count, 4);
let offset = directory.length;
for (let index = 0; index < count; index++) {
  const position = 6 + index * 16;
  directory.writeUInt8(sizes[index], position);
  directory.writeUInt8(sizes[index], position + 1);
  directory.writeUInt8(0, position + 2);
  directory.writeUInt8(0, position + 3);
  directory.writeUInt16LE(1, position + 4);
  directory.writeUInt16LE(32, position + 6);
  directory.writeUInt32LE(bitmaps[index].length, position + 8);
  directory.writeUInt32LE(offset, position + 12);
  offset += bitmaps[index].length;
}
const icon = Buffer.concat([directory, ...bitmaps]);
await mkdir(join(root, 'src', 'app'), { recursive: true });
await writeFile(join(root, 'src', 'app', 'favicon.ico'), icon);
await writeFile(join(root, 'public', 'favicon.ico'), icon);
