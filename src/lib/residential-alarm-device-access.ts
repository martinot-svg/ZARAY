import 'server-only';
import {createHash} from 'node:crypto';
import {createClient} from '@/lib/supabase/server';
import {createServiceClient} from '@/lib/supabase/service';
import {publicResidentialSite} from '@/lib/residential-site-identity';

export const RESIDENT_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DEVICE_TOKEN=/^[A-Za-z0-9_-]{43}$/;
export const hashDeviceSecret=(secret:string)=>createHash('sha256').update(secret).digest('hex');
export type ResidentService=NonNullable<ReturnType<typeof createServiceClient>>;

/** Web-only enrollment. Never trust IDs/emails in an Android pairing request. */
export async function webResident(siteId:string){
 if(!RESIDENT_UUID.test(siteId))return null;
 const browser=await createClient();
 const {data:{user},error}=await browser.auth.getUser();
 if(error||!user?.email||!user.email_confirmed_at)return null;
 const site=await publicResidentialSite(siteId);
 if(!site)return null;
 const service=createServiceClient();
 if(!service)throw Error('Service indisponible');
 const {data:siteRow,error:siteError}=await service.from('sites')
  .select('company_id').eq('id',siteId).maybeSingle();
 if(siteError)throw Error('Site indisponible');
 if(!siteRow)return null;
 const {data:customer,error:customerError}=await service.from('customers')
  .select('id').eq('company_id',siteRow.company_id).eq('site_id',siteId)
  .eq('email',user.email.trim().toLowerCase()).eq('status','active').maybeSingle();
 if(customerError)throw Error('Compte indisponible');
 if(!customer)return null;
 return {service,site,companyId:siteRow.company_id,siteId,customerId:customer.id};
}

/** Device auth is independent of browser cookies, limited to one customer + site. */
export async function deviceResident(siteId:string,token:string){
 if(!RESIDENT_UUID.test(siteId)||!DEVICE_TOKEN.test(token))return {state:'invalid' as const};
 const service=createServiceClient();
 if(!service)throw Error('Service indisponible');
 const {data:device,error}=await service.from('residential_alarm_devices')
  .select('id,company_id,site_id,customer_id,token_expires_at,revoked_at')
  .eq('site_id',siteId).eq('token_hash',hashDeviceSecret(token)).maybeSingle();
 if(error)throw Error('Appareil indisponible');
 if(!device)return {state:'invalid' as const};
 if(device.revoked_at||!device.token_expires_at||Date.parse(device.token_expires_at)<=Date.now())
  return {state:'gone' as const};
 const site=await publicResidentialSite(siteId);
 if(!site)return {state:'gone' as const};
 const [{data:customer,error:customerError},{data:siteRow,error:siteError}]=await Promise.all([
  service.from('customers').select('id').eq('id',device.customer_id)
   .eq('company_id',device.company_id).eq('site_id',siteId).eq('status','active').maybeSingle(),
  service.from('sites').select('company_id').eq('id',siteId)
   .eq('company_id',device.company_id).maybeSingle()
 ]);
 if(customerError||siteError)throw Error('Vérification indisponible');
 if(!customer||!siteRow)return {state:'gone' as const};
 return {state:'ok' as const,service,site,siteId,companyId:device.company_id,
  customerId:device.customer_id,deviceId:device.id};
}

/** Sliding 90-day token lifetime after a successful authenticated synchronization. */
export async function touchDevice(service:ResidentService,deviceId:string){
 const now=new Date();
 const expires=new Date(now.getTime()+90*86400000).toISOString();
 const {error}=await service.from('residential_alarm_devices')
  .update({last_sync_at:now.toISOString(),token_expires_at:expires})
  .eq('id',deviceId).is('revoked_at',null);
 if(error)throw Error('Mise à jour appareil indisponible');
}
