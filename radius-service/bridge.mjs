#!/usr/bin/env node
// ZARAY FreeRADIUS HTTP bridge, Node.js 22+; loopback-only, outbound TLS to ZARAY.
// This process does not implement the RADIUS wire protocol. FreeRADIUS remains the RADIUS server.
import {createServer} from 'node:http';
const env=process.env;
const root=env.ZARAY_URL||'https://zaray.vercel.app';
const routerId=env.ZARAY_ROUTER_ID||'';
const token=env.ZARAY_RADIUS_GATEWAY_TOKEN||'';
const port=Number(env.ZARAY_RADIUS_BRIDGE_PORT||18120);
if(!/^https:\/\//.test(root)||!/^https:\/\/[^/?#]+\/?$/.test(root))
 throw new Error('ZARAY_URL doit être une origine HTTPS sans chemin ou paramètres.');
if(!/^[a-f0-9-]{36}$/i.test(routerId)||!/^[a-f0-9]{64}$/i.test(token))
 throw new Error('Identifiant routeur ou clé RADIUS de passerelle absent.');
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Port local invalide.');
const origin=new URL(root).origin;
function answer(res,status){res.writeHead(status,{'Cache-Control':'no-store','Content-Length':'0'});res.end();}
const server=createServer(async(req,res)=>{
 if(req.method!=='POST'||req.url!=='/authenticate')return answer(res,404);
 if(req.headers['content-type']?.split(';')[0]!=='application/x-www-form-urlencoded')return answer(res,415);
 const chunks=[];let bytes=0;
 try{
  for await(const chunk of req){bytes+=chunk.length;if(bytes>2048)return answer(res,413);chunks.push(chunk);}
  const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  const username=params.get('username')||'',password=params.get('password')||'';
  const framed=(params.get('framedProtocol')||'').toUpperCase();
  // RouterOS sends Framed-Protocol=PPP on PPPoE requests.
  const protocol=framed==='PPP'?'pppoe':'hotspot';
  if(!username||username.length>128||!password||password.length>128)return answer(res,401);
  const upstream=await fetch(origin+'/api/network/radius/auth',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(6000),
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({routerId,username,password,protocol})
  });
  // Fail closed. No credentials or upstream error details are included in responses/logs.
  return answer(res,upstream.status===204?204:upstream.status===401?401:503);
 }catch{return answer(res,503);}
});
server.requestTimeout=8000;
server.headersTimeout=9000;
server.listen(port,'127.0.0.1',()=>console.log('[ZARAY RADIUS] Passerelle locale en écoute sur 127.0.0.1:'+port));
