import {subscriberReminderName,type ResidentSiteNames} from '@/lib/residential-site-labels';

// This site is based in Madagascar. Keep one stable site-timezone clock for every phone.
export const RESIDENT_ALARM_TIME_ZONE='Indian/Antananarivo';
export const DEFAULT_ALARM_DAYS=[7,3,1,0] as const;
const validDays=new Set<number>(DEFAULT_ALARM_DAYS);
export type AlarmItem={
 id:string;daysBefore:number;scheduledAt:string;title:string;message:string;
};
export type AlarmSubscription={id:string;offer_name:string;expires_at:string};

export function validateAlarmDays(raw:unknown):number[]|null{
 if(!Array.isArray(raw)||raw.length<1||raw.length>4
  ||raw.some(n=>typeof n!=='number'||!Number.isInteger(n)||!validDays.has(n))
  ||new Set(raw).size!==raw.length)return null;
 return [...raw].sort((a,b)=>b-a);
}
export function buildResidentAlarms(
 site:ResidentSiteNames,
 subscription:AlarmSubscription|null,
 days:number[],
 hour:number,
 now=new Date()
):AlarmItem[]{
 if(!subscription?.expires_at||!Number.isInteger(hour)||hour<0||hour>23
  ||!validateAlarmDays(days))return [];
 const expiry=new Date(subscription.expires_at);
 if(Number.isNaN(expiry.getTime()))return [];
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:RESIDENT_ALARM_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(expiry);
 const part=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
 const y=part('year'),m=part('month'),d=part('day');
 if(!y||!m||!d)return [];
 // Madagascar is UTC+03 year-round: 08:00 on the local calendar day is 05:00 UTC.
 const alarmDay=Date.UTC(y,m-1,d,hour-3,0,0);
 const title=subscriberReminderName(site);
 return days.filter(daysBefore=>validDays.has(daysBefore)).map(daysBefore=>{
  const when=new Date(alarmDay-daysBefore*86400000);
  const message=daysBefore===0?'Votre abonnement Internet expire aujourd’hui.'
   :daysBefore===1?'Votre abonnement Internet expire demain.'
   :'Votre abonnement Internet expire dans '+daysBefore+' jours.';
  return {
   id:'residential:'+subscription.id+':'+subscription.expires_at+':'+daysBefore,
   daysBefore,scheduledAt:when.toISOString(),
   title,message:message+' Site : '+site.siteName+'.'
  };
 }).filter(reminder=>Date.parse(reminder.scheduledAt)>now.getTime())
 .sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt));
}

const icsEscape=(value:string)=>value.replace(/\\/g,'\\\\')
 .replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const stamp=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
/** Calendar fallback, requiring a manual import on the phone. Does NOT schedule native alarms itself. */
export function buildAlarmCalendar(items:AlarmItem[],siteId:string,now=new Date()):string{
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Site Internet//Rappels abonnement//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const item of items){
  const dt=new Date(item.scheduledAt);
  const uid=item.id.replace(/[^a-zA-Z0-9:._-]/g,'-')+'-'+siteId+'@resident.reminders';
  lines.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp(now),'DTSTART:'+stamp(dt),
   'DTEND:'+stamp(new Date(dt.getTime()+300000)),
   'SUMMARY:'+icsEscape(item.title),'DESCRIPTION:'+icsEscape(item.message),
   'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-PT0M',
   'DESCRIPTION:'+icsEscape(item.message),'END:VALARM','END:VEVENT');
 }
 lines.push('END:VCALENDAR','');
 return lines.join('\r\n');
}
