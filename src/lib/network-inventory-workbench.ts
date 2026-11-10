/** A WinBox-style list/search/properties workflow, independently implemented.
 * Read-only client filtering of an already tenant-scoped, server-paginated result.
 * No RouterOS commands, credentials, or unbounded network queries in this module.
 */
export type InventorySort='label'|'ip'|'observed'|'state';
export type RouterInventoryRow={
 id:string;router_id:string;observed_kind:string;identity_key:string;
 ip_address:string|null;mac_address:string|null;client_label:string|null;
 active:boolean;observed_at:string;
};
const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
const timestamp=(value:string|null)=>value?Date.parse(value):NaN;
export function inventoryObservationIsFresh(
 observationTime:string|null,routerLastSeen:string|null,now=Date.now()
):boolean{
 return [observationTime,routerLastSeen].every(stamp=>{
  const time=timestamp(stamp);
  return Number.isFinite(time)&&time<=now&&now-time<150000;
 });
}
export function filterAndSortRouterInventory<T extends RouterInventoryRow>(
 rows:readonly T[],search:string,sort:InventorySort,descending:boolean,
 routerLastSeen:string|null,now=Date.now()
):T[]{
 const term=normalized(search);
 const visible=rows.filter(row=>!term||normalized([
  row.client_label||'',row.identity_key,row.ip_address||'',
  row.mac_address||'',row.observed_kind
 ].join(' ')).includes(term));
 const field=(row:T):string|number=>{
  switch(sort){
   case 'ip':return normalized(row.ip_address||'');
   case 'observed':return timestamp(row.observed_at)||0;
   case 'state':return inventoryObservationIsFresh(row.observed_at,routerLastSeen,now)
    ?(row.active?2:1):0;
   case 'label':default:return normalized(row.client_label||row.identity_key);
  }
 };
 const direction=descending?-1:1;
 return [...visible].sort((a,b)=>{
  const av=field(a),bv=field(b);
  const difference=typeof av==='number'&&typeof bv==='number'
   ?Math.sign(av-bv):String(av).localeCompare(String(bv),'fr',{numeric:true});
  return direction*difference || a.identity_key.localeCompare(b.identity_key,'fr')||
   a.id.localeCompare(b.id,'fr');
 });
}
