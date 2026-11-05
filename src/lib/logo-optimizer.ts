/**
 * Client-side, conservative logo cleaning. No image data leaves the browser
 * until the administrator saves the chosen site template.
 *
 * A background is removed only when a near-uniform colour is visible on
 * a substantial part of the outer image border and connects to the edges.
 * Complex/ambiguous backgrounds are preserved instead of erasing branding.
 */
export type Raster = {width:number;height:number;data:Uint8ClampedArray};
export type LogoCleanResult = {raster:Raster;removedBackground:boolean;cropped:boolean};

const diff = (a:number,b:number)=>Math.abs(a-b);
const distance = (d:Uint8ClampedArray,i:number,r:number,g:number,b:number)=>
 Math.max(diff(d[i],r),diff(d[i+1],g),diff(d[i+2],b));

export function cleanLogoPixels(input:Raster):LogoCleanResult {
 const {width:w,height:h}=input;
 if(w<1||h<1||input.data.length!==w*h*4)throw Error('Image du logo invalide.');
 const data=new Uint8ClampedArray(input.data);
 const border:number[]=[];
 const step=Math.max(1,Math.floor(Math.min(w,h)/180));
 for(let x=0;x<w;x+=step){border.push(x,(h-1)*w+x);}
 for(let y=0;y<h;y+=step){border.push(y*w,y*w+w-1);}
 const bins=new Map<number,{count:number,r:number,g:number,b:number}>();
 let visible=0,transparentBorder=0;
 for(const p of border){
  const i=p*4;if(data[i+3]<230){transparentBorder++;continue;}
  visible++;
  const key=((data[i]>>4)<<8)|((data[i+1]>>4)<<4)|(data[i+2]>>4);
  const bin=bins.get(key)||{count:0,r:0,g:0,b:0};
  bin.count++;bin.r+=data[i];bin.g+=data[i+1];bin.b+=data[i+2];bins.set(key,bin);
 }
 const sorted=[...bins.values()].sort((a,b)=>b.count-a.count);
 const candidate=sorted[0];
 let removedBackground=false;
 if(candidate&&visible>=8&&transparentBorder/border.length<.02&&candidate.count/visible>=.62){
  const r=candidate.r/candidate.count,g=candidate.g/candidate.count,b=candidate.b/candidate.count;
  const match=(p:number,threshold:number)=>data[p*4+3]>=230&&distance(data,p*4,r,g,b)<=threshold;
  const seed:number[]=[];
  const visited=new Uint8Array(w*h);
  for(let x=0;x<w;x++){seed.push(x,(h-1)*w+x);}
  for(let y=0;y<h;y++){seed.push(y*w,y*w+w-1);}
  const queue:number[]=[];let head=0;
  for(const p of seed){if(!visited[p]&&match(p,24)){visited[p]=1;queue.push(p);}}
  while(head<queue.length){
   const p=queue[head++],x=p%w,y=Math.floor(p/w);
   const neighbors=[x>0?p-1:-1,x+1<w?p+1:-1,y>0?p-w:-1,y+1<h?p+w:-1];
   for(const n of neighbors)if(n>=0&&!visited[n]&&match(n,28)){visited[n]=1;queue.push(n);}
  }
  // Do not remove a major part of the artwork if its background is uncertain.
  const coverage=queue.length/(w*h);
  if(coverage>=.07&&coverage<=.94){
   removedBackground=true;
   for(const p of queue)data[p*4+3]=0;
   // Antialiasing fringe: only soften pixels directly next to removed pixels.
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=y*w+x,i=p*4;
    if(visited[p]||data[i+3]===0)continue;
    if(distance(data,i,r,g,b)>46)continue;
    if((x>0&&visited[p-1])||(x+1<w&&visited[p+1])||
       (y>0&&visited[p-w])||(y+1<h&&visited[p+w])){
      const amount=Math.max(0,Math.min(1,(distance(data,i,r,g,b)-16)/30));
      data[i+3]=Math.round(data[i+3]*amount);
    }
   }
  }
 }
 // Crop alpha-only margins, with a small safety inset to avoid clipping.
 let minX=w,minY=h,maxX=-1,maxY=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(data[(y*w+x)*4+3]<8)continue;
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);
  minY=Math.min(minY,y);maxY=Math.max(maxY,y);
 }
 if(maxX<0)return {raster:input,removedBackground:false,cropped:false};
 const inset=Math.max(1,Math.round(Math.min(w,h)*.012));
 minX=Math.max(0,minX-inset);minY=Math.max(0,minY-inset);
 maxX=Math.min(w-1,maxX+inset);maxY=Math.min(h-1,maxY+inset);
 const cw=maxX-minX+1,ch=maxY-minY+1;
 if(cw===w&&ch===h)return {raster:{width:w,height:h,data},removedBackground,cropped:false};
 const output=new Uint8ClampedArray(cw*ch*4);
 for(let y=0;y<ch;y++)output.set(data.subarray(((y+minY)*w+minX)*4,((y+minY)*w+minX+cw)*4),y*cw*4);
 return {raster:{width:cw,height:ch,data:output},removedBackground,cropped:true};
}
export type OptimizedLogo = {dataUri:string;removedBackground:boolean;cropped:boolean;optimized:boolean};
export async function optimizeLogo(uri:string):Promise<OptimizedLogo>{
 const image=new Image();
 image.decoding='async';image.src=uri;
 await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Impossible de lire le logo.'));});
 const maxPixels=4_000_000,maxDim=2048;
 if(image.naturalWidth*image.naturalHeight>maxPixels*4)throw Error('Dimensions du logo trop importantes.');
 const scale=Math.min(1,maxDim/Math.max(image.naturalWidth,image.naturalHeight),Math.sqrt(maxPixels/(image.naturalWidth*image.naturalHeight)));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
 canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('Traitement graphique indisponible.');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 let cleaned=cleanLogoPixels({width:canvas.width,height:canvas.height,data:pixels.data});
 let modelUsed=false;
 // Run AI only if the simpler transparent/uniform-background cleanup was
 // insufficient. Transparent uploads are already valid and are left intact.
 const hasTransparency=pixels.data.some((value,index)=>index%4===3&&value<250);
 if(!cleaned.removedBackground&&!hasTransparency){
  try{
   const {removeComplexBackground}=await import('./logo-ai');
   const segmented=await removeComplexBackground({width:canvas.width,height:canvas.height,data:pixels.data});
   if(segmented){
    cleaned=cleanLogoPixels(segmented);
    modelUsed=true;
   }
  }catch{
   // Offline browsers or WebAssembly-disabled devices keep the original logo.
  }
 }
 const removedBackground=cleaned.removedBackground||modelUsed;
 const output=document.createElement('canvas');
 output.width=cleaned.raster.width;output.height=cleaned.raster.height;
 const target=output.getContext('2d');
 if(!target)throw Error('Traitement graphique indisponible.');
 const composed=target.createImageData(output.width,output.height);
 composed.data.set(cleaned.raster.data);target.putImageData(composed,0,0);
 // Keep images within the existing Supabase database limit (~130 KB).
 for(const limit of [1024,768,576,448,320,240,160]){
  const factor=Math.min(1,limit/Math.max(output.width,output.height));
  const resized=document.createElement('canvas');
  resized.width=Math.max(1,Math.round(output.width*factor));
  resized.height=Math.max(1,Math.round(output.height*factor));
  const rc=resized.getContext('2d');
  if(!rc)continue;
  rc.imageSmoothingEnabled=true;rc.imageSmoothingQuality='high';
  rc.drawImage(output,0,0,resized.width,resized.height);
  const candidate=resized.toDataURL('image/png');
  if(candidate.length<=175_000)return {dataUri:candidate,removedBackground,
    cropped:cleaned.cropped,optimized:true};
 }
 throw Error('Logo trop détaillé pour ce format. Essayez une image plus simple.');
}
