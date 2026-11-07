/** Download the RouterOS-native CAPPORT template without evaluating its macros.
 * This static file is intentionally NOT JSON until RouterOS expands $(...) tokens.
 * Keep the existing router md5.js and other native HotSpot assets.
 */
export async function downloadMikrotikCaptiveApi():Promise<void>{
 const response=await fetch('/hotspot/zaray-api.json',{cache:'no-store'});
 if(!response.ok)throw Error('Fichier API captive indisponible.');
 const contents=await response.text();
 if(!contents.includes('$(if logged-in')||
    !contents.includes('$(link-login-only)')||
    !contents.includes('"captive"')||
    !contents.includes('"user-portal-url"'))
  throw Error('Modèle de détection du portail incomplet.');
 const url=URL.createObjectURL(new Blob([contents],{type:'application/json;charset=utf-8'}));
 try{
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download='api.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
 }finally{
  // Allow the browser to open the blob before cleanup.
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
}
