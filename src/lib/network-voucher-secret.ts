import 'server-only';
import {createHmac} from 'node:crypto';
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function deriveVoucherPassword(voucherId:string,siteId:string,length:number){
 const secret=process.env.ZARAY_WIFI_VOUCHER_HMAC_KEY;
 if(!secret||!/^[0-9a-f]{64}$/i.test(secret))throw new Error('Wi-Fi secret key unavailable.');
 // Existing 12–32-character vouchers remain reproducible after changing new templates to 3–5.
 if(!Number.isInteger(length)||length<3||length>32)throw new Error('Invalid Wi-Fi password length.');
 const bytes=createHmac('sha256',Buffer.from(secret,'hex')).update('zaray-wifi-v1:'+siteId+':'+voucherId).digest();
 return Array.from(bytes.subarray(0,length),b=>ALPHABET[b%ALPHABET.length]).join('');
}
