/** Local, browser-only ticket renderer. Geometry is immutable: A4 210×297mm;
 *  3×11 vouchers, each 60×20mm, start 10×21mm, gaps 5×3.5mm, 150dpi.
 *  Never send voucher credentials to remote image/PDF services.
 */
export type PrintableVoucher={
 id:string;username:string;password:string;offer_name:string;
 price_amount:number|string;currency:string;duration_minutes:number;
 validity_days:number;status:string;
};
export type TicketStyle='classic'|'event'|'minimal'|'corporate';
export type TicketVisual={
 logo_data_uri:string|null;primary_color:string;secondary_color:string;
 title_color:string;border_color:string;font_family:string;
 username_length:number;password_length:number;
 template_key?:TicketStyle;accent_color?:string;gradient_enabled?:boolean;
 decorations_enabled?:boolean;brand_name?:string;wifi_ssid?:string;
 phone?:string;address?:string;welcome_message?:string;footer_text?:string;
 show_price?:boolean;show_duration?:boolean;show_ticket_id?:boolean;show_wifi_ssid?:boolean;
};
export type TicketSheet={siteName:string;design:TicketVisual;tickets:PrintableVoucher[]};
export const TICKET_PRINT={
 pageWidthMm:210,pageHeightMm:297,voucherWidthMm:60,voucherHeightMm:20,
 columns:3,rows:11,perPage:33,leftMm:10,topMm:21,columnGapMm:5,rowGapMm:3.5,dpi:150
} as const;
const mm=TICKET_PRINT.dpi/25.4;
export const TICKET_PIXEL_WIDTH=Math.round(TICKET_PRINT.voucherWidthMm*mm);
export const TICKET_PIXEL_HEIGHT=Math.round(TICKET_PRINT.voucherHeightMm*mm);
const pageW=Math.round(210*mm),pageH=Math.round(297*mm);
const encoder=new TextEncoder();
function bytes(value:string){return encoder.encode(value);}
function jpeg(url:string){const binary=atob(url.split(',')[1]);const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}
const hex=(s:string,fallback:string)=>/^#[0-9a-f]{6}$/i.test(s)?s:fallback;
function rgb(value:string){const v=hex(value,'#ffffff').slice(1);return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16));}
function luminance(value:string){
 const c=rgb(value).map(v=>{const x=v/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);});
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function legibleInk(preferred:string,background:string){
 const text=hex(preferred,'#10251a'),bg=hex(background,'#ffffff');
 if(contrast(text,bg)>=4.5)return text;
 return contrast('#10251a',bg)>contrast('#ffffff',bg)?'#10251a':'#ffffff';
}
function fit(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,color:string,font:string,bold=false){
 const safe=(text||'').replace(/[\r\n\t]/g,' ');
 let px=size; ctx.fillStyle=color;
 while(px>8){ctx.font=(bold?'700 ':'')+px+'px '+font;if(ctx.measureText(safe).width<=width)break;px-=.5;}
 ctx.fillText(safe,x,y,Math.max(1,width));
}
function logoPaint(ctx:CanvasRenderingContext2D,img:HTMLImageElement|null,x:number,y:number,w:number,h:number){
 if(!img||!img.naturalWidth||!img.naturalHeight)return false;
 const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
 const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
 ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);return true;
}
export async function loadVoucherLogo(uri:string|null):Promise<HTMLImageElement|null>{
 if(!uri || !/^data:image\/(png|jpeg|webp);base64,/.test(uri))return null;
 return new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=uri;});
}
export function voucherPages(tickets:PrintableVoucher[]){
 const pages:PrintableVoucher[][]=[];
 for(let i=0;i<tickets.length;i+=TICKET_PRINT.perPage)pages.push(tickets.slice(i,i+TICKET_PRINT.perPage));
 return pages;
}
/** Shared primitive used by live editor, HTML print and A4 PDF export. */
export function paintVoucher(ctx:CanvasRenderingContext2D,x:number,y:number,ticket:PrintableVoucher,design:TicketVisual,siteName:string,logo:HTMLImageElement|null){
 const w=60*mm,h=20*mm,kind=design.template_key??'classic';
 const primary=hex(design.primary_color,'#167a46'),background=hex(design.secondary_color,'#ffffff');
 const accent=hex(design.accent_color??'#0e9f6e','#0e9f6e');
 const border=hex(design.border_color,'#a5b9ad');
 const preferred=hex(design.title_color,'#10251a'),ink=legibleInk(preferred,background);
 const font=['Arial','Georgia','Verdana','Tahoma'].includes(design.font_family)?design.font_family:'Arial';
 const name=(design.brand_name?.trim()||siteName).slice(0,90);
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 ctx.fillStyle=background;ctx.fillRect(x,y,w,h);
 if(kind==='event'||(design.gradient_enabled&&kind!=='classic')){
   const gradient=ctx.createLinearGradient(x,y,x+w,y+h);
   gradient.addColorStop(0,primary);gradient.addColorStop(1,accent);
   ctx.fillStyle=gradient;ctx.fillRect(x,y,w,h);
   ctx.fillStyle='rgba(0,0,0,.38)';ctx.fillRect(x,y,w,h);
 }
 const darkTheme=kind==='event'||(design.gradient_enabled&&kind!=='classic');
 const fg=darkTheme?'#ffffff':ink;
 const secondary=darkTheme?'rgba(255,255,255,.82)':legibleInk(preferred,background);
 if(kind==='classic'){
   ctx.fillStyle=primary;ctx.fillRect(x,y,3,h);
   let left=x+11;
   if(logoPaint(ctx,logo,x+9,y+19,59,74))left=x+73;
   const available=x+w-8-left;
   fit(ctx,name,left,y+20,available,16,legibleInk(primary,background),font,true);
   fit(ctx,ticket.offer_name,left,y+40,available,14,ink,font,true);
   fit(ctx,'User: '+ticket.username,left,y+61,available,15,ink,font);
   fit(ctx,'Pass: '+ticket.password,left,y+82,available,15,ink,font);
   const metadata=ticket.duration_minutes+' min · '+ticket.price_amount+' '+ticket.currency+' · Non activé';
   fit(ctx,metadata,left,y+103,available,12,ink,font);
 }else{
   const split=x+w*.76,mainX=x+11,mainWidth=split-mainX-8,sideX=split+7,sideWidth=x+w-sideX-9;
   if(kind==='corporate'&&!darkTheme){
     ctx.fillStyle=primary;ctx.fillRect(split,y,w*.24,h);
     ctx.fillStyle=accent;ctx.fillRect(x,y,4,h);
   }
   if(kind==='minimal'&&!darkTheme){
     ctx.fillStyle=primary;ctx.fillRect(x,y+h-2,w,2);
   }
   if(design.decorations_enabled!==false&&kind==='event'){
     ctx.fillStyle='rgba(255,255,255,.08)';
     ctx.beginPath();ctx.arc(x+w-28,y+17,50,0,Math.PI*2);ctx.fill();
     ctx.beginPath();ctx.arc(x+35,y+h+10,54,0,Math.PI*2);ctx.fill();
     // Notches stay INSIDE the existing physical boundary.
     ctx.fillStyle='#ffffff';
     ctx.beginPath();ctx.arc(split,y,5,0,Math.PI*2);ctx.fill();
     ctx.beginPath();ctx.arc(split,y+h,5,0,Math.PI*2);ctx.fill();
   }
   ctx.beginPath();ctx.moveTo(split,y+8);ctx.lineTo(split,y+h-8);
   ctx.setLineDash([4,4]);ctx.strokeStyle=darkTheme?'rgba(255,255,255,.65)':border;ctx.lineWidth=1.4;ctx.stroke();ctx.setLineDash([]);
   const logoUsed=logoPaint(ctx,logo,mainX,y+8,38,27);
   const textX=mainX+(logoUsed?43:0),textW=mainWidth-(logoUsed?43:0);
   fit(ctx,name,textX,y+21,textW,16,fg,font,true);
   fit(ctx,ticket.offer_name,mainX,y+40,mainWidth,15,fg,font,true);
   fit(ctx,'UTILISATEUR  '+ticket.username,mainX,y+62,mainWidth,14,fg,font,true);
   fit(ctx,'MOT DE PASSE  '+ticket.password,mainX,y+85,mainWidth,14,fg,font,true);
   const optionalFooter=design.footer_text?.trim()||design.welcome_message?.trim()||'';
   const footer='NON ACTIVÉ'+(optionalFooter?' · '+optionalFooter:'');
   fit(ctx,footer,mainX,y+105,mainWidth,11,secondary,font,false);
   const rightInk=kind==='corporate'&&!darkTheme?legibleInk('#ffffff',primary):fg;
   const rightSub=kind==='corporate'&&!darkTheme?rightInk:secondary;
   fit(ctx,'WI-FI',sideX,y+22,sideWidth,17,rightInk,font,true);
   let infoY=y+46;
   fit(ctx,ticket.duration_minutes+' min',sideX,infoY,sideWidth,13,rightSub,font,true);infoY+=20;
   fit(ctx,String(ticket.price_amount)+' '+ticket.currency,sideX,infoY,sideWidth,12,rightSub,font);infoY+=18;
   const sideNote=design.show_ticket_id===true?'N° '+ticket.id.slice(0,8).toUpperCase():
      design.show_wifi_ssid===true&&design.wifi_ssid?design.wifi_ssid:
      design.phone?.trim()||design.address?.trim()||'';
   if(sideNote)fit(ctx,sideNote,sideX,y+103,sideWidth,10,rightSub,font);
 }
 ctx.strokeStyle=border;ctx.lineWidth=1.5;ctx.strokeRect(x+.8,y+.8,w-1.6,h-1.6);
 ctx.restore();
}
export async function drawVoucherCanvas(canvas:HTMLCanvasElement,ticket:PrintableVoucher,design:TicketVisual,siteName:string){
 canvas.width=TICKET_PIXEL_WIDTH;canvas.height=TICKET_PIXEL_HEIGHT;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas indisponible.');
 const logo=await loadVoucherLogo(design.logo_data_uri);
 // Discard races by letting callers guard effect lifetimes; drawing is synchronous.
 ctx.clearRect(0,0,canvas.width,canvas.height);
 paintVoucher(ctx,0,0,ticket,design,siteName,logo);
}
function canvasPage(sheet:TicketSheet,arr:PrintableVoucher[],logo:HTMLImageElement|null){
 const canvas=document.createElement('canvas');canvas.width=pageW;canvas.height=pageH;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas indisponible.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,pageW,pageH);
 for(let i=0;i<arr.length;i++){
   const x=(TICKET_PRINT.leftMm+(i%3)*(60+TICKET_PRINT.columnGapMm))*mm;
   const y=(TICKET_PRINT.topMm+Math.floor(i/3)*(20+TICKET_PRINT.rowGapMm))*mm;
   paintVoucher(ctx,x,y,arr[i],sheet.design,sheet.siteName,logo);
 }
 return canvas;
}
/** A4 physical PDF geometry and 150dpi JPEG image pages are unchanged. */
export async function generateA4Pdf(sheet:TicketSheet):Promise<Blob>{
 const logo=await loadVoucherLogo(sheet.design.logo_data_uri);
 const pages=voucherPages(sheet.tickets);if(!pages.length)throw Error('Aucun ticket à exporter.');
 const objects:(Uint8Array|null)[]=[null,null],kids:number[]=[];
 for(const items of pages){
   const page=canvasPage(sheet,items,logo),image=jpeg(page.toDataURL('image/jpeg',.88));
   const pageId=objects.length+1,imageId=pageId+1,contentsId=pageId+2;
   kids.push(pageId);
   const stream='q 595.2756 0 0 841.8898 0 0 cm /Im0 Do Q\n';
   objects.push(bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.2756 841.8898] /Resources << /XObject << /Im0 '+imageId+' 0 R >> >> /Contents '+contentsId+' 0 R >>'),
    new Uint8Array([...bytes('<< /Type /XObject /Subtype /Image /Width '+pageW+' /Height '+pageH+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+image.length+' >>\nstream\n'),...image,...bytes('\nendstream')]),
    bytes('<< /Length '+bytes(stream).length+' >>\nstream\n'+stream+'endstream'));
 }
 objects[0]=bytes('<< /Type /Catalog /Pages 2 0 R >>');
 objects[1]=bytes('<< /Type /Pages /Count '+kids.length+' /Kids ['+kids.map(id=>id+' 0 R').join(' ')+'] >>');
 const chunks:Uint8Array[]=[bytes('%PDF-1.4\n%ZARAY\n')];let offset=chunks[0].length;const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(offset);const a=bytes((i+1)+' 0 obj\n'),end=bytes('\nendobj\n');chunks.push(a,objects[i]!,end);offset+=a.length+objects[i]!.length+end.length;}
 const xref=offset;
 const trailer=bytes('xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
 chunks.push(trailer);return new Blob(chunks as BlobPart[],{type:'application/pdf'});
}
