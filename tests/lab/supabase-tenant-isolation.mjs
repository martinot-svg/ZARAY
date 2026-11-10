// Run manually against a DEDICATED Supabase lab, never production.
// Credentials are accepted only through local environment variables.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const env=process.env;
const ref=env.ZARAY_LAB_PROJECT_REF||'';
const url=env.ZARAY_LAB_SUPABASE_URL||'';
const apikey=env.ZARAY_LAB_PUBLISHABLE_KEY||'';
const jwtA=env.ZARAY_LAB_ADMIN_A_JWT||'';
const jwtB=env.ZARAY_LAB_ADMIN_B_JWT||'';
const companyA=env.ZARAY_LAB_COMPANY_A||'',companyB=env.ZARAY_LAB_COMPANY_B||'';
const routerA=env.ZARAY_LAB_ROUTER_A||'';
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
if(!/^[a-z0-9]{20}$/.test(ref)||ref==='hosyeygtaksbahnxxiqf'||
 url!=='https://'+ref+'.supabase.co')
 throw Error('Refused to run on production or without a verified lab project.');
if(!apikey||!jwtA||!jwtB||!uuid.test(companyA)||!uuid.test(companyB)||
 !uuid.test(routerA)||companyA===companyB)
 throw Error('Missing lab-only token or fixture IDs. Never paste credentials in chat.');
const base=url+'/rest/v1';
async function query(table,params,jwt,method='GET',body){
 const response=await fetch(base+'/'+table+'?'+params,{
  method,
  headers:{apikey,Authorization:'Bearer '+jwt,'Content-Type':'application/json',
   Prefer:'count=exact'},
  body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(8000)
 });
 const content=await response.text();
 let data;try{data=JSON.parse(content);}catch{data=null;}
 return {status:response.status,data};
}
const results={projectRefMatched:true,checks:{}};
const test=(name,condition)=>{results.checks[name]=Boolean(condition);assert.ok(condition,name);};
const tenantA=await query('network_observations',
 'select=id,company_id,router_id&company_id=eq.'+companyA+'&router_id=eq.'+routerA+'&limit=50',jwtA);
test('A_read_own',tenantA.status===200&&Array.isArray(tenantA.data)&&tenantA.data.length>0);
const tenantBReadA=await query('network_observations',
 'select=id&company_id=eq.'+companyA+'&router_id=eq.'+routerA+'&limit=1',jwtB);
test('B_cannot_read_A',tenantBReadA.status===200&&Array.isArray(tenantBReadA.data)&&tenantBReadA.data.length===0);
const tenantAReadB=await query('network_observations',
 'select=id&company_id=eq.'+companyB+'&limit=1',jwtA);
test('A_cannot_read_B',tenantAReadB.status===200&&Array.isArray(tenantAReadB.data)&&tenantAReadB.data.length===0);
const sources=await query('network_inventory_sources',
 'select=router_id,observed_kind,complete,observed_at&company_id=eq.'+companyA+'&router_id=eq.'+routerA,jwtA);
test('source_table_migration',sources.status===200&&Array.isArray(sources.data));
const rejectedWrite=await query('network_inventory_sources','',jwtA,'POST',{
 router_id:routerA,company_id:companyA,observed_kind:'interface',
 reported_count:0,collected_count:0,complete:true
});
test('browser_source_write_denied',[401,403].includes(rejectedWrite.status));
const count=tenantA.data.length;
if(count===50){
 const second=await query('network_observations',
  'select=id&company_id=eq.'+companyA+'&router_id=eq.'+routerA+'&limit=50&offset=50',jwtA);
 test('pagination_second_page',second.status===200&&Array.isArray(second.data));
 results.paginationRowsSecondPage=Array.isArray(second.data)?second.data.length:0;
}else results.pagination='fixture has fewer than 50 records; complete pagination test requires at least 51';
await mkdir('artifacts/mikrotik-lab',{recursive:true});
await writeFile('artifacts/mikrotik-lab/rls-validation.json',JSON.stringify(results,null,2));
console.log('Lab tenant validation complete. No tokens or customer data were saved.');
