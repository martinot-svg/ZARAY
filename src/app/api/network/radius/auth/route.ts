import {NextRequest,NextResponse} from 'next/server';
import {createServiceClient} from '@/lib/supabase/service';
import {radiusTokenHash,verifyRadiusPassword} from '@/lib/network-radius-crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const deny=()=>new NextResponse(null,{status:401,headers:{'Cache-Control':'no-store'}});
const unavailable=()=>new NextResponse(null,{status:503,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 const token=/^Bearer ([a-f0-9]{64})$/i.exec(req.headers.get('authorization')||'')?.[1];
 const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const routerId=typeof b?.routerId==='string'?b.routerId:'';
 const username=typeof b?.username==='string'?b.username.trim():'';
 const password=b?.password,protocol=b?.protocol;
 if(!token||!uuid.test(routerId)||!username||username.length>128||
  typeof password!=='string'||password.length>128||!['hotspot','pppoe'].includes(String(protocol)))return deny();
 const service=createServiceClient();if(!service)return unavailable();
 const {data:gateway,error:gateError}=await service.from('network_radius_gateways')
  .select('company_id,enabled').eq('router_id',routerId).eq('secret_hash',radiusTokenHash(token)).maybeSingle();
 if(gateError)return unavailable();
 if(!gateway||!gateway.enabled)return deny(); // Explicit commissioning required.
 const companyId=gateway.company_id;
 const [{data:router,error:routerError},{data:company,error:companyError},{data:site,error:siteError},{data:account,error:accountError}]=await Promise.all([
  service.from('network_routers').select('id,site_id,control_enabled').eq('id',routerId).eq('company_id',companyId).maybeSingle(),
  service.from('companies').select('status').eq('id',companyId).maybeSingle(),
  service.from('sites').select('id,status').eq('company_id',companyId).eq('id',routerId).maybeSingle(),
  service.from('network_access_accounts').select('id,order_id,desired_state,administrative_hold,expires_at,grace_until,extension_until')
   .eq('company_id',companyId).eq('router_id',routerId).eq('protocol',protocol).eq('username',username).maybeSingle()
 ]);
 if(routerError||companyError||siteError||accountError)return unavailable();
 if(!router||!company||!account||!router.control_enabled||!['trial','active'].includes(company.status))return deny();
 // Tenant-scoped site status is fetched by the router's site_id, never by a client-supplied ID.
 const {data:realSite,error:realSiteError}=await service.from('sites').select('status')
  .eq('id',router.site_id).eq('company_id',companyId).maybeSingle();
 if(realSiteError)return unavailable();
 if(!realSite||realSite.status!=='active'||account.administrative_hold||account.desired_state!=='active'||!account.order_id)return deny();
 const validUntil=Math.max(...[account.expires_at,account.grace_until,account.extension_until]
  .filter((x):x is string=>typeof x==='string'&&x.length>0).map(x=>new Date(x).getTime()),0);
 if(!Number.isFinite(validUntil)||validUntil<Date.now())return deny();
 const [{data:order,error:orderError},{data:credential,error:credentialError}]=await Promise.all([
  service.from('subscription_orders').select('site_id,status,paid_at').eq('id',account.order_id).eq('company_id',companyId).maybeSingle(),
  service.from('network_radius_credentials').select('password_salt,password_hash').eq('account_id',account.id)
   .eq('company_id',companyId).eq('router_id',routerId).maybeSingle()
 ]);
 if(orderError||credentialError)return unavailable();
 if(!order||order.site_id!==router.site_id||!order.paid_at||!['paid','active','activation_pending'].includes(order.status)||!credential)return deny();
 const valid=await verifyRadiusPassword(password,credential.password_salt,credential.password_hash);
 if(!valid)return deny();
 void service.from('network_radius_gateways').update({last_auth_at:new Date().toISOString()})
  .eq('router_id',routerId).eq('company_id',companyId).then(()=>{});
 return new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
