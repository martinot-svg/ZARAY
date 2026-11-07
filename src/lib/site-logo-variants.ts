/** Site-specific logo selection without recoloring or modifying artwork. */
export type SiteLogoPair={logoLightDataUri?:string|null;logoDarkDataUri?:string|null;logoDataUri?:string|null};
export function darkSurface(background:string){
 if(!/^#[0-9a-f]{6}$/i.test(background))return true;
 const c=[1,3,5].map(i=>{
  const s=parseInt(background.slice(i,i+2),16)/255;
  return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);
 });
 return .2126*c[0]+.7152*c[1]+.0722*c[2]<=.179;
}
/** The light artwork sits on dark backgrounds; dark artwork on light ones. */
export function siteLogoForSurface(pair:SiteLogoPair|null|undefined,background:string){
 if(!pair)return null;
 const light=pair.logoLightDataUri||pair.logoDataUri||null;
 const dark=pair.logoDarkDataUri||pair.logoDataUri||null;
 return darkSurface(background)?light||dark:dark||light;
}
