/** Least-privilege RouterOS read projections for existing ZARAY commands.
 * These fields are consumed only in the local connector's memory during
 * authorized operations and are never synced to the browser or cloud DB.
 * Passwords, private keys and unrelated raw router configuration stay unread.
 */
const fields=Object.freeze({
 'ip/hotspot/user':Object.freeze(['.id','name','comment','uptime','disabled','profile']),
 'ppp/secret':Object.freeze(['.id','name','disabled']),
 'ip/hotspot/active':Object.freeze(['.id','user','mac-address']),
 'ppp/active':Object.freeze(['.id','name']),
 'ip/hotspot/ip-binding':Object.freeze(['.id','mac-address','type','comment']),
 'ip/hotspot/user/profile':Object.freeze(['.id','name','shared-users','comment']),
 'ip/dns/static':Object.freeze(['.id','name','address','disabled','comment']),
 'interface/vlan':Object.freeze(['.id','name','interface','vlan-id','disabled','comment'])
});
export const ROUTEROS_OPERATION_READ_PROJECTIONS=fields;
export function operationReadProjection(path){
 if(typeof path!=='string'||!Object.hasOwn(fields,path))
  throw Error('Unsupported RouterOS operation read path');
 return fields[path];
}
