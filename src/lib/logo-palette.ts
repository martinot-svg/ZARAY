/** Logo color extraction happens in the browser; no image data is transmitted. */
export type LogoPalette={
 primary_color:string;accent_color:string;secondary_color:string;title_color:string;border_color:string;
};
type WeightedColor={r:number;g:number;b:number;weight:number;hue:number};
const clamp=(n:number)=>Math.max(0,Math.min(255,Math.round(n)));
const hex=(r:number,g:number,b:number)=>'#'+[r,g,b].map(v=>clamp(v).toString(16).padStart(2,'0')).join('').toUpperCase();
function mixed(a:string,b:string,part:number){
 const read=(s:string,i:number)=>parseInt(s.slice(i,i+2),16);
 return hex(read(a,1)*(1-part)+read(b,1)*part,
  read(a,3)*(1-part)+read(b,3)*part,read(a,5)*(1-part)+read(b,5)*part);
}
function hueOf(r:number,g:number,b:number,max:number,min:number){
 const delta=max-min;if(!delta)return 0;
 let hue=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;
 hue*=60;return (hue+360)%360;
}
export function paletteFromPixels(pixels:Uint8ClampedArray):LogoPalette|null{
 const chromatic=new Map<number,WeightedColor>(),neutral=new Map<number,WeightedColor>();
 for(let i=0;i+3<pixels.length;i+=4){
  const alpha=pixels[i+3]/255;
  if(alpha<.38)continue;
  const r=pixels[i],g=pixels[i+1],b=pixels[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);
  if(max<25||(min>245&&max>245))continue;
  const sat=max===0?0:(max-min)/max,hue=hueOf(r,g,b,max,min);
  const isColor=sat>=.17&&max>=45;
  const target=isColor?chromatic:neutral;
  const key=isColor?Math.floor(hue/15):Math.floor(max/32);
  const weight=alpha*(isColor?(0.7+sat):.15);
  const row=target.get(key)??{r:0,g:0,b:0,weight:0,hue};
  row.r+=r*weight;row.g+=g*weight;row.b+=b*weight;row.weight+=weight;
  target.set(key,row);
 }
 const rows=chromatic.size?chromatic:neutral;
 if(!rows.size)return null;
 const sorted=[...rows.values()].sort((a,b)=>b.weight-a.weight);
 const color=(c:WeightedColor)=>hex(c.r/c.weight,c.g/c.weight,c.b/c.weight);
 const primary=color(sorted[0]),top=sorted[0];
 const secondary=sorted.find(c=>c!==top
  &&Math.min(Math.abs(c.hue-top.hue),360-Math.abs(c.hue-top.hue))>=30
  &&c.weight>=top.weight*.08);
 return {primary_color:primary,accent_color:secondary?color(secondary):mixed(primary,'#FFFFFF',.32),
  secondary_color:'#FFFFFF',title_color:'#10251A',border_color:mixed(primary,'#FFFFFF',.58)};
}
/** Decode the selected logo locally; sample no more than 96x96 pixels. */
export async function paletteFromLogo(uri:string):Promise<LogoPalette|null>{
 if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(uri)||uri.length>180000)return null;
 const image=await new Promise<HTMLImageElement|null>(resolve=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=uri;
 });
 if(!image||!image.naturalWidth||!image.naturalHeight)return null;
 const ratio=Math.min(96/image.naturalWidth,96/image.naturalHeight,1);
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
 canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)return null;
 try{
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return paletteFromPixels(ctx.getImageData(0,0,canvas.width,canvas.height).data);
 }catch{return null;}
}
