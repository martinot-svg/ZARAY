/**
 * Automatic transparent-margin trimming for site logos.
 *
 * The administrator supplies a logo whose background is already transparent.
 * We never infer colors to delete, segment artwork or create transparency.
 * Only fully transparent (alpha = 0) rows/columns around existing artwork
 * are removed. Semi-transparent shadows and anti-aliased pixels are kept.
 */
export type LogoBounds={x:number;y:number;width:number;height:number};
export type LogoAnalysis={bounds:LogoBounds;hasTransparency:boolean;cropped:boolean};
export type OptimizedLogo={dataUri:string;cropped:boolean;optimized:boolean};

export function analyzeTransparentLogoPixels(data:Uint8ClampedArray,width:number,height:number):LogoAnalysis{
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
    data.length!==width*height*4)throw Error('Dimensions du logo invalides.');
 let left=width,top=height,right=-1,bottom=-1,hasTransparency=false;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const alpha=data[(y*width+x)*4+3];
  if(alpha<255)hasTransparency=true;
  // Alpha 1–254 is still visible artwork (including delicate shadows).
  if(alpha===0)continue;
  if(x<left)left=x;
  if(x>right)right=x;
  if(y<top)top=y;
  if(y>bottom)bottom=y;
 }
 if(!hasTransparency)throw Error('Importez un PNG ou WebP avec un fond réellement transparent.');
 if(right<left)throw Error('Ce logo est entièrement transparent et ne contient aucun dessin.');
 const bounds={x:left,y:top,width:right-left+1,height:bottom-top+1};
 return {bounds,hasTransparency,cropped:bounds.width<width||bounds.height<height};
}

export async function optimizeLogo(uri:string):Promise<OptimizedLogo>{
 if(!/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/i.test(uri))
  throw Error('Utilisez un logo PNG ou WebP avec un fond transparent (pas JPEG).');
 const image=new Image();
 image.decoding='async';
 await new Promise<void>((resolve,reject)=>{
  image.onload=()=>resolve();
  image.onerror=()=>reject(Error('Impossible de lire le logo.'));
  image.src=uri;
 });
 const width=image.naturalWidth,height=image.naturalHeight;
 if(!width||!height||width*height>16_000_000)
  throw Error('Dimensions du logo non prises en charge.');
 const source=document.createElement('canvas');
 source.width=width;source.height=height;
 const sourceContext=source.getContext('2d',{willReadFrequently:true});
 if(!sourceContext)throw Error('Traitement graphique indisponible.');
 sourceContext.drawImage(image,0,0);
 const analysis=analyzeTransparentLogoPixels(sourceContext.getImageData(0,0,width,height).data,width,height);
 const {bounds,cropped}=analysis;
 // No resampling for a crop: copy exact artwork pixels within the alpha bounds.
 if(!cropped&&uri.length<=175_000)
  return {dataUri:uri,cropped:false,optimized:false};
 const trimmed=document.createElement('canvas');
 trimmed.width=bounds.width;trimmed.height=bounds.height;
 const target=trimmed.getContext('2d');
 if(!target)throw Error('Traitement graphique indisponible.');
 target.putImageData(sourceContext.getImageData(bounds.x,bounds.y,bounds.width,bounds.height),0,0);
 // Keep the unscaled crop whenever it fits within the storage limit.
 if(Math.max(bounds.width,bounds.height)<=2048){
  const candidate=trimmed.toDataURL('image/png');
  if(candidate.length<=175_000)return {dataUri:candidate,cropped,optimized:true};
 }
 // Only proportional downscaling is allowed if storage needs it.
 for(const maxSide of [1600,1200,1024,768,576,448,320,240,160]){
  const factor=Math.min(1,maxSide/Math.max(bounds.width,bounds.height));
  if(factor===1)continue;
  const resized=document.createElement('canvas');
  resized.width=Math.max(1,Math.round(bounds.width*factor));
  resized.height=Math.max(1,Math.round(bounds.height*factor));
  const ctx=resized.getContext('2d');
  if(!ctx)throw Error('Traitement graphique indisponible.');
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(trimmed,0,0,resized.width,resized.height);
  const candidate=resized.toDataURL('image/png');
  if(candidate.length<=175_000)return {dataUri:candidate,cropped,optimized:true};
 }
 throw Error('Logo trop détaillé pour la limite de stockage. Importez un PNG plus léger.');
}
