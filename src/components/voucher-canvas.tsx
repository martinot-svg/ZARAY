'use client';
import { useEffect, useRef } from 'react';
import {
  loadVoucherLogo,paintVoucher,TICKET_PIXEL_WIDTH,TICKET_PIXEL_HEIGHT,
  type PrintableVoucher,type TicketVisual
} from '@/lib/ticket-pdf';

/** Shared physical geometry for browser preview, HTML print and A4 PDF export. */
export default function VoucherCanvas({ticket,design,siteName,preview=false}:{
 ticket:PrintableVoucher;design:TicketVisual;siteName:string;preview?:boolean;
}){
 const element=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
   let alive=true;
   (async()=>{
     const logo=await loadVoucherLogo(design.logo_data_uri);
     if(!alive||!element.current)return;
     const canvas=element.current;
     canvas.width=TICKET_PIXEL_WIDTH;canvas.height=TICKET_PIXEL_HEIGHT;
     const ctx=canvas.getContext('2d');if(!ctx)return;
     ctx.clearRect(0,0,canvas.width,canvas.height);
     paintVoucher(ctx,0,0,ticket,design,siteName,logo);
   })();
   return()=>{alive=false};
 },[ticket,design,siteName]);
 return <canvas ref={element} width={TICKET_PIXEL_WIDTH} height={TICKET_PIXEL_HEIGHT}
   className={preview?'zaray-voucher-preview-canvas':'zaray-voucher-print-canvas'}
   role="img" aria-label={preview?'Aperçu fictif du ticket Wi-Fi':'Ticket Wi-Fi '+ticket.username+', forfait '+ticket.offer_name}
   style={preview?{display:'block',width:'min(100%,600px)',height:'auto',aspectRatio:'3/1',background:design.secondary_color}:
     {display:'block',width:'60mm',height:'20mm',background:design.secondary_color}}/>;
}
