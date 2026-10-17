package com.omegaplus.proai;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.ContentValues;
import android.provider.MediaStore;
import android.widget.Toast;
import android.util.Base64;
import java.io.OutputStream;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST=4101,AUDIO_PERMISSION_REQUEST=4102;
    private static final String CHANNEL_ID="omega_announcements";
    private static final String APP_URL="https://omegaplus-auto-prediction-ai.onrender.com/";
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileChooser;
    private PermissionRequest pendingWebPermission;
    private TextToSpeech textToSpeech;
    private volatile boolean ttsReady=false;
    private volatile boolean ttsInitializationComplete=false;
    private String pendingSpeechText="";
    private String pendingSpeechSource="default";
    private String currentSpeechText="";
    private String currentSpeechSource="default";

    public class AppBridge {
        @JavascriptInterface public String getVersionName(){try{PackageInfo i=getPackageManager().getPackageInfo(getPackageName(),0);return i.versionName!=null?i.versionName:"";}catch(Exception e){return "";}}
        @JavascriptInterface public int getVersionCode(){try{PackageInfo i=getPackageManager().getPackageInfo(getPackageName(),0);if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P)return (int)i.getLongVersionCode();return i.versionCode;}catch(Exception e){return 0;}}
        @JavascriptInterface public void openPlayStore(){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id="+getPackageName())));}catch(Exception e){startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/apps/details?id="+getPackageName())));}}
        @JavascriptInterface public String getSpeechStatus(){return !ttsInitializationComplete?"initializing":ttsReady?"ready":"unavailable";}
        @JavascriptInterface public void speakText(String text){queueSpeech(text,"default");}
        @JavascriptInterface public void speakTextFor(String text,String source){queueSpeech(text,source);}
        private void queueSpeech(String text,String source){
            final String value=text==null?"":text.trim();final String origin=source==null||source.trim().isEmpty()?"default":source.trim();
            if(value.isEmpty())return;
            runOnUiThread(()->{
                if(ttsInitializationComplete&&!ttsReady){dispatchSpeechFallback(value,origin);return;}
                if(textToSpeech==null||!ttsReady){pendingSpeechText=value;pendingSpeechSource=origin;return;}
                speakNow(value,origin);
            });
        }
        @JavascriptInterface public void requestNotificationPermission(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},4103);});}
        @JavascriptInterface public void showNotification(String title,String body){runOnUiThread(()->showNativeNotification(title,body));}
        @JavascriptInterface public void saveImage(String base64Png,String fileName){runOnUiThread(()->savePngToGallery(base64Png,fileName));}
    }

    private void speakNow(String value,String source){
        if(textToSpeech==null||!ttsReady||value==null||value.trim().isEmpty())return;
        currentSpeechText=value;currentSpeechSource=source==null?"default":source;
        textToSpeech.setLanguage(Locale.UK);
        int result;
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.LOLLIPOP)result=textToSpeech.speak(value,TextToSpeech.QUEUE_FLUSH,null,"omega-ai-reply");
        else result=textToSpeech.speak(value,TextToSpeech.QUEUE_FLUSH,null);
        if(result==TextToSpeech.ERROR)dispatchSpeechFallback(value,currentSpeechSource);
    }

    private void dispatchSpeechFallback(String value,String source){
        if(webView==null||value==null||value.trim().isEmpty())return;
        String detail="{\"text\":"+JSONObject.quote(value)+",\"source\":"+JSONObject.quote(source==null?"default":source)+"}";
        webView.post(()->webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('omega-native-speech-fallback',{detail:"+detail+"}));",null));
    }

    private void savePngToGallery(String base64Png,String fileName){
        try{
            if(base64Png==null||base64Png.trim().isEmpty())throw new IllegalArgumentException("Image data is empty.");
            byte[] bytes=Base64.decode(base64Png,Base64.DEFAULT);
            String safeName=(fileName==null?"omegaplus-daily-best.png":fileName).replaceAll("[^A-Za-z0-9._-]","_");
            if(!safeName.toLowerCase(Locale.ROOT).endsWith(".png"))safeName+=".png";
            ContentValues values=new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME,safeName);
            values.put(MediaStore.Images.Media.MIME_TYPE,"image/png");
            if(Build.VERSION.SDK_INT>=29)values.put(MediaStore.Images.Media.RELATIVE_PATH,"Pictures/Omegaplus");
            Uri uri=getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,values);
            if(uri==null)throw new IllegalStateException("Could not create image in gallery.");
            try(OutputStream stream=getContentResolver().openOutputStream(uri)){
                if(stream==null)throw new IllegalStateException("Could not open image output.");
                stream.write(bytes);stream.flush();
            }
            Toast.makeText(this,"Image saved to Pictures/Omegaplus",Toast.LENGTH_LONG).show();
        }catch(Exception e){Toast.makeText(this,"Could not save image: "+e.getMessage(),Toast.LENGTH_LONG).show();}
    }

    private void showNativeNotification(String title,String body){
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
        NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(manager==null)return;
        if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID,"Omegaplus announcements",NotificationManager.IMPORTANCE_DEFAULT));
        Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL_ID):new Notification.Builder(this);
        String safeTitle=title==null||title.trim().isEmpty()?"Omegaplus announcement":title;String safeBody=body==null?"":body;
        builder.setSmallIcon(getApplicationInfo().icon).setContentTitle(safeTitle).setContentText(safeBody).setStyle(new Notification.BigTextStyle().bigText(safeBody)).setAutoCancel(true);
        manager.notify(safeTitle.hashCode()^safeBody.hashCode(),builder.build());
    }

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        textToSpeech=new TextToSpeech(this,status->{
            ttsInitializationComplete=true;
            ttsReady=status==TextToSpeech.SUCCESS;
            if(ttsReady){
                textToSpeech.setLanguage(Locale.UK);
                textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                    @Override public void onStart(String utteranceId){}
                    @Override public void onDone(String utteranceId){}
                    @Override public void onError(String utteranceId){
                        if("omega-ai-reply".equals(utteranceId))runOnUiThread(()->dispatchSpeechFallback(currentSpeechText,currentSpeechSource));
                    }
                });
                String queued=pendingSpeechText,source=pendingSpeechSource;
                pendingSpeechText="";pendingSpeechSource="default";
                if(!queued.isEmpty())speakNow(queued,source);
            }else{
                String queued=pendingSpeechText,source=pendingSpeechSource;
                pendingSpeechText="";pendingSpeechSource="default";
                if(!queued.isEmpty())dispatchSpeechFallback(queued,source);
            }
        });
        webView=new WebView(this);webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{
                boolean audio=false;for(String resource:request.getResources())if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource))audio=true;
                if(!audio){request.deny();return;}
                if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                else{pendingWebPermission=request;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},AUDIO_PERMISSION_REQUEST);}
            });}
            @Override public void onPermissionRequestCanceled(PermissionRequest request){if(pendingWebPermission==request)pendingWebPermission=null;}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(pendingFileChooser!=null)pendingFileChooser.onReceiveValue(null);pendingFileChooser=callback;
                Intent intent=new Intent(Intent.ACTION_GET_CONTENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("image/*");
                try{startActivityForResult(Intent.createChooser(intent,"Choose a booking screenshot"),FILE_CHOOSER_REQUEST);return true;}
                catch(Exception e){pendingFileChooser=null;callback.onReceiveValue(null);return false;}
            }
        });
        WebSettings s=webView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setAllowFileAccess(false);s.setSupportZoom(false);s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        webView.addJavascriptInterface(new AppBridge(),"AndroidApp");setContentView(webView);webView.loadUrl(APP_URL);
    }

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if(requestCode==AUDIO_PERMISSION_REQUEST){PermissionRequest request=pendingWebPermission;pendingWebPermission=null;if(request!=null){if(grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else request.deny();}}
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);if(requestCode!=FILE_CHOOSER_REQUEST)return;
        if(pendingFileChooser==null)return;Uri[] results=null;if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null)results=new Uri[]{data.getData()};
        pendingFileChooser.onReceiveValue(results);pendingFileChooser=null;
    }

    @Override protected void onDestroy(){if(textToSpeech!=null){textToSpeech.stop();textToSpeech.shutdown();textToSpeech=null;}if(webView!=null){webView.destroy();webView=null;}super.onDestroy();}

    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack()){webView.goBack();return;}
        new AlertDialog.Builder(this).setTitle("Close Omegaplus Auto Prediction AI?").setMessage("Do you want to exit the app?").setNegativeButton("Stay",(dialog,which)->dialog.dismiss()).setPositiveButton("Exit",(dialog,which)->finish()).show();}
}