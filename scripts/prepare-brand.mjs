import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

// Transparent source is a pixel-faithful optimization of the user's supplied black/green logo.
// Prepare the supplied white/green colorway without reconstructing letterforms.
const root = process.cwd(), pngFile = await readFile(join(root,'public/brand/zaray-light.png'));
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
if(!pngFile.subarray(0,8).equals(signature))throw new Error('Invalid ZARAY PNG');
let at=8,palette,transparency,compressed=[],width=0,height=0,bitDepth=0,colorType=0;
while(at<pngFile.length){
 const size=pngFile.readUInt32BE(at),type=pngFile.toString('ascii',at+4,at+8),data=pngFile.subarray(at+8,at+8+size);
 at+=size+12;
 if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);bitDepth=data[8];colorType=data[9];}
 if(type==='PLTE')palette=data;
 if(type==='tRNS')transparency=data;
 if(type==='IDAT')compressed.push(data);
 if(type==='IEND')break;
}
if(!palette||!transparency||width!==512||height<140||bitDepth!==8||colorType!==3)throw new Error('Unexpected ZARAY logo file');
const scan=inflateSync(Buffer.concat(compressed)),pixels=Buffer.alloc(width*height*4),rowSize=width;
let cursor=0,previous=Buffer.alloc(rowSize);
for(let y=0;y<height;y++){
 const filter=scan[cursor++],line=Buffer.from(scan.subarray(cursor,cursor+rowSize));cursor+=rowSize;
 for(let x=0;x<rowSize;x++){
  const a=x?line[x-1]:0,b=previous[x],c=x?previous[x-1]:0;let delta=0;
  if(filter===1)delta=a;else if(filter===2)delta=b;else if(filter===3)delta=(a+b)>>1;
  else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);delta=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
  else if(filter!==0)throw new Error('Unsupported PNG filter');
  line[x]=(line[x]+delta)&255;
 }
 for(let x=0;x<width;x++){
  const index=line[x],offset=(y*width+x)*4;
  pixels[offset]=palette[index*3];pixels[offset+1]=palette[index*3+1];pixels[offset+2]=palette[index*3+2];
  pixels[offset+3]=index<transparency.length?transparency[index]:255;
 }
 previous=line;
}
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
function chunk(name,bytes){
 const tag=Buffer.from(name,'ascii'),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(bytes.length);
 let sum=0xffffffff;for(const b of Buffer.concat([tag,bytes]))sum=crcTable[(sum^b)&255]^(sum>>>8);
 crc.writeUInt32BE((sum^0xffffffff)>>>0);return Buffer.concat([len,tag,bytes,crc]);
}
function encode(w,h,rgba){
 const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
 const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
 return Buffer.concat([signature,chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const white=Buffer.from(pixels);
for(let i=0;i<white.length;i+=4){
 const r=white[i],g=white[i+1],b=white[i+2];
 const leaf=g>45&&g>r*1.30&&g>b*1.20;
 if(!leaf){white[i]=254;white[i+1]=254;white[i+2]=254;}
}
await writeFile(join(root,'public/brand/zaray-dark.png'),encode(width,height,white));
function favicon(size){
 const out=Buffer.alloc(size*size*4),cropW=Math.round(width*148/640),cropH=height;
 const inset=Math.round(size*.08),scale=Math.min((size-inset*2)/cropW,(size-inset*2)/cropH);
 const dstW=cropW*scale,dstH=cropH*scale,left=(size-dstW)/2,top=(size-dstH)/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const sx=(x+.5-left)/scale-.5,sy=(y+.5-top)/scale-.5;
  if(sx<0||sy<0||sx>=cropW-1||sy>=cropH-1)continue;
  const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,at=(y*size+x)*4;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const source=((iy+dy)*width+ix+dx)*4,weight=(dx?fx:1-fx)*(dy?fy:1-fy);
   for(let c=0;c<4;c++)out[at+c]+=Math.round(pixels[source+c]*weight);
  }
 }
 return out;
}
for(const size of [16,32,48,180,192,512]){
 const name=size===180?'apple-touch-icon.png':size===192?'android-chrome-192x192.png':size===512?'android-chrome-512x512.png':`favicon-${size}x${size}.png`;
 await writeFile(join(root,'public',name),encode(size,size,favicon(size)));
}
console.log('ZARAY transparent theme logos and device icons prepared');