package mg.compteinternet.alarmes;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.HashSet;
import java.util.Set;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** App-private, per-site device credentials encrypted with Android Keystore AES-GCM.
 * Backups are disabled in the manifest: no plaintext bearer tokens or cookies on disk.
 */
public final class DeviceStore {
 private static final String PREF="resident_device_credentials_v1";
 private static final String PREFIX="device:";
 private static final String ALIAS="resident_device_aes_v1";
 private DeviceStore(){}

 private static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREF,Context.MODE_PRIVATE);}
 private static SecretKey key() throws Exception {
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");
  ks.load(null);
  java.security.Key existing=ks.getKey(ALIAS,null);
  if(existing instanceof SecretKey)return (SecretKey)existing;
  KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
  gen.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
   .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
   .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
   .setKeySize(256).setRandomizedEncryptionRequired(true).build());
  return gen.generateKey();
 }
 private static String encrypt(JSONObject data) throws Exception {
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
  cipher.init(Cipher.ENCRYPT_MODE,key());
  byte[] encrypted=cipher.doFinal(data.toString().getBytes(StandardCharsets.UTF_8));
  byte[] iv=cipher.getIV();
  byte[] combined=new byte[iv.length+encrypted.length];
  System.arraycopy(iv,0,combined,0,iv.length);
  System.arraycopy(encrypted,0,combined,iv.length,encrypted.length);
  return Base64.encodeToString(combined,Base64.NO_WRAP);
 }
 private static JSONObject decrypt(String encoded) throws Exception {
  byte[] combined=Base64.decode(encoded,Base64.NO_WRAP);
  if(combined.length<29)throw new SecurityException("Données locales invalides");
  byte[] iv=java.util.Arrays.copyOfRange(combined,0,12);
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
  cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,iv));
  byte[] raw=cipher.doFinal(combined,12,combined.length-12);
  return new JSONObject(new String(raw,StandardCharsets.UTF_8));
 }
 public static synchronized void associate(Context ctx,String siteId,String name,
                                             String deviceId,String token) throws Exception {
  JSONObject data=new JSONObject();
  data.put("siteId",siteId);data.put("name",name);data.put("deviceId",deviceId);
  data.put("token",token);data.put("lastSyncAt",0L);
  if(!prefs(ctx).edit().putString(PREFIX+siteId,encrypt(data)).commit())
   throw new IllegalStateException("Enregistrement du téléphone impossible");
 }
 public static synchronized JSONObject read(Context ctx,String siteId) throws Exception {
  String encrypted=prefs(ctx).getString(PREFIX+siteId,null);
  if(encrypted==null)return null;
  JSONObject result=decrypt(encrypted);
  if(!siteId.equals(result.optString("siteId")))throw new SecurityException("Site incorrect");
  return result;
 }
 public static synchronized Set<String> sites(Context ctx){
  Set<String> ids=new HashSet<>();
  for(String k:prefs(ctx).getAll().keySet())if(k.startsWith(PREFIX))ids.add(k.substring(PREFIX.length()));
  return ids;
 }
 public static synchronized void markSynced(Context ctx,String siteId,String name) throws Exception {
  JSONObject data=read(ctx,siteId);
  if(data==null)return; // unlinked while sync was in flight
  data.put("lastSyncAt",System.currentTimeMillis());
  data.put("name",name);
  if(!prefs(ctx).edit().putString(PREFIX+siteId,encrypt(data)).commit())
   throw new IllegalStateException("Synchronisation non enregistrée");
 }
 public static synchronized void remove(Context ctx,String siteId){
  prefs(ctx).edit().remove(PREFIX+siteId).commit();
 }
}
