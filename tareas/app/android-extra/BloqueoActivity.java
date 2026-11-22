package io.github.pmorenod16.tasca;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.Chronometer;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Pantalla que tapa una app bloqueada mientras estudias. */
public class BloqueoActivity extends Activity {
    private final Handler h = new Handler(Looper.getMainLooper());
    private String app = "";

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        pintar(getIntent());
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        pintar(i);
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private Button boton(String texto, boolean principal) {
        Button b = new Button(this);
        b.setText(texto);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setTextColor(principal ? Color.WHITE : Color.parseColor("#1D1E22"));
        GradientDrawable fondo = new GradientDrawable();
        fondo.setCornerRadius(dp(28));
        fondo.setColor(principal ? Color.parseColor("#2A2C31") : Color.WHITE);
        if (!principal) fondo.setStroke(dp(1), Color.parseColor("#DDDDD8"));
        b.setBackground(fondo);
        b.setPadding(dp(20), dp(12), dp(20), dp(12));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(10);
        b.setLayoutParams(lp);
        return b;
    }

    private TextView texto(String s, float tam, String color, boolean negrita) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(tam);
        t.setTextColor(Color.parseColor(color));
        t.setGravity(Gravity.CENTER);
        if (negrita) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private void pintar(Intent i) {
        app = i.getStringExtra("app");
        if (app == null) app = "";
        SharedPreferences p = getSharedPreferences(BloqueoServicio.PREFS, MODE_PRIVATE);
        long hasta = p.getLong("hasta", 0L), ahora = System.currentTimeMillis();
        if (ahora >= hasta) { finish(); return; }

        String nombre = app;
        try { nombre = getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(app, 0)).toString(); } catch (PackageManager.NameNotFoundException ignored) {}

        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setGravity(Gravity.CENTER);
        raiz.setBackgroundColor(Color.parseColor("#F3F3F1"));
        raiz.setPadding(dp(32), dp(48), dp(32), dp(48));

        TextView icono = texto("📚", 56, "#1D1E22", false);
        TextView titulo = texto("Ahora toca estudiar", 26, "#1D1E22", true);
        titulo.setPadding(0, dp(12), 0, dp(6));
        TextView sub = texto(nombre + " está bloqueada hasta que termines este bloque.", 16, "#75777F", false);

        Chronometer crono = new Chronometer(this);
        crono.setTextSize(44);
        crono.setTextColor(Color.parseColor("#6F61A8"));
        crono.setGravity(Gravity.CENTER);
        crono.setTypeface(Typeface.create("sans-serif-light", Typeface.NORMAL));
        crono.setBase(SystemClock.elapsedRealtime() + (hasta - ahora));
        if (Build.VERSION.SDK_INT >= 24) crono.setCountDown(true);
        crono.start();
        crono.setPadding(0, dp(20), 0, dp(2));
        TextView fin = texto("Hasta las " + new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(hasta)), 14, "#75777F", false);
        fin.setPadding(0, 0, 0, dp(28));

        Button volver = boton("Volver a Tasca", true);
        volver.setOnClickListener(v -> {
            Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (abrir != null) { abrir.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT); startActivity(abrir); }
            finish();
        });
        Button inicio = boton("Ir a la pantalla de inicio", false);
        inicio.setOnClickListener(v -> irAlInicio());

        raiz.addView(icono); raiz.addView(titulo); raiz.addView(sub); raiz.addView(crono); raiz.addView(fin);
        raiz.addView(volver); raiz.addView(inicio);
        setContentView(raiz);

        // cuando acaba el bloque, la pantalla se quita sola
        h.removeCallbacksAndMessages(null);
        h.postDelayed(this::finish, Math.max(500, hasta - ahora));
    }

    private void irAlInicio() {
        Intent casa = new Intent(Intent.ACTION_MAIN);
        casa.addCategory(Intent.CATEGORY_HOME);
        casa.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(casa);
        finish();
    }

    @Override
    public void onBackPressed() { irAlInicio(); }

    @Override
    protected void onDestroy() { h.removeCallbacksAndMessages(null); super.onDestroy(); }
}
