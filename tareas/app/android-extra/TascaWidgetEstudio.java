package io.github.pmorenod16.tasca;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** Widget grande de Estudio: el reloj, los métodos para empezar y las tareas de hoy para estudiar */
public class TascaWidgetEstudio extends AppWidgetProvider {
    static final String[][] METODOS = { { "pomodoro", "e_m_pomodoro" }, { "52-17", "e_m_52" }, { "90-20", "e_m_90" }, { "flow", "e_m_flow" }, { "crono", "e_m_crono" }, { "cuenta", "e_m_cuenta" } };

    private static int id(Context c, String n) { return TascaWidget.id(c, "id", n); }

    static void refrescar(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, TascaWidgetEstudio.class));
        for (int i : ids) pintar(c, m, i);
        m.notifyAppWidgetViewDataChanged(ids, id(c, "e_lista"));
    }

    /** Abre Tasca y le dice qué hacer (lo hace la app, que es la que lleva el reloj) */
    static PendingIntent accion(Context c, String que, int codigo) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (que != null) i.putExtra("tasca_accion", que);
        return PendingIntent.getActivity(c, codigo, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void pintar(Context c, AppWidgetManager m, int wid) {
        RemoteViews v = new RemoteViews(c.getPackageName(), TascaWidget.id(c, "layout", "widget_estudio"));
        SharedPreferences p = c.getSharedPreferences(TascaWidget.PREFS, Context.MODE_PRIVATE);
        JSONObject e;
        try { e = new JSONObject(p.getString("estudio", "{}")); } catch (Exception x) { e = new JSONObject(); }
        String estado = e.optString("estado", "parado");
        long ahora = System.currentTimeMillis(), base = e.optLong("base", ahora), restante = e.optLong("restante", 0);
        boolean atras = e.optBoolean("cuentaAtras", true);
        boolean terminado = "corriendo".equals(estado) && atras && base <= ahora;

        boolean enMarcha = !"parado".equals(estado) && !terminado;
        v.setViewVisibility(id(c, "e_marcha"), enMarcha ? View.VISIBLE : View.GONE);
        v.setViewVisibility(id(c, "e_parado"), enMarcha ? View.GONE : View.VISIBLE);
        v.setTextViewText(id(c, "e_estado"), terminado ? "Bloque terminado" : "corriendo".equals(estado) ? "En marcha" : "pausa".equals(estado) ? "En pausa" : "");
        if (enMarcha) {
            long ar = SystemClock.elapsedRealtime();
            boolean pausa = "pausa".equals(estado);
            long baseCrono = pausa ? (atras ? ar + restante : ar - restante) : ar + (base - ahora);
            v.setChronometer(id(c, "e_reloj"), baseCrono, null, !pausa);
            if (Build.VERSION.SDK_INT >= 24) v.setChronometerCountDown(id(c, "e_reloj"), atras);
            v.setTextViewText(id(c, "e_titulo"), e.optString("titulo"));
            v.setTextViewText(id(c, "e_texto"), e.optString("texto"));
            v.setTextViewText(id(c, "e_pausa"), pausa ? "Seguir" : "Pausa");
            v.setOnClickPendingIntent(id(c, "e_pausa"), accion(c, pausa ? "reanudar" : "pausar", 21));
            v.setOnClickPendingIntent(id(c, "e_parar"), accion(c, "parar", 22));
            v.setOnClickPendingIntent(id(c, "e_reloj"), accion(c, "ver-estudio", 23));
        } else {
            v.setTextViewText(id(c, "e_ayuda"), terminado ? "Se acabó el bloque. Elige cómo seguir:" : "Empieza a estudiar sin tarea, o toca una tarea de abajo:");
            int k = 30;
            for (String[] mm : METODOS) v.setOnClickPendingIntent(id(c, mm[1]), accion(c, "metodo:" + mm[0], k++));
        }
        v.setOnClickPendingIntent(id(c, "e_cab"), accion(c, "ver-estudio", 23));

        Intent serv = new Intent(c, WidgetServicio.class);
        serv.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
        serv.putExtra("estudio", true);
        serv.setData(Uri.parse(serv.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(id(c, "e_lista"), serv);
        v.setEmptyView(id(c, "e_lista"), id(c, "e_vacio"));
        Intent plantilla = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        v.setPendingIntentTemplate(id(c, "e_lista"), PendingIntent.getActivity(c, 40, plantilla, flags));
        m.updateAppWidget(wid, v);
    }

    /** Guarda el estado del reloj y, si cuenta hacia atrás, avisa al widget cuando termine */
    static void guardarEstado(Context c, String json, long fin) {
        c.getSharedPreferences(TascaWidget.PREFS, Context.MODE_PRIVATE).edit().putString("estudio", json).apply();
        Intent i = new Intent(c, TascaWidgetEstudio.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, TascaWidgetEstudio.class)));
        PendingIntent pi = PendingIntent.getBroadcast(c, 9, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) { am.cancel(pi); if (fin > System.currentTimeMillis()) am.set(AlarmManager.RTC, fin + 1000, pi); }
        refrescar(c);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int i : ids) pintar(c, m, i);
        m.notifyAppWidgetViewDataChanged(ids, id(c, "e_lista"));
    }
}
