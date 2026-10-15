package com.omegaplus.proai;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.content.Intent;
import android.net.Uri;
import android.content.pm.PackageInfo;

public class MainActivity extends Activity {
    private WebView webView;

    public class AppBridge {
        @JavascriptInterface public String getVersionName() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                return info.versionName != null ? info.versionName : "";
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface public int getVersionCode() {
            try {
                PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    return (int) info.getLongVersionCode();
                }
                return info.versionCode;
            } catch (Exception e) {
                return 0;
            }
        }

        @JavascriptInterface public void openPlayStore() {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id="+getPackageName())));
            } catch (Exception e) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id="+getPackageName())));
            }
        }
    }

    private static final String APP_URL = "https://omegaplus-auto-prediction-ai.onrender.com/";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
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
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        new AlertDialog.Builder(this)
            .setTitle("Close Omegaplus Auto Prediction AI?")
            .setMessage("Do you want to exit the app?")
            .setNegativeButton("Stay", (dialog, which) -> dialog.dismiss())
            .setPositiveButton("Exit", (dialog, which) -> finish())
            .show();
    }
}