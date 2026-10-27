import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
const colors = ['primary_color','secondary_color','title_color','border_color'] as const;
const fonts = new Set(['Arial','Georgia','Verdana','Tahoma']);
const styles = new Set(['classic','event','minimal','corporate']);
const visualColors=['accent_color'] as const;
const visualBooleans=['gradient_enabled','decorations_enabled','show_price','show_duration','show_ticket_id','show_wifi_ssid'] as const;
const visualTexts={brand_name:90,wifi_ssid:64,phone:60,address:160,welcome_message:120,footer_text:100} as const;
const defaults = {
  primary_color:'#167a46', secondary_color:'#ffffff',title_color:'#10251a',
  border_color:'#a5b9ad',font_family:'Arial',username_length:5,password_length:12,
  template_key:'classic',accent_color:'#0e9f6e',gradient_enabled:false,decorations_enabled:true,
  brand_name:'',wifi_ssid:'',phone:'',address:'',welcome_message:'',footer_text:'',
  show_price:true,show_duration:true,show_ticket_id:false,show_wifi_ssid:false,
};
type Row = Partial<Record<keyof typeof defaults|'logo_data_uri',string|number|boolean|null>>;
async function authorized(companyId:string,siteId:string,offerId:string|null) {
  const supabase=await createClient();
  const access=await authorizeTenant(supabase,companyId,siteId);
  if(!access.ok)return {supabase,access,error:fail(access.error,access.status)};
  if(offerId){
    const {data:offer,error}=await supabase.from('offers').select('id').eq('id',offerId).eq('company_id',companyId).maybeSingle();
    if(error)return {supabase,access,error:fail('Offre indisponible.',503)};
    if(!offer)return {supabase,access,error:fail('Offre étrangère à cette entreprise.',404)};
  }
  return {supabase,access,error:null};
}
function getKeys(request:NextRequest,body?:Record<string,unknown>){
  const get=(key:string)=>String(body?.[key]??request.nextUrl.searchParams.get(key)??'');
  return {companyId:get('companyId'),siteId:get('siteId'),offerId:get('offerId')||null};
}
export async function GET(request:NextRequest){
  const {companyId,siteId,offerId}=getKeys(request);
  if(!companyId||!siteId)return fail('Entreprise et site requis.',400);
  try{
    const {supabase,error}=await authorized(companyId,siteId,offerId);if(error)return error;
    const {data, error:dbError}=await supabase.from('ticket_templates')
      .select('id,company_id,site_id,offer_id,logo_data_uri,primary_color,secondary_color,title_color,border_color,font_family,username_length,password_length,template_key,accent_color,gradient_enabled,decorations_enabled,brand_name,wifi_ssid,phone,address,welcome_message,footer_text,show_price,show_duration,show_ticket_id,show_wifi_ssid')
      .eq('company_id',companyId).eq('site_id',siteId);
    if(dbError)return fail('Paramètres indisponibles. Vérifiez la migration.',503);
    const base=(data??[]).find(r=>r.offer_id===null) as Row|undefined;
    const override=offerId?(data??[]).find(r=>r.offer_id===offerId) as Row|undefined:null;
    const settings={...defaults,...Object.fromEntries(Object.keys(defaults).map(key=>[key,override?.[key as keyof Row]??base?.[key as keyof Row]??defaults[key as keyof typeof defaults]])),logo_data_uri:base?.logo_data_uri??null};
    return NextResponse.json({settings,siteConfigured:!!base,offerConfigured:!!override},{headers});
  }catch{return fail('Service indisponible.',503);}
}
export async function PUT(request:NextRequest){
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body)return fail('Données invalides.',400);
  const {companyId,siteId,offerId}=getKeys(request,body);
  if(!companyId||!siteId)return fail('Entreprise et site requis.',400);
  try{
    const {supabase,access,error}=await authorized(companyId,siteId,offerId);if(error)return error;
    if(!access.ok||!['owner','admin','site_manager'].includes(access.member.role))return fail('Droits de configuration insuffisants.',403);
    const values:Record<string,string|number|boolean|null>={};
    for(const key of colors){
      const v=body[key];
      if(v===null && offerId){values[key]=null;continue;}
      if(typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v))return fail('Couleur incorrecte : '+key,400);
      values[key]=v;
    }
    if(body.font_family===null && offerId)values.font_family=null;
    else if(typeof body.font_family==='string'&&fonts.has(body.font_family))values.font_family=body.font_family;
    else return fail('Police non autorisée.',400);
    for(const key of ['username_length','password_length'] as const){
      const v=body[key];
      if(v===null&&offerId){values[key]=null;continue;}
      const n=Number(v);
      if(!Number.isInteger(n)||(key==='username_length'?(n<3||n>5):(n<12||n>32)))return fail('Longueur des identifiants invalide.',400);
      values[key]=n;
    }
    // Visual preferences never influence credential lengths or Wi-Fi provisioning.
    if(body.template_key===null && offerId)values.template_key=null;
    else if(typeof body.template_key==='string'&&styles.has(body.template_key))values.template_key=body.template_key;
    else return fail('Modèle graphique invalide.',400);
    for(const key of visualColors){
      const v=body[key];
      if(v===null&&offerId){values[key]=null;continue;}
      if(typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v))return fail('Couleur secondaire invalide.',400);
      values[key]=v;
    }
    for(const key of visualBooleans){
      const v=body[key];
      if(v===null&&offerId){values[key]=null;continue;}
      if(typeof v!=='boolean')return fail('Option d’affichage invalide : '+key,400);
      values[key]=v;
    }
    for(const [key,length] of Object.entries(visualTexts)){
      const v=body[key];
      if(v===null&&offerId){values[key]=null;continue;}
      if(typeof v!=='string'||v.length>length||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))
        return fail('Texte de personnalisation invalide : '+key,400);
      values[key]=v.trim();
    }
    if(!offerId){
      const logo=body.logo_data_uri;
      if(logo!==null&&typeof logo!=='string')return fail('Logo invalide.',400);
      if(typeof logo==='string'){
        const matched=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(logo);
        if(!matched||logo.length>180000)return fail('Logo trop volumineux ou format non autorisé.',400);
        const bytes=Buffer.from(matched[2],'base64');
        if(bytes.length>130000||bytes.length<12)return fail('Taille de logo invalide.',400);
        const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
        const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
        if(!(matched[1]==='png'&&png||matched[1]==='jpeg'&&jpg||matched[1]==='webp'&&webp))return fail('Signature du logo non valide.',400);
      }
      values.logo_data_uri=logo as string|null;
    }
    const {error:writeError}=await supabase.from('ticket_templates').upsert({
      company_id:companyId,site_id:siteId,offer_id:offerId,...values,updated_at:new Date().toISOString(),
    },{onConflict:'site_id,offer_id'});
    if(writeError){console.error('ticket template write',{code:writeError.code});return fail('Enregistrement refusé.',writeError.code==='42501'?403:503);}
    return NextResponse.json({saved:true},{headers});
  }catch{return fail('Service indisponible.',503);}
}
