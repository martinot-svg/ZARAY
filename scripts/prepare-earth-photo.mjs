/**
 * True photographic, transparent-background Earth for Z’Accueil.
 * Image: NASA JSC, ISS053-E-115170 (2017-10-18), actual ISS orbital photograph.
 * NASA provenance: https://eol.jsc.nasa.gov/SearchPhotos/photo.pl?frame=115170&mission=ISS053&roll=E
 * The sky is removed from the image pixels; there is no rectangular image
 * background, no CSS-generated planet, and no artificially clipped vector rim.
 * Vercel builds bundle the finished RGBA WebP so viewers make no remote calls.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const source = 'https://eol.jsc.nasa.gov/DatabaseImages/ESC/large/ISS053/ISS053-E-115170.JPG';
const output = join(process.cwd(), 'public', 'brand', 'earth-horizon-transparent.webp');
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30000);
const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x*x*(3-2*x); };

try {
  const response = await fetch(source, {
    signal: controller.signal,
    headers: { 'User-Agent': 'ZARAY/1.0 NASA-Earth-Background' },
  });
  if (!response.ok) throw new Error('NASA image HTTP ' + response.status);
  const jpeg = Buffer.from(await response.arrayBuffer());
  if (jpeg.length < 75000 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error('NASA source photo is incomplete or is not JPEG');
  }

  const { data, info } = await sharp(jpeg)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (width < 640 || height < 300 || channels !== 3) {
    throw new Error('Unexpected NASA photo dimensions/channels');
  }

  // For each horizontal position, locate the photographic boundary where
  // continuous bright clouds/ocean/atmosphere replace the nearly black space.
  // Several neighboring pixel groups must be bright: isolated stars are ignored.
  const step = 6, candidate = [];
  for (let x = 0; x < width; x += step) {
    let found = -1;
    for (let y = 8; y < height - 32; y += 3) {
      let bright = 0, sum = 0;
      for (const dx of [-12, 0, 12]) for (const dy of [0, 9, 18, 27]) {
        const xx = Math.max(0, Math.min(width-1, x+dx));
        const i = ((y+dy)*width+xx)*3;
        const lum = data[i]*.23+data[i+1]*.58+data[i+2]*.19;
        sum += lum;
        if (lum > 41 && data[i+2] > 32) bright++;
      }
      if (bright >= 9 && sum/12 > 46) { found = y; break; }
    }
    candidate.push(found);
  }

  const present = candidate.filter(v => v >= 0).sort((a,b) => a-b);
  if (present.length < candidate.length*.6) {
    throw new Error('Could not reliably isolate the real Earth horizon; refusing to ship an opaque or clipped photo');
  }
  const medianAll = present[Math.floor(present.length/2)];
  // A moving median rejects occasional bright artifacts in deep space while
  // respecting the natural curve, unlike a straight artificial SVG arc.
  const cleaned = candidate.map((_,i)=>{
    const local=[];
    for(let k=Math.max(0,i-8);k<=Math.min(candidate.length-1,i+8);k++){
      if(candidate[k]>=0)local.push(candidate[k]);
    }
    if(local.length<5)return medianAll;
    local.sort((a,b)=>a-b);
    return local[Math.floor(local.length/2)];
  });
  const edge = new Float32Array(width);
  for(let x=0;x<width;x++){
    const q=x/step, base=Math.floor(q), ratio=q-base;
    const y0=cleaned[Math.min(cleaned.length-1,base)];
    const y1=cleaned[Math.min(cleaned.length-1,base+1)];
    edge[x]=y0+(y1-y0)*ratio;
  }

  const rgba = Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    const i=(y*width+x)*3, o=(y*width+x)*4;
    rgba[o]=data[i];rgba[o+1]=data[i+1];rgba[o+2]=data[i+2];
    // Keep the atmospheric halo and all visible surface pixels, with a
    // softly feathered boundary following the real photo, not a drawn curve.
    const surface=smooth((y-edge[x]+21)/32);
    // Fade out well before the physical file's right edge, so NO vertical cut.
    const right=1-smooth((x/width-.68)/.32);
    // A tiny feather prevents the source file's outermost row being visible.
    const bottom=1-smooth((y/height-.965)/.035);
    rgba[o+3]=Math.round(255*surface*right*bottom);
  }
  await mkdir(join(process.cwd(), 'public', 'brand'), { recursive: true });
  const image = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .webp({ quality: 91, effort: 5, alphaQuality: 100 })
    .toBuffer();
  await writeFile(output, image);
  const minEdge=Math.round(Math.min(...cleaned)),maxEdge=Math.round(Math.max(...cleaned));
  console.log('[ZARAY Earth] Transparent RGBA real NASA horizon built:', width+'x'+height,
    Math.round(image.length/1024)+'KiB', 'photographic edge', minEdge+'–'+maxEdge+'px');
} catch(error) {
  console.error('[ZARAY Earth] Cannot prepare authentic transparent horizon:', error);
  process.exitCode = 1;
} finally { clearTimeout(timer); }
