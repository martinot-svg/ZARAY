// REVIEW-ONLY contract for a future RouterOS local watchdog.
// This file is deliberately NOT imported by the production connector.
// No configuration action is permitted until CHR tests prove that a local
// RouterOS scheduler really reverts changes after cloud connectivity is lost.
export const ADVANCED_ROUTEROS_WRITES_ENABLED=false;
const TABLES=Object.freeze({
 'dhcp-server':'ip/dhcp-server',
 'firewall-filter':'ip/firewall/filter',
 'firewall-nat':'ip/firewall/nat',
 'route':'ip/route'
});
export function proposeReversibleToggle({
 kind,routerId,resourceId,resourceComment,previousDisabled,nextDisabled,ttlSeconds=180
}){
 if(!Object.hasOwn(TABLES,kind))throw Error('Unsupported RouterOS configuration domain.');
 if(typeof routerId!=='string'||!/^[0-9a-f-]{36}$/i.test(routerId))
  throw Error('Missing router identifier.');
 if(typeof resourceId!=='string'||!/^\*[a-f0-9]{1,16}$/i.test(resourceId))
  throw Error('Invalid RouterOS resource id.');
 if(typeof resourceComment!=='string'||!/^zaray:managed:[0-9a-f-]{36}$/i.test(resourceComment))
  throw Error('The resource is not explicitly managed by ZARAY.');
 if(typeof previousDisabled!=='boolean'||typeof nextDisabled!=='boolean'||previousDisabled===nextDisabled)
  throw Error('A reversible disabled-state transition is required.');
 if(!Number.isInteger(ttlSeconds)||ttlSeconds<30||ttlSeconds>300)
  throw Error('Rollback watchdog TTL must be between 30 and 300 seconds.');
 const path=TABLES[kind]+'/'+resourceId;
 return Object.freeze({
  kind,routerId,resourceId,resourceComment,ttlSeconds,path,
  precondition:Object.freeze({disabled:previousDisabled,comment:resourceComment}),
  apply:Object.freeze({disabled:nextDisabled}),
  rollback:Object.freeze({disabled:previousDisabled}),
  requiredPhases:Object.freeze([
   'snapshot','arm_local_watchdog','apply_one_change','read_back',
   'verify_management_connectivity','confirm_then_cancel_watchdog'
  ]),
  approval:'HARDWARE_CHR_TEST_REQUIRED',
  executable:false
 });
}
// A deterministic local-watchdog MODEL for test scenarios, not RouterOS code.
export function simulateWatchdog(plan,steps){
 if(!plan||plan.executable!==false)throw Error('Only a review-only plan can be simulated.');
 let disabled=plan.precondition.disabled,armed=false,applied=false,restored=false;
 const events=[];
 for(const step of steps){
  if(step==='arm'){armed=true;events.push('watchdog_armed');}
  else if(step==='apply'){
   if(!armed)throw Error('Cannot apply without local rollback watchdog.');
   if(disabled!==plan.precondition.disabled)throw Error('State changed since snapshot.');
   disabled=plan.apply.disabled;applied=true;events.push('changed');
  }else if(step==='verify'){
   if(!applied||disabled!==plan.apply.disabled)throw Error('Change unverified.');
   events.push('verified');
  }else if(step==='confirm'){
   if(!events.includes('verified'))throw Error('Cannot confirm an unverified change.');
   armed=false;events.push('committed');
  }else if(step==='timeout'){
   if(armed){disabled=plan.rollback.disabled;armed=false;restored=true;events.push('rolled_back');}
  }else throw Error('Unsupported test step.');
 }
 return {disabled,armed,restored,events};
}
