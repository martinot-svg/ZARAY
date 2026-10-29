import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {authorizeTenant} from '@/lib/tenant-context';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null) as {companyId?:string;siteId?:string;voucherId?:string;reason?:string}|null;
 const companyId=b?.companyId||'',siteId=b?.siteId||'',voucherId=b?.voucherId||'',reason=b?.reason?.trim()||'';
 const reply=(error:string,status:number)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(!/^[0-9a-f-]{36}$/i.test(voucherId)||reason.length<5||reason.length>600)return reply('Ticket et motif de révocation obligatoires.',400);
 const auth=await authorizeTenant(await createClient(),companyId,siteId);
 if(!auth.ok)return reply(auth.error,auth.status);
 if(!['owner','admin','site_manager'].includes(auth.member.role))return reply('Rôle non autorisé.',403);
 const service=createServiceClient();if(!service)return reply('Service indisponible.',503);
 // Conditional update ensures a first redeemed ticket is never revoked as unsold stock.
 const {data:voucher,error}=await service.from('wifi_vouchers').update({status:'cancelled'})
  .eq('id',voucherId).eq('company_id',companyId).eq('site_id',siteId).eq('status','available')
  .select('id,username').maybeSingle();
 if(error||!voucher)return reply('Ticket introuvable ou déjà activé ; annulation du stock refusée.',409);
 const {data:net}=await service.from('wifi_voucher_network').select('router_id').eq('voucher_id',voucherId).eq('company_id',companyId).maybeSingle();
 if(net){
  await service.from('network_commands').update({status:'cancelled',completed_at:new Date().toISOString(),outcome:'Stock révoqué'})
   .eq('voucher_id',voucherId).eq('action','provision_voucher').eq('status','queued');
  const {error:queueError}=await service.from('network_commands').insert({
   company_id:companyId,router_id:net.router_id,voucher_id:voucherId,protocol:'hotspot',
   username:voucher.username,action:'expire_voucher',created_by:auth.user.id,reason
  });
  if(queueError)return reply('Ticket révoqué en base ; coupure MikroTik en attente de réconciliation.',503);
 }
 await service.from('network_access_events').insert({
  company_id:companyId,actor_user_id:auth.user.id,event_type:'wifi.voucher_revoked',reason:'Ticket '+voucherId+': '+reason
 });
 return NextResponse.json({cancelled:true,message:'Ticket retiré du stock ; désactivation MikroTik demandée.'},{headers:{'Cache-Control':'no-store'}});
}
