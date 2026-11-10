// State labels for snapshots, not health or online guarantees.
// The local connector refreshes critical sessions every cycle while
// advanced configuration is sampled every 10 cycles (typically 5 min).
const rapidSources=new Set(['interface','hotspot','pppoe','dhcp','wifi']);
export const FAST_SOURCE_FRESH_MS=180000;
export const ADVANCED_SOURCE_FRESH_MS=12*60*1000;
export function inventorySourceIsCurrent(
 kind:string,observedAt:string|null,now=Date.now()
):boolean{
 if(!observedAt)return false;
 const time=Date.parse(observedAt);
 if(!Number.isFinite(time)||time>now+30000)return false;
 const limit=rapidSources.has(kind)?FAST_SOURCE_FRESH_MS:ADVANCED_SOURCE_FRESH_MS;
 return now-time>=0&&now-time<limit;
}

/** Router presence is not proof of reachability when a clock is skewed.
 * Future timestamps, malformed dates and stale heartbeats fail closed.
 */
export function routerHeartbeatIsFresh(
 observedAt:string|null,now=Date.now(),maxAgeMs=150000
):boolean{
 if(!observedAt||!Number.isFinite(now)||!Number.isFinite(maxAgeMs)||maxAgeMs<=0)return false;
 const at=Date.parse(observedAt),age=now-at;
 return Number.isFinite(at)&&age>=0&&age<maxAgeMs;
}
