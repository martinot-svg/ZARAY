import 'server-only';
import {createHmac} from 'node:crypto';

const LEGACY_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export type VoucherCredentialScheme='hmac-v1'|'hmac-numeric-v2';

/**
 * Deterministic server-only password derivation: no recoverable credential
 * is stored in Supabase. The scheme is pinned on each issued voucher,
 * so previously printed alphanumeric credentials remain unchanged.
 */
export function deriveVoucherPassword(voucherId:string,siteId:string,length:number,scheme:VoucherCredentialScheme='hmac-v1'){
 const secret=process.env.ZARAY_WIFI_VOUCHER_HMAC_KEY;
 if(!secret||!/^[0-9a-f]{64}$/i.test(secret))throw new Error('Wi-Fi secret key unavailable.');
 if(!Number.isInteger(length)||length<3||(scheme==='hmac-numeric-v2'?length>5:length>32))
  throw new Error('Invalid Wi-Fi password length.');
 const domain=scheme==='hmac-numeric-v2'?'zaray-wifi-numeric-v2:':'zaray-wifi-v1:';
 const bytes=createHmac('sha256',Buffer.from(secret,'hex')).update(domain+siteId+':'+voucherId).digest();
 if(scheme==='hmac-numeric-v2'){
  // Keep leading zeroes and represent the PIN as a string, never a number.
  const pin=BigInt('0x'+bytes.toString('hex'))%(BigInt(10)**BigInt(length));
  return pin.toString().padStart(length,'0');
 }
 if(scheme!=='hmac-v1')throw new Error('Unknown Wi-Fi credential scheme.');
 return Array.from(bytes.subarray(0,length),b=>LEGACY_ALPHABET[b%LEGACY_ALPHABET.length]).join('');
}
