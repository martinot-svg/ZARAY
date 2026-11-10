// Independent local polling cadence. The short-cycle group feeds the
// existing Hotspot/PPPoE and device dashboards. Read-only configuration
// inventories are less time-sensitive and are fetched every 10 cycles.
// This module runs only in the local Node connector, never on Vercel.
export const ADVANCED_SCAN_EVERY_CYCLES=10;
export const FAST_INVENTORY_KINDS=Object.freeze([
 'interface','hotspot','pppoe','dhcp','wifi'
]);
const fast=new Set(FAST_INVENTORY_KINDS);
export function chooseRouterOsSources(sources,cycle){
 if(!Array.isArray(sources)||!Number.isSafeInteger(cycle)||cycle<0)
  throw Error('Invalid RouterOS inventory collection schedule');
 const full=cycle%ADVANCED_SCAN_EVERY_CYCLES===0;
 return sources.filter(source=>full||fast.has(source.kind));
}
