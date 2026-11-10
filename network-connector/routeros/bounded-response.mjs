// Independent bounded HTTP response parser for the local RouterOS connector.
// Modelled on the observable requirement to reject oversized WinBox messages,
// NOT a reproduction of the private WinBox transport or framing protocol.
export const MAX_CONNECTOR_RESPONSE_BYTES=1024*1024;

export async function readBoundedResponseText(
 response,{maxBytes=MAX_CONNECTOR_RESPONSE_BYTES}={}
){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_CONNECTOR_RESPONSE_BYTES)
  throw Error('Invalid RouterOS response size limit');
 const rawSize=response.headers?.get('content-length');
 if(rawSize&&/^[0-9]+$/.test(rawSize)&&Number(rawSize)>maxBytes){
  await response.body?.cancel().catch(()=>{});
  throw Error('RouterOS / ZARAY response exceeds the safe size limit');
 }
 if(!response.body)return '';
 const reader=response.body.getReader();
 const decoder=new TextDecoder('utf-8',{fatal:false});
 let total=0,text='';
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))throw Error('Unexpected HTTP response stream type');
   total+=value.byteLength;
   if(total>maxBytes){
    await reader.cancel().catch(()=>{});
    throw Error('RouterOS / ZARAY response exceeds the safe size limit');
   }
   text+=decoder.decode(value,{stream:true});
  }
  return text+decoder.decode();
 }finally{reader.releaseLock();}
}
