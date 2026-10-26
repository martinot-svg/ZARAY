'use client';

import Image from 'next/image';
import { useLayoutEffect, useRef, useState } from 'react';
import { surfaceTone, type LogoTone } from '@/lib/logo-surface';

type BrandLogoProps = { priority?: boolean; className?: string };

/** Unmodified official ZARAY PNGs; the nearest actual painted surface selects the colorway. */
export default function BrandLogo({ priority = false, className = '' }: BrandLogoProps) {
  const holder=useRef<HTMLSpanElement>(null);
  const [tone,setTone]=useState<LogoTone | null>(null);

  useLayoutEffect(()=>{
    const element=holder.current;
    if(!element)return;
    const update=()=>setTone(previous=>{
      const next=surfaceTone(element,window);
      return previous===next ? previous : next;
    });
    update();
    const observer=new MutationObserver(update);
    for(let ancestor: HTMLElement | null=element.parentElement; ancestor; ancestor=ancestor.parentElement){
      observer.observe(ancestor,{attributes:true,attributeFilter:['class','style','data-theme','data-logo-surface']});
    }
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change',update);
    window.addEventListener('resize',update,{passive:true});
    const handleStorage=(event:StorageEvent)=>{if(event.key==='zaray-theme')update();};
    window.addEventListener('storage',handleStorage);
    return ()=>{
      observer.disconnect();
      media.removeEventListener('change',update);
      window.removeEventListener('resize',update);
      window.removeEventListener('storage',handleStorage);
    };
  },[]);

  return <span ref={holder} role="img" aria-label="ZARAY"
    data-logo-tone={tone ?? undefined}
    className={['brand-logo',className].filter(Boolean).join(' ')}>
    <Image src="/brand/zaray-noir-vert-original.png" width={2048} height={746}
      alt="" aria-hidden="true" priority={priority} unoptimized
      className="brand-logo-variant brand-logo-light" />
    <Image src="/brand/zaray-blanc-vert-original.png" width={2048} height={682}
      alt="" aria-hidden="true" priority={priority} unoptimized
      className="brand-logo-variant brand-logo-dark" />
  </span>;
}
