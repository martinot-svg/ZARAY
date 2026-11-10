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

/** One unexpired ping job per router. A lost acknowledgement is re-dispatched
 * only after its 90-second lease, never while a connector might still run it.
 * Jobs older than 10 minutes cannot be revived by a reconnect.
 */
export type DiagnosticDispatchRecord={
 status:string;
 dispatched_at:string|null;
 requested_at:string;
};
export function dispatchableDiagnosticJob(job:DiagnosticDispatchRecord,now:number){
 if(!Number.isFinite(now))return false;
 const requested=Date.parse(job.requested_at||'');
 if(!Number.isFinite(requested)||requested>now||now-requested>=600000)return false;
 if(job.status==='queued')return true;
 if(job.status!=='dispatched'||!job.dispatched_at)return false;
 const dispatched=Date.parse(job.dispatched_at);
 return Number.isFinite(dispatched)&&dispatched>=requested&&dispatched<=now-90000;
}
