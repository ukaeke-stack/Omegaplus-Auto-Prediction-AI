package com.omegaplus.proai;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST=4101,AUDIO_PERMISSION_REQUEST=4102;
    private static final String CHANNEL_ID="omega_announcements";
    private static final String APP_URL="https://omegaplus-auto-prediction-ai.onrender.com/";
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileChooser;
    private PermissionRequest pendingWebPermission;

    public class AppBridge {
        @JavascriptInterface public String getVersionName(){try{PackageInfo i=getPackageManager().getPackageInfo(getPackageName(),0);return i.versionName!=null?i.versionName:"";}catch(Exception e){return "";}}
        @JavascriptInterface public int getVersionCode(){try{PackageInfo i=getPackageManager().getPackageInfo(getPackageName(),0);if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P)return (int)i.getLongVersionCode();return i.versionCode;}catch(Exception e){return 0;}}
        @JavascriptInterface public void openPlayStore(){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id="+getPackageName())));}catch(Exception e){startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/apps/details?id="+getPackageName())));}}
        @JavascriptInterface public void requestNotificationPermission(){runOnUiThread(()->{if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},4103);});}
        @JavascriptInterface public void showNotification(String title,String body){runOnUiThread(()->showNativeNotification(title,body));}
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
        super.onCreate(state);webView=new WebView(this);webView.setWebViewClient(new WebViewClient());
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
        WebSettings s=webView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setAllowFileAccess(false);s.setSupportZoom(false);
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

    @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack()){webView.goBack();return;}
        new AlertDialog.Builder(this).setTitle("Close Omegaplus Auto Prediction AI?").setMessage("Do you want to exit the app?").setNegativeButton("Stay",(dialog,which)->dialog.dismiss()).setPositiveButton("Exit",(dialog,which)->finish()).show();}
}