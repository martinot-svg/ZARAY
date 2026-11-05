import 'server-only';

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]||c));
const config=()=>{
 const key=process.env.ZARAY_RESEND_API_KEY||process.env.RESEND_API_KEY||'';
 const sender=process.env.ZARAY_CUSTOMER_EMAIL_FROM||'';
 if(process.env.ZARAY_CUSTOMER_FROM_VERIFIED!=='true'||!key||!/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(sender))return null;
 if(/zaray/i.test(sender))return null; // Never reveal the SaaS brand to a resident.
 return {key,sender};
};
export function customerEmailDeliveryReady(){return Boolean(config());}

/** Only a verified provider hostname is used in the customer-facing message. */
export async function sendResidentEmail({
 notificationId,to,siteName,title,details,hostname
}:{
 notificationId:string;to:string;siteName:string;title:string;details:string;hostname:string;
}){
 const settings=config();
 if(!settings)throw Error('Email provider not configured');
 if(!/^[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,}$/i.test(hostname)
    ||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))
  throw Error('Invalid recipient or hostname');
 const fromName=(siteName.replace(/[\r\n"<>]/g,'').trim()||'Votre fournisseur').slice(0,75);
 const link='https://'+hostname+'/';
 const subject=(fromName+' — '+title).slice(0,170);
 const body=[
  'Bonjour,','',title,details,'',
  'Consultez votre espace abonné :',link,'',
  'Vous recevez ce message car vous avez autorisé les alertes par e-mail dans votre espace client.',
  'Vous pouvez désactiver les e-mails dans vos préférences de notification.','',
  fromName
 ].join('\n');
 const result=await fetch('https://api.resend.com/emails',{
  method:'POST',cache:'no-store',signal:AbortSignal.timeout(10000),
  headers:{
   'Authorization':'Bearer '+settings.key,
   'Content-Type':'application/json',
   'Idempotency-Key':'resident-'+notificationId
  },
  body:JSON.stringify({
   from:fromName+' <'+settings.sender+'>',
   to:[to],subject,text:body,
   html:'<p>Bonjour,</p><h2>'+escapeHtml(title)+'</h2><p>'+escapeHtml(details)+
    '</p><p><a href="'+escapeHtml(link)+'">Consulter mon espace abonné</a></p>'+
    '<p>Vous avez autorisé les alertes par e-mail. Gérez vos préférences dans votre compte.</p>'
  })
 });
 if(!result.ok)throw Error('Le fournisseur e-mail a refusé la demande.');
 const payload=await result.json().catch(()=>null) as {id?:string}|null;
 if(!payload?.id)throw Error('Réponse de livraison non confirmée.');
 return payload.id;
}
