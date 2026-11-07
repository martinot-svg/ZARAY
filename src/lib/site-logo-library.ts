import 'server-only';
import sharp from 'sharp';
import {createServiceClient} from '@/lib/supabase/service';

export const SITE_LOGO_BUCKET='zaray-site-logo-originals';
const PNG_LIMIT=15*1024*1024;
const SVG_LIMIT=2*1024*1024;
// Decoder/memory safety budget, not an arbitrary width or height cap.
const MAX_DECODE_PIXELS=32_000_000;
const PREVIEW_LIMIT=175000;
export type LogoVariant='light'|'dark';
export type StoredLogo={path:string;preview:string;cropped:boolean;format:'png'|'webp'|'svg';width:number;height:number};

export function allowedLogoFile(name:string,mime:string,bytes:number){
 const extension=name.toLowerCase().match(/\.(png|webp|svg)$/)?.[1];
 const types:Record<string,string>={png:'image/png',webp:'image/webp',svg:'image/svg+xml'};
 const max=extension==='svg'?SVG_LIMIT:PNG_LIMIT;
 if(!extension||types[extension]!==mime)throw Error('Format non accepté : veuillez importer un fichier PNG ou SVG compatible (WebP transparent accepté).');
 if(!Number.isInteger(bytes)||bytes<16||bytes>max)throw Error('Fichier trop volumineux : limite 15 Mo pour PNG/WebP ou 2 Mo pour SVG.');
 return {extension:extension as 'png'|'webp'|'svg',max};
}

function safeSvg(buffer:Buffer):Buffer{
 let contents:string;
 try{contents=new TextDecoder('utf-8',{fatal:true}).decode(buffer).replace(/^\uFEFF/,'');}
 catch{throw Error('Fichier invalide : encodage SVG illisible.');}
 // SVG originals are never served to a public browser: only sanitized content
 // is rasterized by Sharp and private originals remain unmodified.
 contents=contents.replace(/<!--[\s\S]*?-->/g,'').replace(/^\s*<\?xml[^?]*\?>\s*/i,'').trim();
 const forbidden=/<!(?:DOCTYPE|ENTITY)|<!\[|<\?|<\s*\/?\s*(?:script|foreignObject|iframe|image|use|animate|set|animateMotion|animateTransform|style|filter|fe[a-z]+|video|audio|object|embed)\b|\bon[a-z][\w-]*\s*=|\b(?:href|src|xlink:href|style)\s*=|\b(?:javascript:|data:|@import|expression\s*\(|url\s*\()/i;
 if(forbidden.test(contents)||/&(?!(?:amp|lt|gt|quot|apos);)/i.test(contents))
  throw Error('SVG non sécurisé : scripts, références externes ou contenus actifs interdits.');
 if(!/^<svg\b[\s\S]*<\/svg>\s*$/i.test(contents))throw Error('Fichier SVG invalide.');
 const allowed=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','lineargradient','radialgradient','stop','clippath','text','tspan','title','desc']);
 for(const match of contents.matchAll(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)\b/g)){
  if(!allowed.has(match[1].toLowerCase()))throw Error('SVG non sécurisé : balise non autorisée.');
 }
 // The output SVG is only ever passed to a raster decoder; preserve its
 // vector geometry in the private source file, never render it as public HTML.
 return Buffer.from(contents,'utf8');
}
function verifySignature(bytes:Buffer,extension:string){
 if(extension==='png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
  throw Error('Fichier PNG invalide : signature non reconnue.');
 if(extension==='webp'&&!(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'))
  throw Error('Fichier WebP invalide : signature non reconnue.');
}
export async function processSiteLogoFile(bytes:Buffer,originalName:string,mime:string){
 const {extension}=allowedLogoFile(originalName,mime,bytes.length);
 verifySignature(bytes,extension);
 const source=extension==='svg'?safeSvg(bytes):bytes;
 const settings={limitInputPixels:MAX_DECODE_PIXELS,failOn:'error' as const,density:144};
 let meta:sharp.Metadata;
 try{meta=await sharp(source,settings).metadata();}
 catch{throw Error('Fichier invalide : impossible de lire ou traiter ce fichier.');}
 const width=meta.width||0,height=meta.height||0;
 if(!width||!height||width*height>MAX_DECODE_PIXELS)
  throw Error('Logo trop complexe pour un décodage sécurisé. Réduisez la résolution du fichier source.');
 if(!meta.hasAlpha)throw Error('Arrière-plan non transparent : un canal alpha réel est obligatoire.');
 let alpha:Buffer;
 try{alpha=await sharp(source,settings).ensureAlpha().extractChannel('alpha').raw().toBuffer();}
 catch{throw Error('Impossible de vérifier la transparence du logo.');}
 let left=width,top=height,right=-1,bottom=-1,transparent=false;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const a=alpha[y*width+x];
  if(a<255)transparent=true;
  if(a===0)continue;
  if(x<left)left=x;
  if(y<top)top=y;
  if(x>right)right=x;
  if(y>bottom)bottom=y;
 }
 if(!transparent)throw Error('Arrière-plan non transparent : votre logo doit posséder un fond transparent.');
 if(right<left)throw Error('Fichier invalide : aucun dessin visible.');
 // Two pixels of safety preserve delicate border detail. Inner transparent
 // holes are never touched and alpha 1–254 remains visible artwork.
 const x=Math.max(0,left-2),y=Math.max(0,top-2);
 const bounds={left:x,top:y,width:Math.min(width,right+3)-x,height:Math.min(height,bottom+3)-y};
 const cropped=bounds.width<width||bounds.height<height;
 for(const side of [2560,2048,1600,1280,1024,768,640,480,360,256,192]){
  const image=sharp(source,settings).extract(bounds);
  const render=Math.max(bounds.width,bounds.height)>side
   ?image.resize({width:side,height:side,fit:'inside',withoutEnlargement:true}):image;
  let preview:Buffer;
  try{preview=await render.png({compressionLevel:9,palette:false}).toBuffer();}
  catch{throw Error('Fichier invalide : impossible de traiter ce fichier.');}
  const uri='data:image/png;base64,'+preview.toString('base64');
  if(uri.length<=PREVIEW_LIMIT)
   return {preview:uri,cropped,format:extension,width:bounds.width,height:bounds.height};
 }
 throw Error('Logo trop complexe pour l’affichage du portail. L’original reste préservé.');
}
export function isOwnLogoPath(path:string,companyId:string,userId:string){
 return path.startsWith(companyId+'/'+userId+'/')
  &&new RegExp('^'+companyId+'/'+userId+'/[0-9a-f]{8}-[0-9a-f-]{27,30}\\.(png|webp|svg)$','i').test(path);
}
export async function processStoredSiteLogo(
 service:NonNullable<ReturnType<typeof createServiceClient>>,
 path:string,companyId:string,userId:string):Promise<StoredLogo>{
 if(!isOwnLogoPath(path,companyId,userId))throw Error('Logo extérieur à cette entreprise ou à cet utilisateur.');
 const file=await service.storage.from(SITE_LOGO_BUCKET).download(path);
 if(file.error||!file.data)throw Error('Original du logo introuvable. Recommencez l’importation.');
 const ext=path.split('.').pop()||'';
 const mime=ext==='png'?'image/png':ext==='webp'?'image/webp':'image/svg+xml';
 const bytes=Buffer.from(await file.data.arrayBuffer());
 const result=await processSiteLogoFile(bytes,'source.'+ext,mime);
 return {path,...result};
}
