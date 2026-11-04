import 'server-only';
import {createHmac,createHash} from 'node:crypto';

const LEGACY_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export type VoucherCredentialScheme='hmac-v1'|'hmac-numeric-v2';
export type VoucherKeyVersion=1|2;


/**
 * Deterministic server-only password derivation: no recoverable credential
 * is stored in Supabase. The scheme is pinned on each issued voucher,
 * so previously printed alphanumeric credentials remain unchanged.
 */
export function deriveVoucherPassword(voucherId:string,siteId:string,length:number,scheme:VoucherCredentialScheme='hmac-v1',keyVersion:VoucherKeyVersion=1){
 const secret=keyVersion===2?process.env.ZARAY_WIFI_VOUCHER_HMAC_KEY_V2:keyVersion===1?process.env.ZARAY_WIFI_VOUCHER_HMAC_KEY:undefined;
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

/**
 * v1: historical unsalted SHA256 verifier (unchanged).
 * v2: secret-keyed verifier so a leaked DB hash does not allow a 3-5 digit
 * PIN to be trivially recovered offline. Both uses are domain-separated.
 */
export function hashVoucherCredential(siteId:string,username:string,password:string,keyVersion:VoucherKeyVersion=1){
 const input=siteId+':'+username+':'+password;
 if(keyVersion===1)return createHash('sha256').update(input).digest('hex');
 if(keyVersion!==2)throw new Error('Unsupported credential key version.');
 const secret=process.env.ZARAY_WIFI_VOUCHER_HMAC_KEY_V2;
 if(!secret||!/^[0-9a-f]{64}$/i.test(secret))throw new Error('Wi-Fi v2 secret key unavailable.');
 return createHmac('sha256',Buffer.from(secret,'hex')).update('zaray-voucher-verifier-v2:'+input).digest('hex');
}
