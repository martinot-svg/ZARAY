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
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Per-site, idempotent AlarmManager reconciliation; alarms are UTC instants from ZARAY.
 * A reboot restores those instants WITHOUT falsely advancing the last server-sync timestamp.
 */
public final class SiteAlarmScheduler {
 private static final String STORE="site_alarms_v1";
 private static final String PREFIX="schedule:";
 private SiteAlarmScheduler(){}
 private static SharedPreferences prefs(Context ctx){return ctx.getSharedPreferences(STORE,Context.MODE_PRIVATE);}

 private static PendingIntent pending(Context ctx,String siteId,JSONObject item){
  String id=item.optString("id");
  Intent intent=new Intent(ctx,PhoneAlarmReceiver.class);
  intent.setData(Uri.parse("localalarm://"+siteId+"/"+Uri.encode(id)));
  intent.putExtra("siteId",siteId);
  intent.putExtra("reminderId",id);
  return PendingIntent.getBroadcast(ctx,(siteId+":"+id).hashCode(),intent,
   PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
 }
 private static JSONObject previous(Context ctx,String siteId){
  try{
   String json=prefs(ctx).getString(PREFIX+siteId,null);
   return json==null?null:new JSONObject(json);
  }catch(Exception ignored){return null;}
 }
 private static Map<String,JSONObject> indexed(JSONArray array){
  Map<String,JSONObject> map=new HashMap<>();
  if(array!=null)for(int i=0;i<array.length();i++){
   JSONObject item=array.optJSONObject(i);
   if(item!=null)map.put(item.optString("id"),item);
  }
  return map;
 }
 private static void cancel(Context ctx,String siteId,JSONObject item){
  AlarmManager mgr=(AlarmManager)ctx.getSystemService(Context.ALARM_SERVICE);
  PendingIntent pi=pending(ctx,siteId,item);
  mgr.cancel(pi);pi.cancel();
 }
 private static void removeScheduled(Context ctx,String siteId){
  JSONObject old=previous(ctx,siteId);
  JSONArray items=old==null?null:old.optJSONArray("reminders");
  if(items!=null)for(int i=0;i<items.length();i++){
   JSONObject item=items.optJSONObject(i);
   if(item!=null){PendingIntent pi=pending(ctx,siteId,item);
    AlarmManager mgr=(AlarmManager)ctx.getSystemService(Context.ALARM_SERVICE);
    mgr.cancel(pi);pi.cancel();}
  }
 }
 public static synchronized void clearSite(Context ctx,String siteId){
  removeScheduled(ctx,siteId);
  prefs(ctx).edit().remove(PREFIX+siteId).commit();
 }
 public static synchronized int synchronize(Context ctx,JSONObject schedule) throws Exception{
  return reconcile(ctx,schedule,false,false);
 }
 private static int reconcile(Context ctx,JSONObject schedule,boolean force,boolean localRestore) throws Exception{
  JSONObject site=schedule.optJSONObject("site");
  if(site==null)throw new IllegalArgumentException("Site manquant");
  String siteId=site.optString("id");
  if(!siteId.matches("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"))
   throw new IllegalArgumentException("Site invalide");
  boolean enabled=schedule.optBoolean("enabled");
  JSONArray items=schedule.optJSONArray("reminders");
  if(enabled&&items==null)throw new IllegalArgumentException("Rappels manquants");
  if(items!=null&&items.length()>4)throw new IllegalArgumentException("Trop de rappels");
  JSONArray valid=new JSONArray();
  Set<String> seen=new HashSet<>();
  long now=System.currentTimeMillis();
  if(enabled&&items!=null)for(int i=0;i<items.length();i++){
   JSONObject item=items.optJSONObject(i);
   if(item==null)throw new IllegalArgumentException("Rappel invalide");
   String id=item.optString("id");
   if(!id.startsWith("residential:")||id.length()>220||!seen.add(id))
    throw new IllegalArgumentException("Identifiant de rappel invalide");
   int days=item.optInt("daysBefore",-1);
   if(days!=7&&days!=3&&days!=1&&days!=0)throw new IllegalArgumentException("Jour de rappel invalide");
   long when;
   try{when=Instant.parse(item.optString("scheduledAt")).toEpochMilli();}
   catch(Exception ex){throw new IllegalArgumentException("Date de rappel invalide");}
   if(when<=System.currentTimeMillis())continue;
   if(item.optString("title").length()>160||item.optString("message").length()>500)
    throw new IllegalArgumentException("Contenu de rappel invalide");
   valid.put(item);
  }
  JSONObject old=previous(ctx,siteId);
  Map<String,JSONObject> before=indexed(old==null?null:old.optJSONArray("reminders"));
  Map<String,JSONObject> after=indexed(valid);

  // First invalidate obsolete alarms, then persist the new truth BEFORE scheduling it.
  for(Map.Entry<String,JSONObject> entry:before.entrySet()){
   JSONObject replacement=after.get(entry.getKey());
   if(replacement==null||!entry.getValue().optString("scheduledAt")
     .equals(replacement.optString("scheduledAt")))cancel(ctx,siteId,entry.getValue());
  }
  if(!enabled){
   prefs(ctx).edit().remove(PREFIX+siteId).commit();
   return 0;
  }
  JSONObject stored=new JSONObject();
  stored.put("site",site);stored.put("enabled",true);stored.put("reminders",valid);
  stored.put("lastVerifiedAt",localRestore?schedule.optLong("lastVerifiedAt",0):now);
  if(!prefs(ctx).edit().putString(PREFIX+siteId,stored.toString()).commit())
   throw new IllegalStateException("Stockage local indisponible");
  AlarmManager mgr=(AlarmManager)ctx.getSystemService(Context.ALARM_SERVICE);
  for(int i=0;i<valid.length();i++){
   JSONObject item=valid.getJSONObject(i);
   JSONObject oldItem=before.get(item.getString("id"));
   if(!force&&oldItem!=null&&oldItem.optString("scheduledAt")
    .equals(item.optString("scheduledAt")))continue;
   long when=Instant.parse(item.getString("scheduledAt")).toEpochMilli();
   PendingIntent pi=pending(ctx,siteId,item);
   boolean exact=Build.VERSION.SDK_INT<31||mgr.canScheduleExactAlarms();
   if(exact){
    try{mgr.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);}
    catch(SecurityException noPermission){mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);}
   }else mgr.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
  }
  return valid.length();
 }

 /** Receiver checks current local plan, not untrusted extras from an old PendingIntent. */
 public static synchronized JSONObject currentReminder(Context ctx,String siteId,String reminderId){
  JSONObject state=previous(ctx,siteId);
  if(state==null||!state.optBoolean("enabled"))return null;
  JSONObject site=state.optJSONObject("site");
  if(site==null||!siteId.equals(site.optString("id")))return null;
  JSONArray items=state.optJSONArray("reminders");
  if(items==null)return null;
  for(int i=0;i<items.length();i++){
   JSONObject item=items.optJSONObject(i);
   if(item==null||!reminderId.equals(item.optString("id")))continue;
   try{
    long due=Instant.parse(item.getString("scheduledAt")).toEpochMilli();
    long delta=System.currentTimeMillis()-due;
    if(delta< -5*60000L||delta>12*3600000L)return null;
    JSONObject result=new JSONObject(item.toString());
    result.put("lastVerifiedAt",state.optLong("lastVerifiedAt",0));
    return result;
   }catch(Exception ignored){return null;}
  }
  return null;
 }
 public static synchronized void restoreAfterReboot(Context ctx){
  for(String key:prefs(ctx).getAll().keySet()){
   if(!key.startsWith(PREFIX))continue;
   String stored=prefs(ctx).getString(key,null);
   if(stored==null)continue;
   try{reconcile(ctx,new JSONObject(stored),true,true);}
   catch(Exception ignored){/* next successful online sync repairs bad state */}
  }
 }
}
