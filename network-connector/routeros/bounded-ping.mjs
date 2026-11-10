/**
 * Fixed RouterOS REST ping operation used by ZARAY's local Node connector.
 * No terminal commands, configurable packet count or arbitrary RouterOS path.
 * RouterOS 7.x normally returns up to one object per requested packet.
 */
export async function boundedRouterOsPing(ros,address){
 const parts=typeof address==='string'?address.split('.'):[];
 if(parts.length!==4||!parts.every(part=>/^(?:0|[1-9][0-9]{0,2})$/.test(part)&&Number(part)<=255))
  throw Error('Cible IPv4 de diagnostic invalide.');
 const results=await ros('ping','POST',{address:parts.join('.'),count:'3'});
 if(!Array.isArray(results)||results.length===0)
  throw Error('Aucun résultat de ping retourné par RouterOS.');
 const samples=[];
 for(const result of results.slice(0,3)){
  if(!result||typeof result!=='object'||Array.isArray(result))
   throw Error('Paquet ping RouterOS mal formé.');
  const sample={};
  for(const name of ['seq','time','ttl','status']){
   const value=result[name];
   if(value===undefined||value===null)continue;
   if(typeof value!=='string'||value.length>64||/[\x00-\x1f\x7f]/.test(value))
    throw Error('Valeur de ping RouterOS invalide.');
   sample[name]=value;
  }
  if(!('seq' in sample))throw Error('Numéro de paquet manquant dans le résultat ping.');
  // An absent time is a timeout or an error, not a received packet.
  if(!sample.status)sample.status=sample.time?'received':'timeout';
  samples.push(sample);
 }
 return samples;
}
