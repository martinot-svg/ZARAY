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

/** Offline, local, user-visible phone alert; never depends on a live Wi-Fi session. */
public final class PhoneAlarmReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context ctx,Intent intent){
  String siteId=intent.getStringExtra("siteId");
  if(siteId==null||!siteId.matches("(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"))return;
  String title=intent.getStringExtra("title");
  String message=intent.getStringExtra("message");
  String reminderId=intent.getStringExtra("reminderId");
  if(title==null||message==null||reminderId==null)return;
  if(Build.VERSION.SDK_INT>=33&&ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
   !=PackageManager.PERMISSION_GRANTED)return;
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
   .setContentTitle(title).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message))
   .setContentIntent(open).setAutoCancel(true)
   .setCategory(Notification.CATEGORY_REMINDER).build();
  manager.notify(reminderId.hashCode(),note);
 }
}
