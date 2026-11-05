/**
 * Advanced local background removal for non-uniform photographic backgrounds.
 * Apache-2.0 Transformers.js and Apache-2.0 ORMBG model.
 * Model weights are downloaded on first use; image pixels stay in the browser.
 * Loaded lazily to keep routine site editing lightweight.
 */
import type {Raster} from './logo-optimizer';

type RawResult={width:number;height:number;channels:number;data:Uint8Array|Uint8ClampedArray};
let removerPromise:Promise<(input:HTMLCanvasElement)=>Promise<RawResult|RawResult[]>>|null=null;

async function loadRemover(){
 if(!removerPromise){
  removerPromise=(async()=>{
   const {pipeline}=await import('@huggingface/transformers');
   const model=await pipeline('background-removal','onnx-community/ormbg-ONNX',{
    device:'wasm',dtype:'uint8'
   });
   return model as unknown as (input:HTMLCanvasElement)=>Promise<RawResult|RawResult[]>;
  })().catch(error=>{removerPromise=null;throw error;});
 }
 return removerPromise;
}

/**
 * Accept a segmentation only when it clearly separates a useful foreground
 * from the image border. Avoid replacing brand artwork with an empty canvas.
 */
export function combineLogoAndSegmentation(original:Raster,mask:RawResult):Raster|null {
 if(mask.width!==original.width||mask.height!==original.height||
    mask.channels!==4||mask.data.length!==original.data.length)return null;
 const {width:w,height:h}=original,total=w*h;
 const output=new Uint8ClampedArray(original.data);
 let foreground=0,background=0,borderBackground=0,borderCount=0,centerForeground=0,centerCount=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const p=y*w+x,i=p*4;
  const alpha=Math.min(original.data[i+3],mask.data[i+3]);
  output[i+3]=alpha;
  if(alpha>=200)foreground++;
  if(alpha<=55)background++;
  if(x<2||y<2||x>=w-2||y>=h-2){borderCount++;if(alpha<=55)borderBackground++;}
  if(x>=w*.25&&x<=w*.75&&y>=h*.25&&y<=h*.75){centerCount++;if(alpha>=160)centerForeground++;}
 }
 const fg=foreground/total,bg=background/total;
 // A clear silhouette must remain and have reasonably transparent edges.
 if(fg<.025||fg>.93||bg<.07||bg>.96||borderCount===0||
   borderBackground/borderCount<.5||centerCount===0||centerForeground/centerCount<.07)
  return null;
 return {width:w,height:h,data:output};
}

export async function removeComplexBackground(input:Raster):Promise<Raster|null>{
 // Preserve original colours: the model is used only as an alpha mask.
 const canvas=document.createElement('canvas');canvas.width=input.width;canvas.height=input.height;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 const image=ctx.createImageData(input.width,input.height);
 image.data.set(input.data);ctx.putImageData(image,0,0);
 const remover=await loadRemover();
 const result=await remover(canvas);
 const alpha=Array.isArray(result)?result[0]:result;
 if(!alpha)return null;
 return combineLogoAndSegmentation(input,alpha);
}
