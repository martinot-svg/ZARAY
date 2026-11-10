/**
 * Public input contract for privileged, server-queued RouterOS changes.
 * This is NOT a general-purpose terminal or pass-through RouterOS API.
 * Every string is validated and the connector repeats the validation.
 */
export type ManagedCategory='dns-static'|'vlan';
export type ManagedOperation='create'|'update'|'enable'|'disable'|'delete';
export type ManagedValues=Record<string,string>;
export type ManagedConfigInput={
 category:ManagedCategory;operation:ManagedOperation;
 values:ManagedValues;observationId?:string|null;reason:string;
};
const categoryFields:Record<ManagedCategory,readonly string[]>={
 'dns-static':['name','address'],
 vlan:['name','interface','vlan-id']
};
const namePattern=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/;
const ipPattern=/^(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const name=(v:unknown)=>typeof v==='string'&&namePattern.test(v);
const ipv4=(v:unknown)=>typeof v==='string'&&ipPattern.test(v)&&
 v.split('.').every(part=>Number(part)<=255);
export function parseManagedConfigRequest(body:unknown):ManagedConfigInput|null{
 if(!body||typeof body!=='object'||Array.isArray(body))return null;
 const b=body as Record<string,unknown>;
 const category=b.category,operation=b.operation;
 if(category!=='dns-static'&&category!=='vlan')return null;
 if(operation!=='create'&&operation!=='update'&&operation!=='enable'&&
   operation!=='disable'&&operation!=='delete')return null;
 if(operation==='delete'&&category==='vlan')return null;
 if(typeof b.reason!=='string'||b.reason.trim().length<5||
    b.reason.trim().length>220||/[\u0000-\u001f\u007f]/.test(b.reason))return null;
 if(!b.values||typeof b.values!=='object'||Array.isArray(b.values))return null;
 const record=b.values as Record<string,unknown>,keys=Object.keys(record);
 const expected=categoryFields[category];
 const editing=operation==='create'||operation==='update';
 if(editing){
  if(keys.length!==expected.length||keys.some(key=>!expected.includes(key)))return null;
  if(!name(record.name))return null;
  if(category==='dns-static'&&!ipv4(record.address))return null;
  if(category==='vlan'&&(!name(record.interface)||
    typeof record['vlan-id']!=='string'||
    !/^[1-9][0-9]{0,3}$/.test(record['vlan-id'])||
    Number(record['vlan-id'])>4094))return null;
 }else if(keys.length)return null;
 const observationId=b.observationId;
 if(operation==='create'){
  if(observationId!==undefined&&observationId!==null&&observationId!=='')return null;
 }else if(typeof observationId!=='string'||!uuidPattern.test(observationId))return null;
 // Reconstruct a new, strictly typed object; never persist user-supplied keys
 // such as command, path, password, script, token or private-key.
 const values:ManagedValues={};
 if(editing)for(const key of expected)values[key]=record[key] as string;
 return {category,operation,values,observationId:operation==='create'?null:observationId as string,
  reason:b.reason.trim()};
}
export const MANAGED_CONFIG_SOURCE:Readonly<Record<ManagedCategory,string>>={
 'dns-static':'dns-static',vlan:'vlan'
};
