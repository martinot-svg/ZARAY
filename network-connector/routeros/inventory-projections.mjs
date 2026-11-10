// RouterOS REST GET projections. Deliberately excludes credentials, scripts,
// private keys, raw firewall rules and user-configured secrets.
// A new source must be explicitly reviewed here before collection.
const fieldLists={
 'interface':['.id','name','type','mac-address','running','disabled'],
 'radius':['.id','service','address','disabled'],
 'ip/hotspot/active':['.id','user','address','mac-address'],
 'ppp/active':['.id','name','address','caller-id'],
 'ip/dhcp-server/lease':['.id','host-name','address','mac-address','status'],
 'interface/wifi/registration-table':['.id','mac-address','interface','last-ip'],
 'interface/wireless/registration-table':['.id','mac-address','interface','last-ip'],
 'ip/neighbor':['.id','mac-address','address','identity','interface-name'],
 'ip/hotspot/user':['.id','name','disabled'],
 'ip/hotspot/user/profile':['.id','name','rate-limit'],
 'ppp/secret':['.id','name','service','disabled'],
 'ppp/profile':['.id','name','rate-limit'],
 'ip/address':['.id','address','interface','disabled'],
 'ip/pool':['.id','name','ranges'],
 'ip/dhcp-server':['.id','name','interface','disabled'],
 'ip/dhcp-client':['.id','interface','address','status','disabled'],
 'interface/vlan':['.id','name','interface','vlan-id','running','disabled'],
 'ip/arp':['.id','address','mac-address','interface','disabled'],
 'queue/simple':['.id','name','target','max-limit','disabled'],
 'ip/firewall/filter':['.id','chain','action','disabled'],
 'ip/firewall/nat':['.id','chain','action','disabled'],
 'ip/route':['.id','dst-address','gateway','active','disabled']
};
export const INVENTORY_PROJECTIONS=Object.freeze(Object.fromEntries(
 Object.entries(fieldLists).map(([path,fields])=>[path,Object.freeze(fields)])
));
export function readOnlyInventoryProjection(path){
 if(typeof path!=='string'||!Object.hasOwn(INVENTORY_PROJECTIONS,path))
  throw Error('Unsupported RouterOS inventory path');
 return INVENTORY_PROJECTIONS[path];
}
