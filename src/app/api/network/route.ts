import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeTenant } from '@/lib/tenant-context';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
function fail(error:string,status:number){return NextResponse.json({error},{status,headers});}
export async function GET(req:NextRequest){
 const companyId=req.nextUrl.searchParams.get('companyId')||'';
 const supabase=await createClient();
 const permission=await authorizeTenant(supabase,companyId);
 if(!permission.ok)return fail(permission.error,permission.status);
 const [routers,observations]=await Promise.all([
 supabase.from('network_routers').select('id,company_id,site_id,name,host,model,routeros_version,connection_mode,status,last_seen_at,created_at').eq('company_id',companyId).order('created_at',{ascending:false}),
 supabase.from('network_observations').select('id,router_id,observed_kind,identity_key,ip_address,mac_address,client_label,active,observed_at').eq('company_id',companyId).order('observed_at',{ascending:false}).limit(500)
 ]);
 if(routers.error||observations.error)return fail('Inventaire indisponible.',503);
 return NextResponse.json({routers:routers.data,observations:observations.data},{headers});
}
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=='object')return fail('Données invalides.',400);
 const {companyId,siteId,name,host}=body;
 if([companyId,siteId,name,host].some(x=>typeof x!=='string')||name.trim().length<2||name.length>120||host.length>255||!host.trim()||/[\\/\s@?#]/.test(host))return fail('Informations du routeur invalides.',400);
 const supabase=await createClient();
 const permission=await authorizeTenant(supabase,companyId,siteId);
 if(!permission.ok)return fail(permission.error,permission.status);
 if(!['owner','admin','administrator'].includes(permission.member.role))return fail('Seul un responsable autorisé peut enregistrer un routeur.',403);
 const {data,error}=await supabase.from('network_routers').insert({company_id:companyId,site_id:siteId,name:name.trim(),host:host.trim(),status:'unconfigured'}).select('id,name,status').single();
 if(error)return fail(error.code==='23505'?'Ce routeur existe déjà pour ce site.':'Enregistrement impossible.',error.code==='23505'?409:500);
 return NextResponse.json({router:data,message:'Routeur enregistré. Connecteur non associé : aucune découverte ni commande réseau active.'},{status:201,headers});
}
