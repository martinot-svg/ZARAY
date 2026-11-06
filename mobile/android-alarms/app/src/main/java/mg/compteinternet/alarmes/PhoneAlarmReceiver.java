package mg.compteinternet.alarmes;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import org.json.JSONObject;

/** Offline local reminder. Its content must still exist in the current site schedule. */
public final class PhoneAlarmReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context ctx,Intent intent){
  if(intent==null)return;
  String siteId=intent.getStringExtra("siteId");
  String reminderId=intent.getStringExtra("reminderId");
  if(siteId==null||reminderId==null)return;
  JSONObject current=SiteAlarmScheduler.currentReminder(ctx,siteId,reminderId);
  if(current==null)return; // revoked, renewed, canceled or superseded alarm
  if(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
   !=PackageManager.PERMISSION_GRANTED)return;
  String title=current.optString("title","Mon abonnement Internet");
  String message=current.optString("message","Rappel d'échéance");
  long lastVerified=current.optLong("lastVerifiedAt",0);
  // Never present an offline cached date as freshly confirmed by the provider.
  if(lastVerified<=0||System.currentTimeMillis()-lastVerified>24*3600000L)
   message="Rappel hors connexion : échéance enregistrée lors de la dernière synchronisation. Vérifiez votre compte.";
  NotificationManager manager=(NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
  String channelId="internet_reminders_v1";
  if(Build.VERSION.SDK_INT>=26){
   NotificationChannel channel=new NotificationChannel(channelId,"Rappels d'abonnement",NotificationManager.IMPORTANCE_HIGH);
   channel.setDescription("Rappels d'échéance programmés sur votre téléphone");
   manager.createNotificationChannel(channel);
  }
  Intent account=new Intent(ctx,MainActivity.class);
  account.setAction(Intent.ACTION_VIEW);
  account.setData(Uri.parse("compteinternet-alarmes://site/"+siteId));
  account.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
  PendingIntent open=PendingIntent.getActivity(ctx,siteId.hashCode(),account,
   PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  Notification note=new Notification.Builder(ctx,channelId)
   .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
   .setContentTitle(title).setContentText(message)
   .setStyle(new Notification.BigTextStyle().bigText(message))
   .setContentIntent(open).setAutoCancel(true)
   .setCategory(Notification.CATEGORY_REMINDER).build();
  manager.notify(reminderId.hashCode(),note);
 }
}
