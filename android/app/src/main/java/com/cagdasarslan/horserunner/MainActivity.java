package com.cagdasarslan.horserunner;

import android.os.Bundle;
import android.view.View;

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
