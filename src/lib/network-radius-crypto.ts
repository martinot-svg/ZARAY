import {createHash,randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';

const OPTIONS={N:16384,r:8,p:1,maxmem:32*1024*1024};

export const radiusTokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const newRadiusToken=()=>randomBytes(32).toString('hex');

async function derive(password:string,salt:string):Promise<Buffer>{
 return await new Promise<Buffer>((resolve,reject)=>{
  scryptCallback(password,Buffer.from(salt,'hex'),64,OPTIONS,(error,derived)=>{
   if(error)reject(error);else resolve(derived);
  });
 });
}
export async function hashRadiusPassword(password:string){
 if(typeof password!=='string'||password.length<12||password.length>128)
  throw new Error('Mot de passe RADIUS : 12 à 128 caractères.');
 const salt=randomBytes(16).toString('hex');
 const hash=(await derive(password,salt)).toString('hex');
 return {password_salt:salt,password_hash:hash};
}
export async function verifyRadiusPassword(password:string,salt:string,hash:string){
 if(!password||password.length>128||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hash))return false;
 const candidate=await derive(password,salt);
 return timingSafeEqual(candidate,Buffer.from(hash,'hex'));
}
