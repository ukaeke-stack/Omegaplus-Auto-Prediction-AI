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
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;

public class MainActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 4103;
    private static final String CHANNEL_ID = "omega_announcements";
    private static final String APP_URL = "https://omegaplus-auto-prediction-ai.onrender.com/";
    private WebView webView;
    private TextToSpeech textToSpeech;
    private boolean ttsReady = false;

    public class AppBridge {
        @JavascriptInterface public String getVersionName() {
            try { PackageInfo info=getPackageManager().getPackageInfo(getPackageName(),0); return info.versionName!=null?info.versionName:""; }
            catch(Exception e) { return ""; }
        }
        @JavascriptInterface public int getVersionCode() {
            try { PackageInfo info=getPackageManager().getPackageInfo(getPackageName(),0); if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.P)return (int)info.getLongVersionCode(); return info.versionCode; }
            catch(Exception e) { return 0; }
        }
        @JavascriptInterface public void openPlayStore() {
            try { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("market://details?id="+getPackageName()))); }
            catch(Exception e) { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://play.google.com/store/apps/details?id="+getPackageName()))); }
        }
        @JavascriptInterface public void speakText(String text) {
            final String value = text == null ? "" : text.trim();
            if (value.isEmpty()) return;
            runOnUiThread(() -> {
                if (textToSpeech == null || !ttsReady) return;
                textToSpeech.setLanguage(Locale.UK);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) textToSpeech.speak(value, TextToSpeech.QUEUE_FLUSH, null, "omega-ai-reply");
                else textToSpeech.speak(value, TextToSpeech.QUEUE_FLUSH, null);
            });
        }
        @JavascriptInterface public void requestNotificationPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
                }
            });
        }
        @JavascriptInterface public void showNotification(String title, String body) {
            runOnUiThread(() -> showNativeNotification(title, body));
        }
    }

    private void showNativeNotification(String title, String body) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if(manager==null)return;
        if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID,"Omegaplus announcements",NotificationManager.IMPORTANCE_DEFAULT));
        Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL_ID):new Notification.Builder(this);
        String safeTitle=title==null||title.trim().isEmpty()?"Omegaplus announcement":title;
        String safeBody=body==null?"":body;
        builder.setSmallIcon(getApplicationInfo().icon).setContentTitle(safeTitle).setContentText(safeBody).setStyle(new Notification.BigTextStyle().bigText(safeBody)).setAutoCancel(true);
        manager.notify((safeTitle+"|"+safeBody).hashCode(),builder.build());
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        textToSpeech = new TextToSpeech(this, status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (ttsReady) textToSpeech.setLanguage(Locale.UK);
        });
        webView = new WebView(this);
        webView.setWebViewClient(new WebViewClient());
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        webView.addJavascriptInterface(new AppBridge(), "AndroidApp");
        webView.loadUrl(APP_URL);
        setContentView(webView);
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) { webView.goBack(); return; }
        new AlertDialog.Builder(this)
            .setTitle("Close Omegaplus Auto Prediction AI?")
            .setMessage("Do you want to exit the app?")
            .setNegativeButton("Cancel", (dialog, which) -> dialog.dismiss())
            .setPositiveButton("Exit", (dialog, which) -> finish())
            .show();
    }

    @Override protected void onDestroy() {
        if (textToSpeech != null) { textToSpeech.stop(); textToSpeech.shutdown(); textToSpeech = null; }
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
