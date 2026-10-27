import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 const headers={'Cache-Control':'no-store'};
 const input=await request.json().catch(()=>null) as {token?:unknown}|null;
 const token=input?.token;
 if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token))
   return NextResponse.json({error:'Lien invalide.'},{status:400,headers});
 try{
   const client=await createClient();
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user)return NextResponse.json({error:'Connexion requise.',loginRequired:true},{status:401,headers});
   if(!user.email_confirmed_at)return NextResponse.json({error:'Confirmez votre adresse e-mail.'},{status:403,headers});
   const {data,error}=await client.rpc('zalliance_preview_invitation',{p_token:token});
   if(error)return NextResponse.json({error:'Invitation indisponible, expirée ou destinée à une autre adresse.'},{status:403,headers});
   return NextResponse.json({invitation:data},{headers});
 }catch{return NextResponse.json({error:'Service temporairement indisponible.'},{status:503,headers});}
}
