import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});

export async function GET(){
 try{
  const session=await createClient();
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.email_confirmed_at)return json({error:'Connexion vérifiée requise.'},401);
  const {data:members,error:memberError}=await session.from('company_members')
   .select('company_id,role').eq('user_id',user.id).eq('status','active');
  if(memberError)return json({error:'Autorisations indisponibles.'},503);
  const companyIds=(members||[]).filter(m=>m.role==='site_manager').map(m=>m.company_id);
  if(!companyIds.length)return json({sites:[]});
  const service=createServiceClient();
  if(!service)return json({error:'Service indisponible.'},503);
  const {data,error:assignmentError}=await service.from('site_notification_assignments')
   .select('company_id,site_id').eq('user_id',user.id).in('company_id',companyIds);
  if(assignmentError)return json({error:'Sites autorisés indisponibles.'},503);
  return json({sites:data||[]});
 }catch{return json({error:'Sites autorisés indisponibles.'},503);}
}
