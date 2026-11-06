import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
import {normalizeTransparentSiteLogo} from '@/lib/site-logo-server';

export const dynamic = 'force-dynamic';

const SITE_NAME = /^[\p{L}\p{N} .,'’()&-]{2,120}$/u;

function json(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function verifiedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, response: json('Connectez-vous avant de continuer.', 401) };
  if (!user.email_confirmed_at) return { supabase, user: null, response: json('Vérifiez votre adresse e-mail avant de continuer.', 403) };
  return { supabase, user, response: null };
}

export async function GET() {
  try {
    const { supabase, user, response } = await verifiedClient();
    if (response || !user) return response ?? json('Authentification requise.', 401);

    const { data: memberships, error: membershipsError } = await supabase
      .from('company_members').select('company_id, role').eq('user_id', user.id).eq('status', 'active');
    if (membershipsError) throw membershipsError;

    const companyIds = (memberships ?? []).map((membership) => membership.company_id);
    if (!companyIds.length) {
      return NextResponse.json({ companies: [], sites: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const [{ data: companies, error: companiesError }, { data: sites, error: sitesError }] = await Promise.all([
      supabase.from('companies').select('id, legal_name, slug, status').in('id', companyIds).order('legal_name'),
      supabase.from('sites').select('id, company_id, name, status, address, contact_email, contact_phone, created_at').in('company_id', companyIds).order('name'),
    ]);
    if (companiesError) throw companiesError;
    if (sitesError) throw sitesError;

    const companyById = new Map((companies ?? []).map((company) => [company.id, company]));
    const roleByCompany = new Map((memberships ?? []).map((membership) => [membership.company_id, membership.role]));
    return NextResponse.json({
      companies: (companies ?? []).map((company) => ({ ...company, role: roleByCompany.get(company.id) })),
      sites: (sites ?? []).map((site) => {
        const company = companyById.get(site.company_id);
        return { ...site, company_name: company?.legal_name ?? '', company_slug: company?.slug ?? '' };
      }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('sites list failed', { code: (error as { code?: string }).code ?? 'unknown' });
    return json('Impossible de charger les entreprises et sites.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
    if(!body)return json('Données de création invalides.',400);
    const companyId=typeof body.companyId==='string'?body.companyId:'';
    const name=typeof body.name==='string'?body.name.trim():'';
    const address=typeof body.address==='string'?body.address.trim():'';
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const phone=typeof body.phone==='string'?body.phone.trim():'';
    const logo=typeof body.logoDataUri==='string'?body.logoDataUri:'';
    const colors=(body.palette&&typeof body.palette==='object'&&!Array.isArray(body.palette)
      ?body.palette:{}) as Record<string,unknown>;
    if(!SITE_NAME.test(name)||address.length<3||address.length>160||
       email.length>254||!/^\S+@\S+\.\S+$/.test(email)||
       phone.length<5||phone.length>32||!/^[+0-9(). /-]+$/.test(phone)||
       !logo)return json('Renseignez le nom, l’adresse, un e-mail, un téléphone et un logo PNG/WebP transparent.',400);
    const defaults={
      primary_color:'#167a46',secondary_color:'#ffffff',
      accent_color:'#0e9f6e',title_color:'#10251a',border_color:'#a5b9ad'
    };
    const palette=Object.fromEntries(Object.entries(defaults).map(([key,defaultColor])=>{
      const candidate=colors[key];
      return [key,typeof candidate==='string'&&/^#[0-9a-fA-F]{6}$/.test(candidate)?candidate:defaultColor];
    })) as typeof defaults;
    const session=await createClient();
    const permission=await authorizeTenant(session,companyId);
    if(!permission.ok)return json(permission.error,permission.status);
    if(!['owner','admin'].includes(permission.member.role))
      return json('La création de sites est réservée au propriétaire et aux administrateurs.',403);
    const service=createServiceClient();
    if(!service)return json('Service de création indisponible.',503);
    let processed:{dataUri:string};
    try{processed=await normalizeTransparentSiteLogo(logo);}
    catch(e){return json(e instanceof Error?e.message:'Logo transparent invalide.',400);}
    const {data,error}=await service.rpc('create_site_with_branding',{
      p_company_id:companyId,p_actor_user_id:permission.user.id,
      p_name:name,p_address:address,p_email:email,p_phone:phone,
      p_logo_data_uri:processed.dataUri,
      p_primary_color:palette.primary_color,
      p_secondary_color:palette.secondary_color,
      p_accent_color:palette.accent_color,
      p_title_color:palette.title_color,
      p_border_color:palette.border_color
    });
    if(error){
      if(error.code==='23505')return json('Ce nom de site est déjà utilisé dans cette entreprise.',409);
      if(error.message?.includes('site_company_inactive'))return json('Cette entreprise est suspendue ou inactive.',409);
      if(error.code==='42501')return json('Création non autorisée pour cette entreprise.',403);
      if(error.code==='22023')return json('Informations ou logo du site invalides.',400);
      console.error('site creation failed',{code:error.code});
      return json('Création du site impossible.',503);
    }
    return NextResponse.json({site:data,brandingReady:true},{
      status:201,headers:{'Cache-Control':'no-store'}
    });
  }catch(e){
    console.error('site creation failed',{code:(e as {code?:string}).code??'unknown'});
    return json('Service de création indisponible.',503);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, response } = await verifiedClient();
    if (response || !user) return response ?? json('Authentification requise.', 401);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json('Données invalides.', 400);
    const input = body as Record<string, unknown>;
    const siteId = typeof input.siteId === 'string' ? input.siteId : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (input.status !== undefined) return json('Le statut d’un site se modifie uniquement depuis les paramètres de gestion.', 400);
    if (!siteId || !SITE_NAME.test(name)) return json('Données de site invalides.', 400);

    const { data: site, error } = await supabase
      .from('sites')
      .update({ name })
      .eq('id', siteId)
      .select('id, company_id, name, status, created_at')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') return json('Ce nom de site existe déjà dans cette entreprise.', 409);
      if (error.code === '22P02') return json('Identifiant de site invalide.', 400);
      console.error('site update failed', { code: error.code });
      return json('Impossible de modifier le site.', 500);
    }
    if (!site) return json('Site inaccessible ou modification non autorisée.', 403);
    return NextResponse.json({ site }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('site update failed', { code: (error as { code?: string }).code ?? 'unknown' });
    return json('Impossible de modifier le site.', 500);
  }
}
