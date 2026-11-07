import {createClient} from '@/lib/supabase/client';

/** A small, memory-only directory cache helps rapid module switching without
 * caching HTTP authentication responses on disk. Every read is bound to the
 * browser's current Supabase user. Protected APIs continue to verify access.
 */
let inFlight: Promise<Response> | null = null;
let inFlightUser = '';
let snapshot:{user:string;response:Response;expires:number}|null=null;
let currentUser='';
let subscribed=false;
const MAX_AGE_MS=6000;

export function invalidateWorkspaceDirectory(){
 inFlight = null;
 inFlightUser='';
 snapshot=null;
}
function watchSession(){
 if(subscribed||typeof window==='undefined')return;
 subscribed=true;
 createClient().auth.onAuthStateChange((event)=>{
  if(['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event))
   invalidateWorkspaceDirectory();
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')invalidateWorkspaceDirectory();
 });
}
export async function fetchWorkspaceDirectory({fresh=false}:{fresh?:boolean}={}):Promise<Response>{
 watchSession();
 let user='';
 try{
  const {data}=await createClient().auth.getSession();
  user=data.session?.user.id||'';
 }catch{/* A server-authenticated request still performs its own auth check. */}
 if(user!==currentUser){
  invalidateWorkspaceDirectory();
  currentUser=user;
 }
 if(!fresh&&user&&snapshot?.user===user&&snapshot.expires>Date.now())
  return snapshot.response.clone();
 if(inFlight&&inFlightUser===user)
  return inFlight.then(response=>response.clone());

 // Keep server Cache-Control:no-store and never store a 401/403.
 const request=fetch('/api/sites',{cache:'no-store'});
 inFlight=request;inFlightUser=user;
 void request.then(
  response=>{
   if(inFlight===request){
    if(user&&response.ok)
     snapshot={user,response:response.clone(),expires:Date.now()+MAX_AGE_MS};
    else snapshot=null;
    inFlight = null;inFlightUser='';
   }
  },
  ()=>{
   if(inFlight===request){inFlight = null;inFlightUser='';snapshot=null;}
  }
 );
 return request.then(response=>response.clone());
}
