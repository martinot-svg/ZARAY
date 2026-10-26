import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/** Reject substituted/transformed artwork; never modify the supplied files. */
const assets = [
  {
    path: 'public/brand/zaray-noir-vert-original.png',
    sha256: '4c7615f63f466d10baf4ec955a1562a17fa0e99a861c84b7a69bc4c57271326f',
    width: 2048,
    height: 746,
  },
  {
    path: 'public/brand/zaray-blanc-vert-original.png',
    sha256: '258c67cadb203f207958af93b96fa47be5971a1fc31283d5fec1f9d86a474140',
    width: 2048,
    height: 682,
  },
];

for (const asset of assets) {
  const path = join(process.cwd(), asset.path);
  let bytes;
  try { bytes = await readFile(path); }
  catch { throw new Error('Fichier officiel ZARAY absent : ' + asset.path); }
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== asset.sha256) throw new Error('Logo ZARAY modifié ou incorrect : ' + asset.path);
  if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('PNG invalide : ' + asset.path);
  if (bytes.readUInt32BE(16) !== asset.width || bytes.readUInt32BE(20) !== asset.height)
    throw new Error('Dimensions du logo incorrectes : ' + asset.path);
  if (bytes[25] !== 6) throw new Error('PNG sans canal alpha : ' + asset.path);
}
console.log('Logos ZARAY officiels vérifiés, aucune transformation.');
