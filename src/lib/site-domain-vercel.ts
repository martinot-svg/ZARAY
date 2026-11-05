import 'server-only';

type ProjectDomain={
 name:string;verified:boolean;
 verification?:Array<{type:string;domain:string;value:string;reason?:string}>;
};
export type DomainCheck={
 integrationReady:boolean;verified:boolean;dnsConfigured:boolean;
 active:boolean;challenge:Array<{type:string;domain:string;value:string}>;
};

/** The Vercel token must remain server-only. No stored hostname is trusted before both checks. */
function connection(){
 const token=process.env.ZARAY_VERCEL_API_TOKEN||'';
 const project=process.env.ZARAY_VERCEL_PROJECT_ID||'';
 const team=process.env.ZARAY_VERCEL_TEAM_ID||'';
 return token&&project&&team?{token,project,team}:null;
}
export const vercelDomainIntegrationReady=()=>Boolean(connection());

async function request(path:string,options?:{method?:string;body?:unknown}){
 const credentials=connection();
 if(!credentials)throw new Error('Intégration Vercel non configurée.');
 const url='https://api.vercel.com'+path+(path.includes('?')?'&':'?')+'teamId='+encodeURIComponent(credentials.team);
 const response=await fetch(url,{
  method:options?.method||'GET',
  headers:{Authorization:'Bearer '+credentials.token,'Content-Type':'application/json'},
  ...(options?.body?{body:JSON.stringify(options.body)}:{}),
  cache:'no-store',signal:AbortSignal.timeout(12000),
 });
 const data=await response.json().catch(()=>({})) as Record<string,unknown>;
 if(!response.ok)throw new Error(
  typeof data.error==='object'&&data.error&&'message' in data.error
   ?String((data.error as {message?:string}).message).slice(0,160)
   :'Vérification Vercel indisponible.'
 );
 return data;
}

async function projectDomain(hostname:string){
 const credentials=connection();
 if(!credentials)throw new Error('Intégration Vercel non configurée.');
 return await request('/v9/projects/'+encodeURIComponent(credentials.project)
  +'/domains/'+encodeURIComponent(hostname)) as unknown as ProjectDomain;
}

/** Can register a domain, but activation requires verified project ownership AND DNS. */
export async function checkSiteProjectDomain(hostname:string,action:'register'|'verify'):Promise<DomainCheck>{
 const credentials=connection();
 if(!credentials)return {integrationReady:false,verified:false,dnsConfigured:false,active:false,challenge:[]};
 if(action==='register'){
  try{
   await request('/v10/projects/'+encodeURIComponent(credentials.project)+'/domains',
    {method:'POST',body:{name:hostname}});
  }catch(error){
   // A hostname already attached to this project is fine, never to another project.
   await projectDomain(hostname).catch(()=>{throw error;});
  }
 }
 let domain=await projectDomain(hostname);
 if(action==='verify'&&!domain.verified){
  try{
   domain=await request('/v9/projects/'+encodeURIComponent(credentials.project)+'/domains/'+encodeURIComponent(hostname)+'/verify',
    {method:'POST'}) as unknown as ProjectDomain;
  }catch{
   domain=await projectDomain(hostname);
  }
 }
 // Vercel project verification alone is insufficient: the DNS must reach this project.
 const dns=await request('/v6/domains/'+encodeURIComponent(hostname)+'/config'
  +'?projectIdOrName='+encodeURIComponent(credentials.project));
 const verified=domain.verified===true;
 const dnsConfigured=dns.misconfigured===false;
 return {
  integrationReady:true,verified,dnsConfigured,active:verified&&dnsConfigured,
  challenge:(domain.verification||[]).filter(v=>v.type&&v.domain&&v.value)
   .map(v=>({type:v.type,domain:v.domain,value:v.value})),
 };
}
