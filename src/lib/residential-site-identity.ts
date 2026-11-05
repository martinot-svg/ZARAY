import 'server-only';
import {createServiceClient} from '@/lib/supabase/service';

/** Public site identity: only owner-approved display fields, never credentials or private company data. */
const hex=(v:unknown, fallback:string) => typeof v==='string' && /^#[0-9a-fA-F]{6}$/.test(v)?v:fallback;
const logo=(v:unknown) => typeof v==='string' && v.length<=180000 &&
 /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)?v:null;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ResidentialSiteIdentity={
 siteId:string;siteName:string;companySlug:string;brandName:string;
 logoDataUri:string|null;primaryColor:string;secondaryColor:string;
 accentColor:string;titleColor:string;welcomeMessage:string;
};

export async function publicResidentialSite(siteId:string):Promise<ResidentialSiteIdentity|null>{
 if(!uuid.test(siteId))return null;
 const service=createServiceClient();
 if(!service)throw new Error('Site identity backend unavailable');
 const {data:site,error:siteError}=await service.from('sites')
  .select('id,company_id,name,status').eq('id',siteId).maybeSingle();
 if(siteError)throw new Error('Site lookup unavailable');
 if(!site||!['active','planned'].includes(site.status))return null;
 const [{data:company,error:companyError},{data:template,error:templateError}]=await Promise.all([
  service.from('companies').select('id,slug,status').eq('id',site.company_id).maybeSingle(),
  service.from('ticket_templates')
   .select('brand_name,logo_data_uri,primary_color,secondary_color,accent_color,title_color,welcome_message')
   .eq('company_id',site.company_id).eq('site_id',siteId).is('offer_id',null).maybeSingle()
 ]);
 if(companyError||templateError)throw new Error('Site branding unavailable');
 if(!company||!['active','trial'].includes(company.status))return null;
 return {
  siteId:site.id,siteName:site.name,companySlug:company.slug,
  brandName:(template?.brand_name||'').trim().slice(0,90)||site.name,
  logoDataUri:logo(template?.logo_data_uri),
  primaryColor:hex(template?.primary_color,'#167a46'),
  secondaryColor:hex(template?.secondary_color,'#ffffff'),
  accentColor:hex(template?.accent_color,'#0e9f6e'),
  titleColor:hex(template?.title_color,'#10251a'),
  welcomeMessage:String(template?.welcome_message||'').slice(0,120),
 };
}
