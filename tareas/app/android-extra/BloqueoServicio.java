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
        crearCapa();
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
            if (ahora >= hasta) { borrarCapa(); stopSelf(); return; }
            String app = appDelante();
            if (app != null) { delante = app; ultimaVista = app; }
            Set<String> apps = p.getStringSet("apps", Collections.<String>emptySet());
            boolean tapar = apps != null && apps.contains(delante) && !delante.equals(getPackageName());
            if (tapar) {
                mostrarCapa(delante, hasta);
                // además abre la pantalla de bloqueo como actividad: en algunos móviles (Xiaomi) la capa no
                // se ve si Tasca está en segundo plano; mientras la app bloqueada siga delante, se insiste
                if (ahora - ultimoLanzamiento > 1500) { ultimoLanzamiento = ahora; lanzarPantalla(delante); }
            } else quitarCapa();
            h.postDelayed(this, 500);
        }
    };

    private long ultimoLanzamiento = 0, consultado = 0;

    private void lanzarPantalla(String app) {
        try {
            Intent i = new Intent(this, BloqueoActivity.class);
            i.putExtra("app", app);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
            startActivity(i);
        } catch (Exception ignored) {}
    }

    /** La última app que ha pasado a primer plano (null si no ha cambiado nada en los últimos segundos) */
    private String appDelante() {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            long ahora = System.currentTimeMillis();
            long desde = consultado == 0 ? ahora - 60000 : Math.min(consultado - 2000, ahora - 10000);
            consultado = ahora;
            UsageEvents ev = usm.queryEvents(desde, ahora + 1000);
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

    // La capa se crea UNA vez, al arrancar el bloqueo (Tasca está delante, así que Android y Xiaomi la dejan
    // poner) y se queda como un punto invisible de 1×1. Cuando abres una app bloqueada solo se agranda a
    // pantalla completa: no es una ventana nueva, así que no la frena el permiso de ventanas en segundo plano.
    private String capaDe = "";
    private boolean grande = false;
    private TextView subCapa, finCapa;
    private Chronometer cronoCapa;
    private WindowManager.LayoutParams lpCapa;

    private void crearCapa() {
        if (capa != null) return;
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) return;
        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        LinearLayout raiz = new LinearLayout(this) {
            @Override
            public boolean dispatchKeyEvent(KeyEvent e) {
                if (grande && e.getKeyCode() == KeyEvent.KEYCODE_BACK) { if (e.getAction() == KeyEvent.ACTION_UP) irAlInicio(); return true; }
                return super.dispatchKeyEvent(e);
            }
        };
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setGravity(Gravity.CENTER);
        raiz.setBackgroundColor(Color.parseColor("#F3F3F1"));
        raiz.setPadding(dp(32), dp(48), dp(32), dp(48));
        raiz.setFocusableInTouchMode(true);
        raiz.setClickable(true);

        TextView icono = texto("📚", 56, "#1D1E22", false);
        TextView titulo = texto("Ahora toca estudiar", 26, "#1D1E22", true);
        titulo.setPadding(0, dp(12), 0, dp(6));
        subCapa = texto("", 16, "#75777F", false);
        cronoCapa = new Chronometer(this);
        cronoCapa.setTextSize(44);
        cronoCapa.setTextColor(Color.parseColor("#6F61A8"));
        cronoCapa.setGravity(Gravity.CENTER);
        cronoCapa.setTypeface(Typeface.create("sans-serif-light", Typeface.NORMAL));
        if (Build.VERSION.SDK_INT >= 24) cronoCapa.setCountDown(true);
        cronoCapa.setPadding(0, dp(20), 0, dp(2));
        finCapa = texto("", 14, "#75777F", false);
        finCapa.setPadding(0, 0, 0, dp(28));
        Button volver = boton("Volver a Tasca", true);
        volver.setOnClickListener(v -> {
            Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (abrir != null) { abrir.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT); startActivity(abrir); }
            delante = getPackageName();
            quitarCapa();
        });
        Button inicio = boton("Ir a la pantalla de inicio", false);
        inicio.setOnClickListener(v -> irAlInicio());
        raiz.addView(icono); raiz.addView(titulo); raiz.addView(subCapa); raiz.addView(cronoCapa); raiz.addView(finCapa);
        raiz.addView(volver); raiz.addView(inicio);

        int tipo = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        lpCapa = new WindowManager.LayoutParams(1, 1, tipo, flagsPequena(), PixelFormat.TRANSLUCENT);
        lpCapa.gravity = Gravity.TOP | Gravity.START;
        lpCapa.alpha = 0f;
        raiz.setVisibility(View.INVISIBLE);
        try { wm.addView(raiz, lpCapa); capa = raiz; } catch (Exception ex) { capa = null; }
    }

    private int flagsPequena() {
        return WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
    }

    private void mostrarCapa(String app, long hasta) {
        crearCapa();
        if (capa == null) return;
        if (grande && app.equals(capaDe)) return;
        String nombre = app;
        try { nombre = getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(app, 0)).toString(); } catch (PackageManager.NameNotFoundException ignored) {}
        subCapa.setText(nombre + " está bloqueada hasta que termines este bloque.");
        finCapa.setText("Hasta las " + new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(hasta)));
        cronoCapa.setBase(SystemClock.elapsedRealtime() + (hasta - System.currentTimeMillis()));
        cronoCapa.start();
        lpCapa.width = WindowManager.LayoutParams.MATCH_PARENT;
        lpCapa.height = WindowManager.LayoutParams.MATCH_PARENT;
        lpCapa.flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        lpCapa.alpha = 1f;
        capa.setVisibility(View.VISIBLE);
        try { wm.updateViewLayout(capa, lpCapa); grande = true; capaDe = app; capa.requestFocus(); } catch (Exception ex) { /* se reintenta en el siguiente vistazo */ }
    }

    /** La deja otra vez en un punto invisible (sigue puesta para poder agrandarla luego) */
    private void quitarCapa() {
        if (capa == null || !grande) return;
        cronoCapa.stop();
        lpCapa.width = 1; lpCapa.height = 1;
        lpCapa.flags = flagsPequena();
        lpCapa.alpha = 0f;
        capa.setVisibility(View.INVISIBLE);
        try { wm.updateViewLayout(capa, lpCapa); } catch (Exception ignored) {}
        grande = false;
        capaDe = "";
    }

    private void borrarCapa() {
        if (capa != null && wm != null) { try { wm.removeView(capa); } catch (Exception ignored) {} }
        capa = null; grande = false; capaDe = "";
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
        borrarCapa();
        super.onDestroy();
    }
}
