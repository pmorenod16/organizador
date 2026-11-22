package io.github.pmorenod16.tasca;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.Chronometer;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;
import java.util.Set;

/**
 * Bloqueo de distracciones sin servicio de accesibilidad: mientras estudias, mira cada poco qué app está
 * delante (permiso «Acceso al uso») y, si es una de la lista, la tapa con una capa de Tasca («Mostrar sobre
 * otras apps»). Solo funciona mientras dura el bloque; luego se para solo.
 */
public class BloqueoServicio extends Service {
    static final String PREFS = "tasca_bloqueo";
    private static final String CANAL = "bloqueo";
    private static final int NOTIF = 4100;

    private final Handler h = new Handler(Looper.getMainLooper());
    private WindowManager wm;
    private View capa;
    private String delante = "";
    static volatile boolean enMarcha = false;
    static volatile String ultimaVista = "";

    public static void arrancar(Context c) {
        Intent i = new Intent(c, BloqueoServicio.class);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    public static void parar(Context c) { c.stopService(new Intent(c, BloqueoServicio.class)); }

    @Override
    public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent i, int flags, int id) {
        primerPlano();
        enMarcha = true;
        h.removeCallbacks(tic);
        h.post(tic);
        return START_STICKY;
    }

    private void primerPlano() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel c = new NotificationChannel(CANAL, "Bloqueo de distracciones", NotificationManager.IMPORTANCE_MIN);
            c.setShowBadge(false);
            nm.createNotificationChannel(c);
        }
        int icono = getResources().getIdentifier("ic_stat_tasca", "drawable", getPackageName());
        if (icono == 0) icono = getApplicationInfo().icon;
        Notification n = new NotificationCompat.Builder(this, CANAL)
            .setSmallIcon(icono)
            .setContentTitle("Bloqueo de distracciones activo")
            .setContentText("Las apps que distraen están tapadas hasta que acabe el bloque.")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setSilent(true)
            .setOngoing(true)
            .build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIF, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTIF, n);
    }

    private final Runnable tic = new Runnable() {
        @Override
        public void run() {
            SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
            long ahora = System.currentTimeMillis(), hasta = p.getLong("hasta", 0L);
            if (ahora >= hasta) { quitarCapa(); stopSelf(); return; }
            String app = appDelante();
            if (app != null) { delante = app; ultimaVista = app; }
            Set<String> apps = p.getStringSet("apps", Collections.<String>emptySet());
            boolean tapar = apps != null && apps.contains(delante) && !delante.equals(getPackageName());
            if (tapar) mostrarCapa(delante, hasta); else quitarCapa();
            h.postDelayed(this, 700);
        }
    };

    /** La última app que ha pasado a primer plano (null si no ha cambiado nada en los últimos segundos) */
    private String appDelante() {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            long ahora = System.currentTimeMillis();
            UsageEvents ev = usm.queryEvents(ahora - 15000, ahora);
            UsageEvents.Event e = new UsageEvents.Event();
            String ultima = null;
            while (ev.hasNextEvent()) {
                ev.getNextEvent(e);
                if (e.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND) ultima = e.getPackageName();
            }
            return ultima;
        } catch (Exception ex) { return null; }
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private TextView texto(String s, float tam, String color, boolean negrita) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(tam);
        t.setTextColor(Color.parseColor(color));
        t.setGravity(Gravity.CENTER);
        if (negrita) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

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
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52));
        lp.topMargin = dp(10);
        b.setLayoutParams(lp);
        return b;
    }

    private String capaDe = "";

    private void mostrarCapa(String app, long hasta) {
        if (capa != null && app.equals(capaDe)) return;
        quitarCapa();
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) return;
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        String nombre = app;
        try { nombre = getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(app, 0)).toString(); } catch (PackageManager.NameNotFoundException ignored) {}

        LinearLayout raiz = new LinearLayout(this) {
            @Override
            public boolean dispatchKeyEvent(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.KEYCODE_BACK && e.getAction() == KeyEvent.ACTION_UP) { irAlInicio(); return true; }
                return super.dispatchKeyEvent(e);
            }
        };
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setGravity(Gravity.CENTER);
        raiz.setBackgroundColor(Color.parseColor("#F3F3F1"));
        raiz.setPadding(dp(32), dp(48), dp(32), dp(48));
        raiz.setFocusableInTouchMode(true);

        TextView icono = texto("📚", 56, "#1D1E22", false);
        TextView titulo = texto("Ahora toca estudiar", 26, "#1D1E22", true);
        titulo.setPadding(0, dp(12), 0, dp(6));
        TextView sub = texto(nombre + " está bloqueada hasta que termines este bloque.", 16, "#75777F", false);
        Chronometer crono = new Chronometer(this);
        crono.setTextSize(44);
        crono.setTextColor(Color.parseColor("#6F61A8"));
        crono.setGravity(Gravity.CENTER);
        crono.setTypeface(Typeface.create("sans-serif-light", Typeface.NORMAL));
        crono.setBase(SystemClock.elapsedRealtime() + (hasta - System.currentTimeMillis()));
        if (Build.VERSION.SDK_INT >= 24) crono.setCountDown(true);
        crono.start();
        crono.setPadding(0, dp(20), 0, dp(2));
        TextView fin = texto("Hasta las " + new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(hasta)), 14, "#75777F", false);
        fin.setPadding(0, 0, 0, dp(28));
        Button volver = boton("Volver a Tasca", true);
        volver.setOnClickListener(v -> {
            Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (abrir != null) { abrir.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT); startActivity(abrir); }
            delante = getPackageName();
            quitarCapa();
        });
        Button inicio = boton("Ir a la pantalla de inicio", false);
        inicio.setOnClickListener(v -> irAlInicio());
        raiz.addView(icono); raiz.addView(titulo); raiz.addView(sub); raiz.addView(crono); raiz.addView(fin);
        raiz.addView(volver); raiz.addView(inicio);

        int tipo = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT, tipo,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.OPAQUE);
        lp.gravity = Gravity.CENTER;
        try { wm.addView(raiz, lp); capa = raiz; capaDe = app; raiz.requestFocus(); } catch (Exception ex) { capa = null; }
    }

    private void quitarCapa() {
        if (capa != null && wm != null) { try { wm.removeView(capa); } catch (Exception ignored) {} }
        capa = null;
        capaDe = "";
    }

    private void irAlInicio() {
        Intent casa = new Intent(Intent.ACTION_MAIN);
        casa.addCategory(Intent.CATEGORY_HOME);
        casa.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(casa);
        delante = "";
        quitarCapa();
    }

    @Override
    public void onDestroy() {
        enMarcha = false;
        h.removeCallbacks(tic);
        quitarCapa();
        super.onDestroy();
    }
}
