import {readOnlyInventoryProjection} from './inventory-projections.mjs';
// Explicitly reviewed property fields for the WinBox-like read-only inspector.
// These are a SUBSET of the RouterOS REST projections. Never pass arbitrary
// RouterOS objects, passwords, comments, raw configuration or private keys.
const detailPaths=Object.freeze({
 'interface':['name','type','running','disabled'],
 'interface/vlan':['name','interface','vlan-id','running','disabled'],
 'interface/bridge':['name','protocol-mode','running','disabled'],
 'interface/bridge/port':['interface','bridge','hw','disabled'],
 'ip/address':['address','interface','disabled'],
 'ipv6/address':['address','interface','disabled'],
 'ip/dhcp-server':['name','interface','disabled'],
 'ip/dhcp-client':['interface','address','status','disabled'],
 'ip/dhcp-server/lease':['host-name','address','mac-address','status'],
 'ip/dhcp-server/network':['address','gateway','dns-server'],
 'ip/arp':['address','mac-address','interface','disabled'],
 'ip/dns/static':['name','address','type','disabled'],
 'ip/route':['dst-address','gateway','active','disabled'],
 'routing/rule':['src-address','dst-address','action','table','disabled'],
 'queue/simple':['name','target','max-limit','disabled'],
 'queue/tree':['name','parent','max-limit','disabled'],
 'ip/firewall/filter':['chain','action','disabled'],
 'ip/firewall/nat':['chain','action','disabled'],
 'ip/firewall/address-list':['list','address','disabled'],
 'ip/hotspot/active':['user','address','mac-address'],
 'ppp/active':['name','address','caller-id'],
 'ip/hotspot/user':['name','disabled'],
 'ppp/secret':['name','service','disabled'],
 'interface/wifi/registration-table':['interface','last-ip','mac-address'],
 'interface/wireless/registration-table':['interface','last-ip','mac-address'],
 'interface/wireguard':['name','mtu','listen-port','running','disabled'],
 'interface/wireguard/peers':['name','interface','allowed-address','disabled']
});
export const SAFE_ROUTEROS_DETAILS=detailPaths;
export function sanitizedRouterOsDetails(path,record){
 const fields=detailPaths[path]||[];
 if(!fields.length||!record||typeof record!=='object'||Array.isArray(record))return {};
 const projected=readOnlyInventoryProjection(path);
 if(!fields.every(f=>projected.includes(f)))throw Error('Unsafe unprojected RouterOS property');
 const result={};
 for(const field of fields){
  const value=record[field];
  if(typeof value==='string'&&value.length<=128)result[field]=value;
  else if(typeof value==='boolean')result[field]=String(value);
  else if(typeof value==='number'&&Number.isFinite(value))result[field]=String(value);
 }
 return result;
}
