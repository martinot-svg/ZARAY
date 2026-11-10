/**
 * ZARAY remote configuration for explicitly owned RouterOS resources.
 * The browser never supplies a RouterOS command or path.
 * Only config objects created by this engine can subsequently be modified.
 */
export const MANAGED_CONFIG_SCHEMAS=Object.freeze({
 'dns-static':Object.freeze({
  path:'ip/dns/static',kind:'dns-static',
  fields:Object.freeze(['name','address']),removable:true
 }),
 'vlan':Object.freeze({
  path:'interface/vlan',kind:'vlan',
  fields:Object.freeze(['name','interface','vlan-id']),removable:false
 })
});
const IDENT=/^\*?[0-9a-fA-F]{1,16}$/;
const NAME=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/;
const VALID_IPV4=/^(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})$/;
const idPart=s=>String(s||'').trim();
const commentFor=id=>'zaray:managed:'+id;
const normalizeDisabled=v=>v===true||v==='true'?'true':'false';
function ipv4(value){
 if(typeof value!=='string'||!VALID_IPV4.test(value))return false;
 return value.split('.').every(part=>Number(part)<=255);
}
export function validateManagedChange(kind,operation,values,targetId){
 const schema=MANAGED_CONFIG_SCHEMAS[kind];
 if(!schema||!['create','update','enable','disable','delete'].includes(operation))
  throw Error('Unsupported managed RouterOS configuration action.');
 if(operation==='delete'&&!schema.removable)
  throw Error('This configuration category cannot be deleted remotely.');
 if(operation==='create'&&targetId)
  throw Error('Create operation cannot target an existing object.');
 if(operation!=='create'&&(!IDENT.test(targetId||'')||!String(targetId).startsWith('*')))
  throw Error('A valid existing RouterOS item id is required.');
 if(values===null||typeof values!=='object'||Array.isArray(values))
  throw Error('Invalid configuration properties.');
 const entries=Object.entries(values);
 if(operation==='create'||operation==='update'){
  if(entries.length!==schema.fields.length||
     !entries.every(([key,val])=>schema.fields.includes(key)&&typeof val==='string'))
   throw Error('Configuration must contain exactly the allowed properties.');
  if(!NAME.test(values.name))throw Error('Invalid RouterOS name.');
  if(kind==='dns-static'&&!ipv4(values.address))
   throw Error('A valid IPv4 DNS mapping is required.');
  if(kind==='vlan'&&(!NAME.test(values.interface)||!/^([1-9][0-9]{0,3})$/.test(values['vlan-id'])||
    Number(values['vlan-id'])>4094))
   throw Error('Invalid VLAN parent or VLAN ID.');
 }else if(entries.length)
  throw Error('Enable, disable and delete do not accept editable fields.');
 return schema;
}
const fields=Object.freeze(['.id','name','address','interface','vlan-id','disabled','comment']);
const projected=schema=>['.id',...schema.fields,'disabled','comment'];
function project(record,schema){
 const out={};
 for(const field of projected(schema)){
  const value=record[field];
  if(typeof value==='string'&&value.length<=128)out[field]=value;
 }
 return out;
}
function matchProperties(row,want){
 return Object.entries(want).every(([key,value])=>row&&String(row[key])===String(value));
}
function safeList(rows){
 if(!Array.isArray(rows)||rows.length>10000)throw Error('RouterOS item listing not bounded.');
 return rows.filter(row=>row&&typeof row==='object'&&!Array.isArray(row));
}
/**
 * Performs exactly one whitelisted operation, verifies RouterOS readback,
 * and attempts to restore prior values on a failed PATCH.
 *
 * Return state is one of success, failed, manual_review. The caller MUST use
 * the returned state (not HTTP 2xx alone) as the persisted audit status.
 */
export async function executeManagedConfig(ros,job){
 const {kind,operation,values,targetId,id}=job;
 const schema=validateManagedChange(kind,operation,values,targetId);
 if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid operation id.');
 const tag=commentFor(id);
 const list=async()=>safeList(await ros(schema.path,'GET',undefined,projected(schema)));
 const original=await list();
 const beforeRow=operation==='create'?null:original.find(row=>row['.id']===targetId);
 if(operation==='create'){
  const existing=original.find(row=>row.comment===tag);
  if(existing){
   if(!matchProperties(existing,values))return {state:'manual_review',message:'Identical operation tag has conflicting values.',before:null,after:project(existing,schema)};
   return {state:'success',message:'Previously created item verified.',before:null,after:project(existing,schema)};
  }
  if(original.some(row=>row.name===values.name))
   return {state:'failed',message:'An item already uses this RouterOS name.',before:null,after:null};
  if(kind==='vlan'){
   const parents=safeList(await ros('interface','GET',undefined,['.id','name','type']));
   if(!parents.some(row=>row.name===values.interface))
    return {state:'failed',message:'The VLAN parent interface is absent.',before:null,after:null};
  }
  try{
   await ros(schema.path,'PUT',{...values,comment:tag,disabled:'false'});
   const final=await list();
   const created=final.find(row=>row.comment===tag);
   if(created&&matchProperties(created,values)&&normalizeDisabled(created.disabled)==='false')
    return {state:'success',message:'Created and verified against RouterOS.',before:null,after:project(created,schema)};
   return {state:'manual_review',message:'Create returned but RouterOS readback differs.',before:null,after:created?project(created,schema):null};
  }catch{
   const after=await list().catch(()=>[]);
   const created=after.find(row=>row.comment===tag);
   return {state:'manual_review',message:'Create outcome unknown; inspect RouterOS before retry.',before:null,after:created?project(created,schema):null};
  }
 }
 if(!beforeRow)
  return {state:'manual_review',message:'Target is not present. No operation executed.',before:null,after:null};
 const before=project(beforeRow,schema);
 if(typeof beforeRow.comment!=='string'||!/^zaray:managed:[0-9a-f-]{36}$/i.test(beforeRow.comment))
  return {state:'failed',message:'Only resources previously created in ZARAY may be modified.',before:null,after:null};
 const expected=operation==='update'?values:operation==='enable'?{disabled:'false'}:
  operation==='disable'?{disabled:'true'}:{};
 if(operation==='delete'&&normalizeDisabled(beforeRow.disabled)!=='true')
  return {state:'failed',message:'Disable the DNS record before deleting it.',before,after:null};
 const patchPath=schema.path+'/'+targetId;
 if(operation!=='delete'&&matchProperties(beforeRow,expected))
  return {state:'success',message:'Desired RouterOS state is already applied.',before,after:before};
 let mutationAttempted=false;
 try{
  mutationAttempted=true;
  if(operation==='delete')await ros(patchPath,'DELETE');
  else await ros(patchPath,'PATCH',expected);
  const final=await list();
  const after=final.find(row=>row['.id']===targetId);
  if(operation==='delete'&&!after)
   return {state:'success',message:'DNS record removed and verified.',before,after:null};
  if(operation!=='delete'&&after&&after.comment===beforeRow.comment&&matchProperties(after,expected))
   return {state:'success',message:'Configuration changed and verified.',before,after:project(after,schema)};
 }catch{}
 if(mutationAttempted&&operation==='delete')
  return {state:'manual_review',message:'Deletion outcome uncertain; do not retry automatically.',before,after:null};
 try{
  const restore={};
  for(const field of schema.fields)if(typeof beforeRow[field]==='string')restore[field]=beforeRow[field];
  restore.disabled=normalizeDisabled(beforeRow.disabled);
  await ros(patchPath,'PATCH',restore);
  const rows=await list();
  const row=rows.find(r=>r['.id']===targetId);
  if(row&&row.comment===beforeRow.comment&&matchProperties(row,restore))
   return {state:'failed',message:'Configuration verification failed; prior properties restored.',before,after:project(row,schema)};
 }catch{}
 return {state:'manual_review',message:'Configuration could not be verified or restored. Inspect the router before another change.',before,after:null};
}
