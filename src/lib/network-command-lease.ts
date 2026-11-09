/** Deterministic lease decision for a command that an agent can safely poll again.
 * The caller still validates tenant, site, router, payment and capabilities.
 */
export type NetworkDispatchRecord={
 status:string;
 dispatched_at:string|null;
 expires_at:string;
};
export function dispatchableNetworkCommand(cmd:NetworkDispatchRecord, now:number){
 if(!Number.isFinite(now))return false;
 const expiry=Date.parse(cmd.expires_at||'');
 if(!Number.isFinite(expiry)||expiry<=now)return false;
 if(cmd.status==='queued')return true;
 if(cmd.status!=='dispatched'||!cmd.dispatched_at)return false;
 const lastSent=Date.parse(cmd.dispatched_at);
 return Number.isFinite(lastSent)&&lastSent<=now-90000&&lastSent<=now;
}
