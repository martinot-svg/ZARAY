/** Labels are always derived from the verified site identity, never from a caller's text. */
export type ResidentSiteNames={brandName:string;siteName:string};
const clean=(value:string)=>value.trim().replace(/\s+/g,' ').slice(0,90);
export function subscriberAccountName(site:ResidentSiteNames){
 const provider=clean(site.brandName)||'Votre fournisseur';
 const location=clean(site.siteName);
 return 'Mon compte · '+provider+
  (location&&location.toLocaleLowerCase('fr')!==provider.toLocaleLowerCase('fr')
   ?' — '+location:'');
}
export function subscriberReminderName(site:ResidentSiteNames){
 return 'Rappel Internet · '+subscriberAccountName(site).replace(/^Mon compte · /,'');
}
