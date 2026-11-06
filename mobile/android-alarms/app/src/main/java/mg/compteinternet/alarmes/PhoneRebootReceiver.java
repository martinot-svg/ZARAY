package mg.compteinternet.alarmes;

import android.app.AlarmManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Restore saved UTC instants after reboot/time changes/permission grant/app updates.
 * A forced-stopped app cannot receive broadcasts until the user launches it again.
 */
public final class PhoneRebootReceiver extends BroadcastReceiver{
 @Override public void onReceive(Context ctx,Intent intent){
  if(intent==null)return;
  String action=intent.getAction();
  if(!Intent.ACTION_BOOT_COMPLETED.equals(action)
   &&!Intent.ACTION_TIME_CHANGED.equals(action)
   &&!Intent.ACTION_TIMEZONE_CHANGED.equals(action)
   &&!Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
   &&!AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(action))return;
  final PendingResult pending=goAsync();
  new Thread(()->{
   try{
    if(AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(action)
     &&Build.VERSION.SDK_INT>=31){
     AlarmManager manager=(AlarmManager)ctx.getSystemService(Context.ALARM_SERVICE);
     if(!manager.canScheduleExactAlarms())return;
    }
    SiteAlarmScheduler.restoreAfterReboot(ctx);
    AlarmSyncScheduler.ensurePeriodic(ctx);
    AlarmSyncScheduler.enqueueNow(ctx); // deferred until network is available
   }finally{pending.finish();}
  },"restore-site-reminders").start();
 }
}
