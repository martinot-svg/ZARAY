import 'server-only';
import sharp from 'sharp';

const limit=175_000;
const maxInput=2_000_000;

/**
 * Revalidates and trims a site logo on the server.
 * Only alpha=0 margins are removed. Any alpha>0 artwork, shadow or edge is kept.
 * Never remove a colored background or use AI segmentation.
 */
export async function normalizeTransparentSiteLogo(dataUri:string){
 const matched=/^data:image\/(png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri);
 if(!matched||dataUri.length>2_700_000)
  throw Error('Choisissez un logo PNG ou WebP transparent (2 Mo maximum).');
 const source=Buffer.from(matched[2],'base64');
 if(source.length<16||source.length>maxInput)
  throw Error('Le fichier du logo doit peser moins de 2 Mo.');
 const png=source.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=source.toString('ascii',0,4)==='RIFF'&&source.toString('ascii',8,12)==='WEBP';
 if(!(matched[1]==='png'&&png||matched[1]==='webp'&&webp))
  throw Error('Format du logo invalide. Utilisez un vrai PNG ou WebP.');
 let metadata:sharp.Metadata;
 try{metadata=await sharp(source,{limitInputPixels:16_000_000,failOn:'error'}).metadata();}
 catch{throw Error('Impossible de lire le logo.');}
 const w=metadata.width||0,h=metadata.height||0;
 if(!w||!h||w*h>16_000_000||!metadata.hasAlpha)
  throw Error('Le logo doit avoir un arrière-plan transparent, et non opaque.');
 let raw:Buffer;
 try{raw=await sharp(source,{limitInputPixels:16_000_000,failOn:'error'})
  .toColourspace('srgb').ensureAlpha().raw().toBuffer();}
 catch{throw Error('Impossible de vérifier la transparence du logo.');}
 let left=w,right=-1,top=h,bottom=-1,transparent=false;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const alpha=raw[(y*w+x)*4+3];
  if(alpha===0){transparent=true;continue;}
  if(x<left)left=x;if(x>right)right=x;
  if(y<top)top=y;if(y>bottom)bottom=y;
 }
 if(!transparent)throw Error('Le fond du logo est opaque. Importez une image réellement transparente.');
 if(right<left)throw Error('Le logo est complètement vide.');
 const corners=[raw[3],raw[(w-1)*4+3],raw[((h-1)*w)*4+3],raw[(w*h-1)*4+3]];
 if(corners.every(a=>a===255))
  throw Error('Les coins du logo sont opaques : importez un logo dont le fond extérieur est transparent.');
 const bounds={left,top,width:right-left+1,height:bottom-top+1};
 let result:Buffer|null=null;
 for(const side of [2048,1600,1280,1024,800,640,480,320,240,160]){
  const image=sharp(source,{limitInputPixels:16_000_000,failOn:'error'}).extract(bounds);
  const reduced=Math.max(bounds.width,bounds.height)>side
   ?image.resize({width:side,height:side,fit:'inside',withoutEnlargement:true})
   :image;
  const output=await reduced.png({compressionLevel:9}).toBuffer();
  if(output.length*4/3+30<=limit){result=output;break;}
 }
 if(!result)throw Error('Le logo reste trop volumineux après rognage. Utilisez une image moins détaillée.');
 const resultUri='data:image/png;base64,'+result.toString('base64');
 if(resultUri.length>limit)throw Error('Le logo dépasse la taille de stockage.');
 return {dataUri:resultUri,cropped:bounds.width<w||bounds.height<h,width:bounds.width,height:bounds.height};
}
