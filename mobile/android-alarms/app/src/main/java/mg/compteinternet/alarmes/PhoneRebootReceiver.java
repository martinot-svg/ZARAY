package mg.compteinternet.alarmes;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Android drops AlarmManager registrations on reboot; restore only saved future alarms. */
public final class PhoneRebootReceiver extends BroadcastReceiver{
 @Override public void onReceive(Context ctx,Intent intent){
  if(!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()))return;
  final PendingResult pending=goAsync();
  new Thread(()->{
   try{SiteAlarmScheduler.restoreAfterReboot(ctx);}
   finally{pending.finish();}
  },"restore-site-reminders").start();
 }
}
