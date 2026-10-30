import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {authorizeTenant} from '@/lib/tenant-context';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Subscription={
 id:string;company_id:string;customer_id:string;site_id:string|null;
 first_order_id:string;latest_order_id:string;latest_paid_order_id:string|null;
 offer_id:string;offer_name:string;validity_days:number;
 paid_cycles:number;activated_cycles:number;last_paid_at:string|null;
 activated_at:string|null;expires_at:string|null;created_at:string;updated_at:string;
 customers:{full_name:string;email:string|null;phone:string|null}|null;
};
const columns='id,company_id,customer_id,site_id,first_order_id,latest_order_id,latest_paid_order_id,offer_id,offer_name,validity_days,paid_cycles,activated_cycles,last_paid_at,activated_at,expires_at,created_at,updated_at,customers(full_name,email,phone)';
const summary={total:0,active:0,expiring:0,expired:0,waiting_payment:0,waiting_activation:0};

export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams;
 const companyId=p.get('companyId')||'';
 const siteId=p.get('siteId')||null;
 const page=Math.max(1,Math.min(10000,Number(p.get('page')||1)||1));
 const pageSize=Math.max(1,Math.min(100,Number(p.get('pageSize')||25)||25));
 const search=(p.get('search')||'').trim();
 const state=p.get('state')||'all';
 const subscriptionId=p.get('subscriptionId')||'';
 if(!uuid.test(companyId)||siteId&&!uuid.test(siteId))return json({error:'Entreprise ou site invalide.'},400);
 if(subscriptionId&&!uuid.test(subscriptionId))return json({error:'Abonnement invalide.'},400);
 if(search.length>100||!['all','active','expiring','expired','waiting_payment','waiting_activation'].includes(state))return json({error:'Filtres invalides.'},400);
 try{
  const session=await createClient();
  const permission=await authorizeTenant(session,companyId,siteId);
  if(!permission.ok)return json({error:permission.error},permission.status);
  let list=session.from('residential_subscriptions')
   .select(columns,{count:'exact'}).eq('company_id',companyId);
  if(siteId)list=list.eq('site_id',siteId);
  if(subscriptionId)list=list.eq('id',subscriptionId);
  if(search){
   // Avoid vulnerable PostgREST OR grammar: perform client-name/email matching through
   // an RLS-protected customer lookup rather than injecting filter syntax.
   const q=search.replace(/[^\p{L}\p{N}@._+ -]/gu,'').slice(0,75);
   const [customers,orders]=await Promise.all([
    session.from('customers').select('id').eq('company_id',companyId)
      .or('full_name.ilike.%'+q+'%,email.ilike.%'+q+'%,phone.ilike.%'+q+'%').limit(250),
    session.from('subscription_orders').select('customer_id').eq('company_id',companyId)
      .ilike('public_reference','%'+q+'%').limit(250)
   ]);
   if(customers.error||orders.error)return json({error:'Recherche indisponible.'},503);
   const ids=[...new Set([...(customers.data||[]).map(c=>c.id),...(orders.data||[]).map(o=>o.customer_id).filter((v):v is string=>!!v)])];
   if(!ids.length)return json({subscriptions:[],total:0,page,pageSize,summary:summary,cycles:[]});
   list=list.in('customer_id',ids);
  }
  const now=new Date().toISOString();
  const seven=new Date(Date.now()+7*86400000).toISOString();
  if(state==='active')list=list.gt('expires_at',now);
  if(state==='expiring')list=list.gt('expires_at',now).lte('expires_at',seven);
  if(state==='expired')list=list.lte('expires_at',now);
  if(state==='waiting_payment')list=list.eq('paid_cycles',0);
  // pending activation cannot be queried with cross-column PostgREST comparison;
  // the API uses the dedicated secure invoker summary and filters using IDs.
  if(state==='waiting_activation'){
   const pending=await session.rpc('residential_subscription_pending_ids',{p_company_id:companyId,p_site_id:siteId});
   if(pending.error)return json({error:'Suivi des activations indisponible.'},503);
   const ids=(pending.data||[]) as string[];
   if(!ids.length)return json({subscriptions:[],total:0,page,pageSize,summary:summary,cycles:[]});
   list=list.in('id',ids);
  }
  const offset=(page-1)*pageSize;
  const [result,counts]=await Promise.all([
   list.order('updated_at',{ascending:false}).range(offset,offset+pageSize-1),
   session.rpc('residential_subscription_summary',{p_company_id:companyId,p_site_id:siteId})
  ]);
  if(result.error||counts.error)return json({error:'Abonnements temporairement indisponibles.'},503);
  const subscriptions=(result.data||[]) as unknown as Subscription[];
  let cycles:Record<string,unknown>[]=[];
  const focused=subscriptionId || (subscriptions.length===1?subscriptions[0].id:'');
  if(focused){
   const response=await session.from('residential_subscription_cycles')
    .select('id,subscription_id,order_id,paid_at,activated_at,period_start,period_end,validity_days,offer_name,amount,currency')
    .eq('company_id',companyId).eq('subscription_id',focused).order('paid_at',{ascending:false}).limit(30);
   if(response.error)return json({error:'Historique indisponible.'},503);
   cycles=response.data||[];
  }
  return json({subscriptions,total:result.count||0,page,pageSize,summary:counts.data||summary,cycles});
 }catch{return json({error:'Service indisponible.'},503);}
}

export async function POST(request:NextRequest){
 const b=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof b?.companyId==='string'?b.companyId:'';
 const subscriptionId=typeof b?.subscriptionId==='string'?b.subscriptionId:'';
 if(!uuid.test(companyId)||!uuid.test(subscriptionId))return json({error:'Entreprise ou abonnement invalide.'},400);
 try{
  const session=await createClient();
  const permission=await authorizeTenant(session,companyId);
  if(!permission.ok)return json({error:permission.error},permission.status);
  if(!['owner','admin','site_manager','sales'].includes(permission.member.role))
   return json({error:'Seul un responsable commercial autorisé peut demander un renouvellement.'},403);
  const sub=await session.from('residential_subscriptions').select('id').eq('id',subscriptionId).eq('company_id',companyId).maybeSingle();
  if(sub.error||!sub.data)return json({error:'Abonnement introuvable.'},404);
  const result=await session.rpc('request_residential_renewal',{p_subscription_id:subscriptionId});
  if(result.error){
   if(result.error.code==='42501')return json({error:'Action non autorisée.'},403);
   if(result.error.code==='P0002')return json({error:'Abonné ou forfait indisponible.'},409);
   return json({error:'Impossible de créer la demande de renouvellement.'},503);
  }
  return json({order:result.data,message:'Demande de renouvellement créée. Aucun service ne sera prolongé sans règlement et confirmation réseau.'},201);
 }catch{return json({error:'Service indisponible.'},503);}
}


export async function PATCH(request:NextRequest){
 const b=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const companyId=typeof b?.companyId==='string'?b.companyId:'';
 const subscriptionId=typeof b?.subscriptionId==='string'?b.subscriptionId:'';
 const siteId=typeof b?.siteId==='string'?b.siteId:'';
 if(!uuid.test(companyId)||!uuid.test(subscriptionId)||!uuid.test(siteId))
  return json({error:'Entreprise, abonnement ou site invalide.'},400);
 try{
  const session=await createClient();
  const permission=await authorizeTenant(session,companyId);
  if(!permission.ok)return json({error:permission.error},permission.status);
  if(!['owner','admin'].includes(permission.member.role))
   return json({error:'La désignation du site est réservée au dirigeant et aux administrateurs.'},403);
  const result=await session.rpc('assign_residential_subscription_site',{
   p_subscription_id:subscriptionId,p_site_id:siteId
  });
  if(result.error){
   if(result.error.code==='42501')return json({error:'Action non autorisée.'},403);
   if(result.error.message?.includes('site_already_assigned')||
      result.error.message?.includes('network_account_already_bound'))
    return json({error:'Cet abonnement possède déjà un site ou un compte réseau. Un transfert encadré est nécessaire.'},409);
   if(result.error.code==='P0002')return json({error:'Site ou abonnement introuvable.'},404);
   return json({error:'Impossible d’affecter le site.'},503);
  }
  return json({assignment:result.data,message:'Site associé au dossier résidentiel et aux commandes correspondantes.'});
 }catch{return json({error:'Service indisponible.'},503);}
}
