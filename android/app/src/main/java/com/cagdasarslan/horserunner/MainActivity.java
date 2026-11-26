package com.cagdasarslan.horserunner;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Oyun tam ekran (immersive) çalışır: durum çubuğu ve gezinme çubuğu gizlenir.
 * Oyuncu kenardan kaydırınca çubuklar geçici görünür, sonra kendiliğinden
 * tekrar gizlenir (STICKY davranışı) — böylece koşu sırasında yanlışlıkla
 * bildirim paneli açılmaz.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // WebView'ın çubuk alanlarının altına kadar uzanmasına izin ver
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemBars();
        watchCutout();
    }

    // Çentik (display cutout) payı. Tam ekranda içerik çentiğin altına uzanır;
    // bazı Android WebView sürümleri env(safe-area-inset-*) değerini 0 verir.
    // Bu yüzden gerçek payı yerel olarak ölçüp CSS değişkenlerine yazıyoruz
    // (--cutout-top/bottom/left/right); arayüz bunları safeArea.js'te kullanır.
    private final int[] cutout = new int[4];
    private final Handler main = new Handler(Looper.getMainLooper());

    private void watchCutout() {
        View decor = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
            Insets c = insets.getInsetsIgnoringVisibility(
                    WindowInsetsCompat.Type.displayCutout());
            float d = getResources().getDisplayMetrics().density;
            cutout[0] = Math.round(c.top / d);
            cutout[1] = Math.round(c.bottom / d);
            cutout[2] = Math.round(c.left / d);
            cutout[3] = Math.round(c.right / d);
            pushCutout();
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
        // Sayfa yüklenince de tekrar yaz (ilk ölçüm sayfadan önce gelebilir)
        main.postDelayed(this::pushCutout, 1200);
        main.postDelayed(this::pushCutout, 4000);
    }

    private void pushCutout() {
        if (getBridge() == null) return;
        WebView wv = getBridge().getWebView();
        if (wv == null) return;
        String js = "(function(){var s=document.documentElement.style;"
                + "s.setProperty('--cutout-top','" + cutout[0] + "px');"
                + "s.setProperty('--cutout-bottom','" + cutout[1] + "px');"
                + "s.setProperty('--cutout-left','" + cutout[2] + "px');"
                + "s.setProperty('--cutout-right','" + cutout[3] + "px');})()";
        wv.post(() -> wv.evaluateJavascript(js, null));
    }

    @Override
    public void onResume() {
        super.onResume();
        main.postDelayed(this::pushCutout, 300);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Reklam/satın alma ekranından dönüşte tam ekranı geri al
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        View decor = getWindow().getDecorView();
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), decor);
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
