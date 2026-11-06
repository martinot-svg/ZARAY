/**
 * Logo import: preserve the complete image and its original background.
 *
 * No segmentation, background deletion, transparency creation or automatic
 * cropping is performed. Small files are saved byte-for-byte, unchanged.
 * Large images can be resized proportionally to meet the template storage
 * limit; their background, colors and original framing stay intact.
 */
export type OptimizedLogo={dataUri:string;optimized:boolean};

export async function optimizeLogo(uri:string):Promise<OptimizedLogo>{
 if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(uri))
  throw Error('Format de logo non pris en charge.');
 // Validate the image before preserving or resizing it.
 const image=new Image();
 image.decoding='async';image.src=uri;
 await new Promise<void>((resolve,reject)=>{
  image.onload=()=>resolve();
  image.onerror=()=>reject(Error('Impossible de lire le logo.'));
 });
 if(!image.naturalWidth||!image.naturalHeight||
    image.naturalWidth*image.naturalHeight>16_000_000)
  throw Error('Dimensions du logo non prises en charge.');
 // Preserve the original bytes, colors, alpha and any background if it fits.
 if(uri.length<=175_000)return {dataUri:uri,optimized:false};
 // No cropping and no background processing; simply shrink to fit.
 for(const maxSide of [1024,768,576,448,320,240,160]){
  const factor=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Traitement graphique indisponible.');
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const candidate=canvas.toDataURL('image/png');
  if(candidate.length<=175_000)return {dataUri:candidate,optimized:true};
 }
 throw Error('Logo trop détaillé pour la limite de stockage. Utilisez un fichier plus léger.');
}
