package mg.compteinternet.alarmes;

import android.content.Context;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

/** WorkManager owns deferred network synchronization, not alarm delivery time. */
public final class AlarmSyncScheduler {
 private static final String PERIODIC="subscriber-periodic-alarm-sync-v1";
 private static final String IMMEDIATE="subscriber-immediate-alarm-sync-v1";
 private AlarmSyncScheduler(){}
 private static Constraints connected(){
  return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
 }
 public static void ensurePeriodic(Context ctx){
  PeriodicWorkRequest request=new PeriodicWorkRequest.Builder(AlarmSyncWorker.class,
    6,TimeUnit.HOURS,1,TimeUnit.HOURS)
   .setConstraints(connected()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS)
   .build();
  WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(PERIODIC,ExistingPeriodicWorkPolicy.KEEP,request);
 }
 public static void enqueueNow(Context ctx){
  OneTimeWorkRequest request=new OneTimeWorkRequest.Builder(AlarmSyncWorker.class)
   .setConstraints(connected()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS)
   .build();
  WorkManager.getInstance(ctx).enqueueUniqueWork(IMMEDIATE,ExistingWorkPolicy.KEEP,request);
 }
}
