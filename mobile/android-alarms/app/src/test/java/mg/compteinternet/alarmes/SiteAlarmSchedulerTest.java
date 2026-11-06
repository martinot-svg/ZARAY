package mg.compteinternet.alarmes;

import android.app.AlarmManager;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlarmManager;
import java.time.Instant;
import static org.junit.Assert.*;

/** JVM Android shadow tests. These do not substitute real-device battery/reboot validation. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class SiteAlarmSchedulerTest {
 private static final String SITE_A="11111111-1111-4111-8111-111111111111";
 private static final String SITE_B="22222222-2222-4222-8222-222222222222";
 private Context ctx;
 private ShadowAlarmManager alarms;
 @Before public void setup(){
  ctx=RuntimeEnvironment.getApplication();
  alarms=Shadows.shadowOf((AlarmManager)ctx.getSystemService(Context.ALARM_SERVICE));
  SiteAlarmScheduler.clearSite(ctx,SITE_A);
  SiteAlarmScheduler.clearSite(ctx,SITE_B);
 }
 private static JSONObject item(String identity,long when,int days) throws Exception {
  return new JSONObject().put("id","residential:"+identity)
   .put("daysBefore",days).put("scheduledAt",Instant.ofEpochMilli(when).toString())
   .put("title","MLAY Connexion").put("message","Votre abonnement expire bientôt.");
 }
 private static JSONObject plan(String site,String identity,long when) throws Exception {
  return new JSONObject().put("site",new JSONObject().put("id",site)
   .put("name","MLAY Connexion").put("brandName","MLAY Connexion"))
   .put("enabled",true).put("reminders",new JSONArray().put(item(identity,when,7)));
 }
 private static long future(){return System.currentTimeMillis()+2L*86400000L;}

 @Test public void reapplyingUnchangedScheduleDoesNotDuplicateAlarm() throws Exception {
  JSONObject schedule=plan(SITE_A,"subA:2026-12-01:7",future());
  assertEquals(1,SiteAlarmScheduler.synchronize(ctx,schedule));
  assertEquals(1,alarms.getScheduledAlarms().size());
  assertEquals(1,SiteAlarmScheduler.synchronize(ctx,schedule));
  assertEquals(1,alarms.getScheduledAlarms().size());
 }
 @Test public void renewalCancelsOldIdBeforeNewSchedule() throws Exception {
  long old=future();
  SiteAlarmScheduler.synchronize(ctx,plan(SITE_A,"subA:2026-12-01:7",old));
  assertEquals(1,alarms.getScheduledAlarms().size());
  SiteAlarmScheduler.synchronize(ctx,plan(SITE_A,"subA:2026-12-31:7",old+10L*86400000L));
  assertEquals(1,alarms.getScheduledAlarms().size());
  assertNull(SiteAlarmScheduler.currentReminder(ctx,SITE_A,"residential:subA:2026-12-01:7"));
  SiteAlarmScheduler.clearSite(ctx,SITE_A);
  assertEquals(0,alarms.getScheduledAlarms().size());
 }
 @Test public void disablingSiteKeepsOtherCompanySiteAlarms() throws Exception {
  SiteAlarmScheduler.synchronize(ctx,plan(SITE_A,"subscriptionA:7",future()));
  SiteAlarmScheduler.synchronize(ctx,plan(SITE_B,"subscriptionB:7",future()));
  assertEquals(2,alarms.getScheduledAlarms().size());
  SiteAlarmScheduler.clearSite(ctx,SITE_A);
  assertEquals(1,alarms.getScheduledAlarms().size());
  SiteAlarmScheduler.clearSite(ctx,SITE_B);
  assertEquals(0,alarms.getScheduledAlarms().size());
 }
 @Test public void duplicateReminderIdsAreRejectedBeforePreviousPlanMutates() throws Exception {
  JSONObject current=plan(SITE_A,"subscriptionA:7",future());
  SiteAlarmScheduler.synchronize(ctx,current);
  JSONObject duplicate=plan(SITE_A,"subscriptionA:7",future());
  JSONArray reminders=duplicate.getJSONArray("reminders");
  reminders.put(item("subscriptionA:7",future(),7));
  try{
   SiteAlarmScheduler.synchronize(ctx,duplicate);
   fail("Duplicate reminder identifiers should be rejected");
  }catch(IllegalArgumentException expected){
   assertEquals(1,alarms.getScheduledAlarms().size());
  }
 }
 @Test public void rebootRestorationDoesNotClaimNewServerVerification() throws Exception {
  SiteAlarmScheduler.synchronize(ctx,plan(SITE_A,"subscriptionA:7",future()));
  SharedPreferences preferences=ctx.getSharedPreferences("site_alarms_v1",Context.MODE_PRIVATE);
  long verified=new JSONObject(preferences.getString("schedule:"+SITE_A,"{}")).getLong("lastVerifiedAt");
  assertTrue(verified>0);
  // Simulate Android dropping the pending wakeup alarm on reboot.
  assertNotNull(alarms.getNextScheduledAlarm());
  assertEquals(0,alarms.getScheduledAlarms().size());
  SiteAlarmScheduler.restoreAfterReboot(ctx);
  assertEquals(1,alarms.getScheduledAlarms().size());
  long restored=new JSONObject(preferences.getString("schedule:"+SITE_A,"{}")).getLong("lastVerifiedAt");
  assertEquals(verified,restored);
 }
}
