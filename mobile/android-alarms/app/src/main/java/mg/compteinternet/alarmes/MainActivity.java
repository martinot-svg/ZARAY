package mg.compteinternet.alarmes;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.util.Date;

/** Native companion with one-time pairing; the embedded account is optional and is
 * never a source of background credentials. Providers' brands appear in notifications.
 */
public final class MainActivity extends Activity {
 private static final String BASE="https://zaray.vercel.app";
 private static final String UUID="(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
 private static final String TOKEN="^[A-Za-z0-9_-]{43}$";
 private final Handler handler=new Handler(Looper.getMainLooper());
 private WebView web;
 private EditText siteInput,codeInput;
 private TextView status,linked;
 private boolean processing=false;
 private boolean lastExactPermission=false;
 private final Runnable displayUpdates=new Runnable(){
  @Override public void run(){renderLinks();handler.postDelayed(this,5000);}
 };

 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  LinearLayout layout=new LinearLayout(this);
  layout.setOrientation(LinearLayout.VERTICAL);
  int pad=(int)(12*getResources().getDisplayMetrics().density);
  layout.setPadding(pad,pad,pad,pad);
  TextView title=new TextView(this);
  title.setText("Rappels de mes abonnements");title.setTextSize(19);
  layout.addView(title);
  status=new TextView(this);
  status.setText("Associez votre téléphone depuis le compte de votre fournisseur.");
  layout.addView(status);
  linked=new TextView(this);layout.addView(linked);
  siteInput=new EditText(this);
  siteInput.setSingleLine(true);siteInput.setHint("Identifiant du site");
  layout.addView(siteInput);
  codeInput=new EditText(this);
  codeInput.setSingleLine(true);codeInput.setHint("Code temporaire d'association");
  layout.addView(codeInput);
  Button pair=new Button(this);pair.setText("Associer ce téléphone");
  pair.setOnClickListener(v->pair());layout.addView(pair);
  Button allow=new Button(this);allow.setText("Autoriser alarmes et notifications");
  allow.setOnClickListener(v->requestAlarmPermissions());layout.addView(allow);
  Button refresh=new Button(this);refresh.setText("Actualiser mes rappels");
  refresh.setOnClickListener(v->{AlarmSyncScheduler.enqueueNow(this);
   status.setText("Synchronisation demandée. La dernière échéance confirmée restera indiquée.");});
  layout.addView(refresh);
  Button open=new Button(this);open.setText("Ouvrir mon compte");
  open.setOnClickListener(v->openSite(siteInput.getText().toString().trim()));
  layout.addView(open);
  Button unlink=new Button(this);unlink.setText("Dissocier ce site");
  unlink.setOnClickListener(v->unlink());layout.addView(unlink);

  web=new WebView(this);
  WebSettings settings=web.getSettings();
  settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    Uri url=request.getUrl();
    return !("https".equals(url.getScheme())&&"zaray.vercel.app".equalsIgnoreCase(url.getHost()));
   }
  });
  layout.addView(web,new LinearLayout.LayoutParams(-1,0,1));
  setContentView(layout);

  AlarmSyncScheduler.ensurePeriodic(this);
  lastExactPermission=hasExactPermission();
  handleIntent(getIntent());
  renderLinks();
 }
 private void handleIntent(Intent intent){
  Uri uri=intent==null?null:intent.getData();
  if(uri==null||!"compteinternet-alarmes".equals(uri.getScheme())
   ||uri.getPathSegments().isEmpty())return;
  String host=uri.getHost();
  String siteId=uri.getPathSegments().get(0);
  if(!siteId.matches(UUID))return;
  siteInput.setText(siteId);
  if("pair".equals(host)&&uri.getPathSegments().size()==2){
   String code=uri.getPathSegments().get(1);
   if(code.matches(TOKEN)){
    codeInput.setText(code);
    status.setText("Code reçu. Confirmez l'association de ce téléphone au site indiqué.");
   }
  }else if("site".equals(host))openSite(siteId);
 }
 @Override protected void onNewIntent(Intent intent){
  super.onNewIntent(intent);setIntent(intent);handleIntent(intent);
 }
 private void openSite(String siteId){
  if(!siteId.matches(UUID)){status.setText("Identifiant de site invalide.");return;}
  web.loadUrl(BASE+"/mon-internet/"+siteId);
 }
 private void requestAlarmPermissions(){
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
   !=PackageManager.PERMISSION_GRANTED){
   requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},1);
  }
  if(Build.VERSION.SDK_INT>=31&&!hasExactPermission()){
   startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
    Uri.parse("package:"+getPackageName())));
   return;
  }
  status.setText("Autorisations vérifiées. Les alarmes approximatives restent disponibles si l'accès exact est refusé.");
 }
 private boolean hasExactPermission(){
  if(Build.VERSION.SDK_INT<31)return true;
  AlarmManager manager=(AlarmManager)getSystemService(ALARM_SERVICE);
  return manager.canScheduleExactAlarms();
 }
 private void pair(){
  if(processing)return;
  String selected=siteInput.getText().toString().trim();
  String code=codeInput.getText().toString().trim();
  if(!selected.matches(UUID)||!code.matches(TOKEN)){
   status.setText("Ouvrez le lien d'association depuis le compte de votre fournisseur.");return;
  }
  processing=true;status.setText("Association sécurisée en cours…");
  new Thread(()->{
   HttpURLConnection conn=null;
   try{
    conn=(HttpURLConnection)new URL(BASE+"/api/residential/alarm-devices/claim").openConnection();
    conn.setRequestMethod("POST");conn.setDoOutput(true);
    conn.setConnectTimeout(12000);conn.setReadTimeout(12000);
    conn.setInstanceFollowRedirects(false);conn.setRequestProperty("Content-Type","application/json");
    conn.setRequestProperty("Accept","application/json");
    JSONObject body=new JSONObject();
    body.put("siteId",selected);body.put("pairingCode",code);
    body.put("deviceName",android.os.Build.MANUFACTURER+" "+android.os.Build.MODEL);
    try(OutputStream out=conn.getOutputStream()){
     out.write(body.toString().getBytes(StandardCharsets.UTF_8));
    }
    if(conn.getResponseCode()!=201)throw new IllegalStateException("Code utilisé, expiré ou connexion indisponible.");
    JSONObject reply=readJson(conn);
    String returned=reply.optString("siteId");
    String token=reply.optString("deviceToken");
    String deviceId=reply.optString("deviceId");
    if(!selected.equals(returned)||!token.matches(TOKEN)||!deviceId.matches(UUID))
     throw new SecurityException("Réponse d'association invalide");
    DeviceStore.associate(this,selected,reply.optString("siteName","Mon fournisseur"),deviceId,token);
    AlarmSyncScheduler.ensurePeriodic(this);AlarmSyncScheduler.enqueueNow(this);
    runOnUiThread(()->{
     codeInput.setText("");
     status.setText("Téléphone associé. Récupération des rappels demandée.");
     renderLinks();
    });
   }catch(Exception e){
    runOnUiThread(()->status.setText("Association impossible : vérifiez le code et votre connexion."));
   }finally{
    if(conn!=null)conn.disconnect();
    runOnUiThread(()->processing=false);
   }
  },"pair-android-device").start();
 }
 private void unlink(){
  if(processing)return;
  String selected=siteInput.getText().toString().trim();
  if(!selected.matches(UUID)){status.setText("Choisissez un site associé.");return;}
  processing=true;
  new Thread(()->{
   HttpURLConnection conn=null;
   try{
    JSONObject device=DeviceStore.read(this,selected);
    if(device==null)throw new IllegalStateException("Site non associé");
    conn=(HttpURLConnection)new URL(BASE+"/api/residential/alarm-devices/claim?siteId="+selected).openConnection();
    conn.setRequestMethod("DELETE");conn.setConnectTimeout(12000);conn.setReadTimeout(12000);
    conn.setInstanceFollowRedirects(false);
    conn.setRequestProperty("Authorization","Device "+device.getString("token"));
    int response=conn.getResponseCode();
    if(response!=200&&response!=401&&response!=410)
     throw new IllegalStateException("Révocation indisponible");
    SiteAlarmScheduler.clearSite(this,selected);
    DeviceStore.remove(this,selected);
    runOnUiThread(()->{status.setText("Téléphone dissocié de ce site.");renderLinks();});
   }catch(Exception e){
    runOnUiThread(()->status.setText("Dissociation non confirmée. Réessayez avec Internet."));
   }finally{
    if(conn!=null)conn.disconnect();
    runOnUiThread(()->processing=false);
   }
  },"unlink-android-device").start();
 }
 private static JSONObject readJson(HttpURLConnection conn) throws Exception {
  try(InputStream in=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] buf=new byte[2048];int n;
   while((n=in.read(buf))!=-1){
    if(out.size()+n>65536)throw new IllegalStateException("Réponse trop volumineuse");
    out.write(buf,0,n);
   }
   return new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8));
  }
 }
 private void renderLinks(){
  if(linked==null)return;
  StringBuilder text=new StringBuilder();
  for(String siteId:DeviceStore.sites(this)){
   try{
    JSONObject item=DeviceStore.read(this,siteId);
    if(item==null)continue;
    long sync=item.optLong("lastSyncAt",0);
    String date=sync>0?DateFormat.getDateTimeInstance().format(new Date(sync)):"pas encore synchronisé";
    text.append(item.optString("name","Mon fournisseur")).append(" · ").append(date).append("\n");
   }catch(Exception ignored){text.append("Un compte nécessite une nouvelle association.\n");}
  }
  if(text.length()==0)text.append("Aucun téléphone associé.\n");
  linked.setText(text.toString());
 }
 @Override protected void onResume(){
  super.onResume();
  handler.removeCallbacks(displayUpdates);handler.post(displayUpdates);
  boolean exact=hasExactPermission();
  if(exact!=lastExactPermission)SiteAlarmScheduler.restoreAfterReboot(this);
  lastExactPermission=exact;
  AlarmSyncScheduler.enqueueNow(this);
 }
 @Override protected void onPause(){
  handler.removeCallbacks(displayUpdates);
  super.onPause();
 }
 @Override public void onDestroy(){
  handler.removeCallbacks(displayUpdates);
  if(web!=null){web.stopLoading();web.destroy();web=null;}
  super.onDestroy();
 }
}
