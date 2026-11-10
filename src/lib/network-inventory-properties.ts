/** Server-side defense-in-depth for WinBox-like property inspection.
 * A paired local agent cannot add arbitrary RouterOS fields to the database.
 * Only explicitly reviewed non-secret fields are permitted for each kind.
 */
const byKind:Record<string,readonly string[]>={
 interface:['name','type','running','disabled'],
 vlan:['name','interface','vlan-id','running','disabled'],
 bridge:['name','protocol-mode','running','disabled'],
 'bridge-port':['interface','bridge','hw','disabled'],
 'ip-address':['address','interface','disabled'],
 'ipv6-address':['address','interface','disabled'],
 'dhcp-server':['name','interface','disabled'],
 'dhcp-client':['interface','address','status','disabled'],
 dhcp:['host-name','address','mac-address','status'],
 'dhcp-network':['address','gateway','dns-server'],
 arp:['address','mac-address','interface','disabled'],
 'dns-static':['name','address','type','disabled'],
 route:['dst-address','gateway','active','disabled'],
 'routing-rule':['src-address','dst-address','action','table','disabled'],
 queue:['name','target','max-limit','disabled'],
 'queue-tree':['name','parent','max-limit','disabled'],
 'firewall-filter':['chain','action','disabled'],
 'firewall-nat':['chain','action','disabled'],
 'firewall-address-list':['list','address','disabled'],
 hotspot:['user','address','mac-address'],
 pppoe:['name','address','caller-id'],
 'hotspot-user':['name','disabled'],
 'ppp-secret':['name','service','disabled'],
 wifi:['interface','last-ip','mac-address'],
 'wireguard-interface':['name','mtu','listen-port','running','disabled'],
 'wireguard-peer':['name','interface','allowed-address','disabled']
};
export const INVENTORY_SAFE_PROPERTY_KEYS=byKind;
export function sanitizeInventoryProperties(kind:string,raw:unknown):Record<string,string>|null{
 if(raw===undefined)return {};
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))return null;
 const entries=Object.entries(raw);
 if(entries.length>12)return null;
 const allowed=new Set(byKind[kind]||[]);
 const safe:Record<string,string>={};
 for(const [key,value] of entries){
  if(!allowed.has(key)||typeof value!=='string'||value.length>128||
     /[\u0000-\u001f\u007f]/.test(value))return null;
  safe[key]=value;
 }
 return safe;
}
