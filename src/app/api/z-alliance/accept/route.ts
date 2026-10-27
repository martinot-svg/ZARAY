import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  const headers={'Cache-Control':'no-store'};
  const body=await request.json().catch(()=>null) as {token?:unknown}|null;
  const token=body?.token;
  if(typeof token!=='string'|| !/^[0-9a-f]{64}$/.test(token))
    return NextResponse.json({error:'Lien d’invitation invalide.'},{status:400,headers});
  try {
    const client=await createClient();
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)return NextResponse.json({error:'Connectez-vous avec l’adresse invitée.',loginRequired:true},{status:401,headers});
    if(!user.email_confirmed_at)return NextResponse.json({error:'Confirmez d’abord votre adresse e-mail.'},{status:403,headers});
    const {data,error}=await client.rpc('zalliance_accept_invitation',{p_token:token});
    if(error)return NextResponse.json({error:error.code==='23505'?'Vous appartenez déjà à cette entreprise.':'Lien invalide, expiré, révoqué, déjà utilisé ou destiné à une autre adresse.'},{status:error.code==='23505'?409:403,headers});
    return NextResponse.json({membership:data},{headers});
  }catch{return NextResponse.json({error:'Service temporairement indisponible.'},{status:503,headers});}
}
