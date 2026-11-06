package mg.compteinternet.alarmes;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/** Schedules only site-scoped reminders authenticated by the server.
 * Never writes to the user's Clock app or claims its alarms were changed.
 */
public final class SiteAlarmScheduler {
 private static final String STORE="site_alarms_v1";
 private SiteAlarmScheduler(){}

 private static PendingIntent pending(Context ctx,String siteId,JSONObject item){
  String id=item.optString("id");
  Intent intent=new Intent(ctx,PhoneAlarmReceiver.class);
  intent.setData(Uri.parse("localalarm://"+siteId+"/"+Uri.encode(id)));
  intent.putExtra("siteId",siteId);
  intent.putExtra("title",item.optString("title"));
  intent.putExtra("message",item.optString("message"));
  intent.putExtra("reminderId",id);
  return PendingIntent.getBroadcast(ctx,(siteId+":"+id).hashCode(),intent,
   PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
 }

 private static void removeScheduled(Context ctx,String siteId){
  SharedPreferences prefs=ctx.getSharedPreferences(STORE,Context.MODE_PRIVATE);
  String json=prefs.getString("schedule:"+siteId,null);
  if(json==null)return;
  try{
   JSONObject previous=new JSONObject(json);
   JSONArray items=previous.optJSONArray("reminders");
   AlarmManager mgr=(AlarmManager)ctx.getSystemService(Context.ALARM_SERVICE);
   if(items!=null)for(int i=0;i<items.length();i++){
    JSONObject item=items.optJSONObject(i);
    if(item!=null){
     PendingIntent pi=pending(ctx,siteId,item);
     mgr.cancel(pi);pi.cancel();
    }
   }
  }catch(Exception ignored){/* A corrupt saved schedule cannot block an authenticated resync. */}
 }

 public static int synchronize(Context ctx,JSONObject schedule) throws Exception{
  JSONObject site=schedule.optJSONObject("site");
  if(site==null)throw new IllegalArgumentException("Site manquant");
  String siteId=site.optString("id");
  if(!siteId.matches("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"))
   throw new IllegalArgumentException("Site invalide");

  removeScheduled(ctx,siteId);
  SharedPreferences prefs=ctx.getSharedPreferences(STORE,Context.MODE_PRIVATE);
  if(!schedule.optBoolean("enabled")){
   prefs.edit().remove("schedule:"+siteId).apply();
   return 0;
  }
  JSONArray items=schedule.optJSONArray("reminders");
  if(items==null)throw new IllegalArgumentException("Rappels manquants");
  JSONArray valid=new JSONArray();
  AlarmManager mgr=(AlarmManager)ctx.getSystemService(Context.ALARM_SERVICE);
  for(int i=0;i<Math.min(items.length(),4);i++){
   JSONObject item=items.optJSONObject(i);
   if(item==null)continue;
   String iso=item.optString("scheduledAt");
   long when;
   try{when=java.time.Instant.parse(iso).toEpochMilli();}
   catch(Exception ex){continue;}
   if(when<=System.currentTimeMillis())continue;
   String id=item.optString("id");
   if(!id.startsWith("residential:")||id.length()>220)continue;
   PendingIntent pi=pending(ctx,siteId,item);
   boolean exact=Build.VERSION.SDK_INT<31||mgr.canScheduleExactAlarms();
   if(exact){
    try{mgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);}
    catch(SecurityException noPermission){mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);}
   }else mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
   valid.put(item);
  }
  JSONObject stored=new JSONObject();
  stored.put("site",site);stored.put("enabled",true);stored.put("reminders",valid);
  prefs.edit().putString("schedule:"+siteId,stored.toString()).apply();
  return valid.length();
 }

 public static void restoreAfterReboot(Context ctx){
  SharedPreferences prefs=ctx.getSharedPreferences(STORE,Context.MODE_PRIVATE);
  for(String key:prefs.getAll().keySet()){
   if(!key.startsWith("schedule:"))continue;
   String stored=prefs.getString(key,null);
   if(stored==null)continue;
   try{synchronize(ctx,new JSONObject(stored));}
   catch(Exception ignored){/* Next foreground sync repairs stale or incompatible data. */}
  }
 }
}
