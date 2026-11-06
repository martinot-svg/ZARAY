package mg.compteinternet.alarmes;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Site-isolated sync: no WebView, browser cookie, Supabase service key, or background polling loop.
 * A temporary network failure never deletes the last known offline alarms.
 */
public final class AlarmSyncWorker extends Worker {
 private static final String BASE="https://zaray.vercel.app";
 public AlarmSyncWorker(@NonNull Context context,@NonNull WorkerParameters params){super(context,params);}

 @NonNull @Override public Result doWork(){
  Context ctx=getApplicationContext();
  boolean retry=false;
  for(String siteId:DeviceStore.sites(ctx)){
   if(isStopped())return Result.retry();
   JSONObject device;
   try{
    device=DeviceStore.read(ctx,siteId);
    if(device==null)continue;
    if(!device.optString("token").matches("^[A-Za-z0-9_-]{43}$"))
     throw new SecurityException("Jeton local invalide");
   }catch(Exception corruptLocalCredential){
    SiteAlarmScheduler.clearSite(ctx,siteId);
    DeviceStore.remove(ctx,siteId);
    continue;
   }
   try{
    if(!syncOne(ctx,siteId,device.getString("token")))retry=true;
   }catch(Exception temporaryNetworkOrPayloadError){
    // A malformed/unavailable HTTP response must NEVER revoke a still-valid device.
    retry=true;
   }
  }
  return retry?Result.retry():Result.success();
 }
 private static boolean syncOne(Context ctx,String siteId,String token) throws Exception {
  if(!siteId.matches("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"))
   throw new SecurityException("Site local invalide");
  HttpURLConnection conn=null;
  try{
   conn=(HttpURLConnection)new URL(BASE+"/api/residential/alarm-schedule?siteId="+siteId).openConnection();
   conn.setConnectTimeout(12000);conn.setReadTimeout(12000);conn.setInstanceFollowRedirects(false);
   conn.setUseCaches(false);
   conn.setRequestProperty("Authorization","Device "+token);
   conn.setRequestProperty("Accept","application/json");
   int response=conn.getResponseCode();
   if(response==401||response==403||response==410){
    SiteAlarmScheduler.clearSite(ctx,siteId);
    DeviceStore.remove(ctx,siteId);
    return true;
   }
   if(response!=200)return false; // 429, 5xx, 404: retry; never erase valid offline data
   byte[] body;
   try(InputStream input=conn.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
    byte[] buffer=new byte[2048];int count;
    while((count=input.read(buffer))!=-1){
     if(output.size()+count>65536)throw new SecurityException("Réponse trop volumineuse");
     output.write(buffer,0,count);
    }
    body=output.toByteArray();
   }
   JSONObject data=new JSONObject(new String(body,StandardCharsets.UTF_8));
   JSONObject site=data.optJSONObject("site");
   if(site==null||!siteId.equals(site.optString("id")))
    throw new SecurityException("Réponse de site incorrecte");
   if(!data.has("enabled")||!data.has("reminders"))
    throw new SecurityException("Échéance incomplète");
   SiteAlarmScheduler.synchronize(ctx,data);
   DeviceStore.markSynced(ctx,siteId,site.optString("brandName",site.optString("name")));
   return true;
  }finally{if(conn!=null)conn.disconnect();}
 }
}
