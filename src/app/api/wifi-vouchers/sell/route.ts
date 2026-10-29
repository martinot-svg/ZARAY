import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
 const voucherId=typeof body?.voucherId==='string'?body.voucherId:'';
 const customerName=typeof body?.customerName==='string'?body.customerName.trim().slice(0,160):'Client occasionnel';
 if(!/^[0-9a-f-]{36}$/i.test(voucherId))return NextResponse.json({error:'Ticket invalide.'},{status:400});
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user||!user.email_confirmed_at)return NextResponse.json({error:'Connexion avec e-mail vérifié requise.'},{status:401});
 const {data,error}=await supabase.rpc('sell_wifi_voucher',{p_voucher_id:voucherId,p_customer_name:customerName||'Client occasionnel'});
 if(error){
  const status=error.code==='42501'?403:error.code==='P0002'?404:error.code==='23505'?409:error.code==='22023'?409:503;
  const message=error.message.includes('MikroTik connector not ready')?'Le routeur doit être connecté avant la vente.':
   error.code==='23505'?'Ticket déjà vendu.':error.code==='42501'?'Vente non autorisée.':
   error.message.includes('not generated for network')?'Ancien ticket : régénération réseau nécessaire.':'Vente impossible : vérifiez le site, le routeur et l’offre.';
  return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
 }
 return NextResponse.json({sale:data,message:'Vente encaissée. Activation demandée au MikroTik ; accès effectif à confirmer.'},{status:201,headers:{'Cache-Control':'no-store'}});
}
