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
import android.view.View;
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
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Android companion app: first associate a site's UUID, then sign in to the site's
 * existing OTP-protected web account. No credentials or Supabase keys in the APK.
 * Once allowed, local alarms work without Wi-Fi; renewed dates need a new sync.
 */
public final class MainActivity extends Activity{
 private static final String BASE="https://zaray.vercel.app";
 private static final String ID_PATTERN="(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
 private final Handler handler=new Handler(Looper.getMainLooper());
 private WebView web;
 private EditText siteInput;
 private TextView status;
 private String siteId;
 private boolean syncing=false;
 private final Runnable foregroundSync=new Runnable(){
  @Override public void run(){
   if(siteId!=null)sync();
   handler.postDelayed(this,60000);
  }
 };

 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  LinearLayout layout=new LinearLayout(this);
  layout.setOrientation(LinearLayout.VERTICAL);
  int pad=(int)(14*getResources().getDisplayMetrics().density);
  layout.setPadding(pad,pad,pad,pad);
  TextView title=new TextView(this);
  title.setText("Rappels Internet · Mon compte");
  title.setTextSize(19);
  layout.addView(title);
  status=new TextView(this);
  status.setText("Associez le site de votre fournisseur pour synchroniser vos alarmes.");
  layout.addView(status);

  siteInput=new EditText(this);
  siteInput.setSingleLine(true);
  siteInput.setHint("Identifiant du site (fourni par votre opérateur)");
  layout.addView(siteInput);

  Button open=new Button(this);open.setText("Ouvrir mon compte");
  open.setOnClickListener(v->openSite(siteInput.getText().toString().trim()));
  layout.addView(open);
  Button allow=new Button(this);allow.setText("Autoriser alarmes et notifications");
  allow.setOnClickListener(v->requestAlarmPermissions());
  layout.addView(allow);
  Button refresh=new Button(this);refresh.setText("Synchroniser mes rappels");
  refresh.setOnClickListener(v->sync());
  layout.addView(refresh);

  web=new WebView(this);
  WebSettings settings=web.getSettings();
  settings.setJavaScriptEnabled(true);
  settings.setDomStorageEnabled(true);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  CookieManager.getInstance().setAcceptCookie(true);
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    Uri url=request.getUrl();
    return !("https".equals(url.getScheme())&&"zaray.vercel.app".equalsIgnoreCase(url.getHost()));
   }
   @Override public void onPageFinished(WebView view,String url){
    if(siteId!=null)handler.postDelayed(()->sync(),1500);
   }
  });
  layout.addView(web,new LinearLayout.LayoutParams(-1,0,1));
  setContentView(layout);

  String candidate=fromIntent(getIntent());
  if(candidate==null)candidate=getPreferences(MODE_PRIVATE).getString("active_site",null);
  if(candidate!=null)openSite(candidate);
 }
 private String fromIntent(Intent intent){
  Uri url=intent==null?null:intent.getData();
  if(url==null||!"compteinternet-alarmes".equals(url.getScheme())
   ||!"site".equals(url.getHost())||url.getPathSegments().isEmpty())return null;
  String id=url.getPathSegments().get(0);
  return id.matches(ID_PATTERN)?id:null;
 }
 @Override protected void onNewIntent(Intent intent){
  super.onNewIntent(intent);setIntent(intent);
  String next=fromIntent(intent);if(next!=null)openSite(next);
 }
 private void openSite(String selected){
  if(selected==null||!selected.matches(ID_PATTERN)){
   status.setText("Identifiant du site invalide. Ouvrez le lien d'association fourni par votre site.");
   return;
  }
  siteId=selected;
  siteInput.setText(siteId);
  getPreferences(MODE_PRIVATE).edit().putString("active_site",siteId).apply();
  web.loadUrl(BASE+"/mon-internet/"+siteId);
  status.setText("Connectez-vous dans l'espace du fournisseur pour autoriser les rappels.");
 }
 private void requestAlarmPermissions(){
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
   !=PackageManager.PERMISSION_GRANTED){
   requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},1);
  }
  if(Build.VERSION.SDK_INT>=31){
   AlarmManager mgr=(AlarmManager)getSystemService(ALARM_SERVICE);
   if(!mgr.canScheduleExactAlarms()){
    startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
     Uri.parse("package:"+getPackageName())));
    return;
   }
  }
  status.setText("Autorisations vérifiées. Activez la synchronisation dans votre compte puis synchronisez.");
 }
 private void sync(){
  if(syncing||siteId==null||web==null)return;
  Uri current=Uri.parse(web.getUrl()==null?"":web.getUrl());
  if(!("https".equals(current.getScheme())
   &&"zaray.vercel.app".equalsIgnoreCase(current.getHost())))return;
  final String selected=siteId;
  final String cookies=CookieManager.getInstance().getCookie(BASE);
  CookieManager.getInstance().flush();
  syncing=true;
  new Thread(()->{
   HttpURLConnection conn=null;
   try{
    URL endpoint=new URL(BASE+"/api/residential/alarm-schedule?siteId="+selected);
    conn=(HttpURLConnection)endpoint.openConnection();
    conn.setConnectTimeout(10000);conn.setReadTimeout(10000);
    conn.setInstanceFollowRedirects(false);
    conn.setRequestProperty("Accept","application/json");
    if(cookies!=null)conn.setRequestProperty("Cookie",cookies);
    int code=conn.getResponseCode();
    if(code!=200){
     showStatus(code==401?"Connectez-vous à votre compte abonné, puis synchronisez.":"Synchronisation indisponible ("+code+").");
     return;
    }
    byte[] payload;
    try(InputStream stream=conn.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
     byte[] buf=new byte[2048];int n;
     while((n=stream.read(buf))!=-1){
      if(out.size()+n>65536)throw new IllegalStateException("Réponse trop volumineuse");
      out.write(buf,0,n);
     }
     payload=out.toByteArray();
    }
    JSONObject data=new JSONObject(new String(payload,StandardCharsets.UTF_8));
    JSONObject site=data.optJSONObject("site");
    if(site==null||!selected.equals(site.optString("id")))
     throw new SecurityException("Réponse associée à un autre site");
    runOnUiThread(()->{
     try{
      int count=SiteAlarmScheduler.synchronize(this,data);
      if(!data.optBoolean("enabled")){
       status.setText("Synchronisation désactivée pour ce site. Aucune alarme locale active.");
      }else{
       AlarmManager manager=(AlarmManager)getSystemService(ALARM_SERVICE);
       boolean exact=Build.VERSION.SDK_INT<31||manager.canScheduleExactAlarms();
       boolean notifications=Build.VERSION.SDK_INT<33
        ||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
       status.setText(count+" rappels locaux enregistrés pour "+
        site.optString("name")+(exact?"":" (heure approximative)")
        +(notifications?"":" · autorisez aussi les notifications."));
      }
     }catch(Exception e){status.setText("Alarmes non programmées : "+e.getMessage());}
    });
   }catch(Exception e){showStatus("Impossible de synchroniser les rappels. Vérifiez votre connexion et réessayez.");}
   finally{
    if(conn!=null)conn.disconnect();
    runOnUiThread(()->syncing=false);
   }
  },"sync-site-alarms").start();
 }
 private void showStatus(String value){runOnUiThread(()->status.setText(value));}
 @Override public void onResume(){
  super.onResume();
  handler.removeCallbacks(foregroundSync);
  handler.postDelayed(foregroundSync,2000);
 }
 @Override public void onPause(){
  handler.removeCallbacks(foregroundSync);
  super.onPause();
 }
 @Override public void onDestroy(){
  handler.removeCallbacks(foregroundSync);
  if(web!=null){web.stopLoading();web.destroy();web=null;}
  super.onDestroy();
 }
}
