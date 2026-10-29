import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {authorizeTenant} from '@/lib/tenant-context';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const companyId=req.nextUrl.searchParams.get('companyId')||'',siteId=req.nextUrl.searchParams.get('siteId')||'';
 const client=await createClient();
 const access=await authorizeTenant(client,companyId,siteId);
 if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
 const [activations,stocks]=await Promise.all([
  client.from('wifi_voucher_activations').select('voucher_id,amount,currency,activated_at')
   .eq('company_id',companyId).eq('site_id',siteId).order('activated_at',{ascending:false}).limit(4000),
  client.from('wifi_vouchers').select('id,status')
   .eq('company_id',companyId).eq('site_id',siteId).limit(4000)
 ]);
 if(activations.error||stocks.error)return NextResponse.json({error:'Statistiques indisponibles.'},{status:503});
 const revenue=new Map<string,number>(),daily=new Map<string,{count:number;amount:Record<string,number>}>();
 const today=new Date().toISOString().slice(0,10);
 let todayActivated=0;
 for(const row of activations.data??[]){
  revenue.set(row.currency,(revenue.get(row.currency)||0)+Number(row.amount));
  const day=row.activated_at.slice(0,10);
  if(day===today)todayActivated++;
  const d=daily.get(day)||{count:0,amount:{}};d.count++;
  d.amount[row.currency]=(d.amount[row.currency]||0)+Number(row.amount);daily.set(day,d);
 }
 const statuses:Record<string,number>={};for(const item of stocks.data??[])statuses[item.status]=(statuses[item.status]||0)+1;
 return NextResponse.json({
  totals:{generated:(stocks.data??[]).length,available:statuses.available||0,activated:(activations.data??[]).length,todayActivated,expired:statuses.expired||0,cancelled:statuses.cancelled||0},
  activatedValue:[...revenue].map(([currency,amount])=>({currency,amount})),
  daily:[...daily].slice(0,30).map(([date,data])=>({date,...data})),
  note:'Montants correspondant aux premières connexions réussies. Ce ne sont pas des espèces encaissées et vérifiées à la caisse.',
  truncated:(stocks.data??[]).length===4000||(activations.data??[]).length===4000
 },{headers:{'Cache-Control':'no-store'}});
}
