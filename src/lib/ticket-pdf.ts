/** Browser-only A4 renderer. No third-party PDF service ever receives voucher secrets. */
export type PrintableVoucher={id:string;username:string;password:string;offer_name:string;price_amount:number|string;currency:string;duration_minutes:number;validity_days:number;status:string};
export type TicketVisual={logo_data_uri:string|null;primary_color:string;secondary_color:string;title_color:string;border_color:string;font_family:string;username_length:number;password_length:number};
export type TicketSheet={siteName:string;design:TicketVisual;tickets:PrintableVoucher[]};
const mm=150/25.4;
const pageW=Math.round(210*mm),pageH=Math.round(297*mm);
const encoder=new TextEncoder();
function toBytes(value:string){return encoder.encode(value);}
function jpegDataUrlToBytes(url:string){
 const bytes=atob(url.split(',')[1]);
 const result=new Uint8Array(bytes.length);
 for(let i=0;i<bytes.length;i++)result[i]=bytes.charCodeAt(i);
 return result;
}
function drawFit(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,maxWidth:number,size:number,color:string,font:string,bold=false){
 let fontSize=size;
 ctx.fillStyle=color;
 while(fontSize>8){
  ctx.font=`${bold?'bold ':''}${fontSize}px ${font}`;
  if(ctx.measureText(text).width<=maxWidth)break;
  fontSize-=1;
 }
 ctx.fillText(text,x,y,Math.max(1,maxWidth));
}
async function loadLogo(data:string|null):Promise<HTMLImageElement|null>{
 if(!data)return null;
 return new Promise(resolve=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>resolve(null);
  img.src=data;
 });
}
export function voucherPages(tickets:PrintableVoucher[]){
 const pages:PrintableVoucher[][]=[];
 for(let i=0;i<tickets.length;i+=33)pages.push(tickets.slice(i,i+33));
 return pages;
}
function canvasPage(sheet:TicketSheet,tickets:PrintableVoucher[],logo:HTMLImageElement|null){
 const canvas=document.createElement('canvas');canvas.width=pageW;canvas.height=pageH;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas indisponible.');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,pageW,pageH);
 const w=60*mm,h=20*mm;
 for(let i=0;i<tickets.length;i++){
  const ticket=tickets[i],col=i%3,row=Math.floor(i/3);
  const x=(10+col*65)*mm,y=(21+row*23.5)*mm;
  ctx.fillStyle=sheet.design.secondary_color;ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=sheet.design.border_color;ctx.lineWidth=1.5;ctx.strokeRect(x+1,y+1,w-2,h-2);
  ctx.fillStyle=sheet.design.primary_color;ctx.fillRect(x,y,3,h);
  let left=x+11,right=x+w-8;
  if(logo){
   const boxW=59,boxH=74;
   const scale=Math.min(boxW/logo.width,boxH/logo.height);
   const lw=logo.width*scale,lh=logo.height*scale;
   ctx.drawImage(logo,x+9+(boxW-lw)/2,y+19+(boxH-lh)/2,lw,lh);
   left=x+73;
  }
  const font=sheet.design.font_family;
  const textWidth=right-left;
  drawFit(ctx,sheet.siteName,left,y+20,textWidth,16,sheet.design.primary_color,font,true);
  drawFit(ctx,ticket.offer_name,left,y+40,textWidth,14,sheet.design.title_color,font,true);
  drawFit(ctx,'User: '+ticket.username,left,y+61,textWidth,15,sheet.design.title_color,font);
  drawFit(ctx,'Pass: '+ticket.password,left,y+82,textWidth,15,sheet.design.title_color,font);
  drawFit(ctx,`${ticket.duration_minutes} min · ${ticket.price_amount} ${ticket.currency} · Non activé`,left,y+103,textWidth,12,sheet.design.title_color,font);
 }
 return canvas;
}
/** Generates image-backed PDF pages at 150 DPI with exact ISO A4 media boxes. */
export async function generateA4Pdf(sheet:TicketSheet):Promise<Blob>{
 const logo=await loadLogo(sheet.design.logo_data_uri);
 const pages=voucherPages(sheet.tickets);
 if(!pages.length)throw Error('Aucun ticket à exporter.');
 const objects:(Uint8Array|null)[]=[null,null];
 // PDF object IDs 1=catalog, 2=pages, subsequent sets: page, image, contents.
 const kids:number[]=[];
 for(const pageTickets of pages){
  const canvas=canvasPage(sheet,pageTickets,logo);
  const image=jpegDataUrlToBytes(canvas.toDataURL('image/jpeg',0.88));
  const pageId=objects.length+1,imageId=pageId+1,contentsId=pageId+2;
  kids.push(pageId);
  const stream=`q 595.2756 0 0 841.8898 0 0 cm /Im0 Do Q\n`;
  objects.push(
   toBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.2756 841.8898] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentsId} 0 R >>`),
   new Uint8Array([...toBytes(`<< /Type /XObject /Subtype /Image /Width ${pageW} /Height ${pageH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),...image,...toBytes('\nendstream')]),
   toBytes(`<< /Length ${toBytes(stream).length} >>\nstream\n${stream}endstream`)
  );
 }
 objects[0]=toBytes('<< /Type /Catalog /Pages 2 0 R >>');
 objects[1]=toBytes(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(id=>id+' 0 R').join(' ')}] >>`);
 const chunks:Uint8Array[]=[toBytes('%PDF-1.4\n%ZARAY\n')];
 let offset=chunks[0].length;
 const offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(offset);
  const header=toBytes(`${i+1} 0 obj\n`),end=toBytes('\nendobj\n');
  chunks.push(header,objects[i]!,end);
  offset+=header.length+objects[i]!.length+end.length;
 }
 const xref=offset;
 const trailer=toBytes(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
 chunks.push(trailer);
 return new Blob(chunks as BlobPart[],{type:'application/pdf'});
}
