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
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget «Hoy» de la pantalla de inicio */
public class TascaWidget extends AppWidgetProvider {
    static final String PREFS = "tasca_widget";
    static final String CLIC = "io.github.pmorenod16.tasca.WIDGET_CLIC";

    static int id(Context c, String tipo, String nombre) { return c.getResources().getIdentifier(nombre, tipo, c.getPackageName()); }
    static String hoy() { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date()); }

    /** Lista del día de hoy guardada por la app (null si la app aún no la ha mandado) */
    static JSONArray deHoy(Context c) {
        try {
            JSONObject o = new JSONObject(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("datos", "{}"));
            JSONObject dias = o.optJSONObject("dias");
            return dias == null ? null : dias.optJSONArray(hoy());
        } catch (Exception e) { return null; }
    }

    static void refrescar(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, TascaWidget.class));
        for (int i : ids) pintar(c, m, i);
        m.notifyAppWidgetViewDataChanged(ids, id(c, "id", "w_lista"));
        TascaWidgetMini.refrescar(c);
        TascaWidgetEstudio.refrescar(c);
    }

    private static PendingIntent abrirApp(Context c, String accion, int codigo) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (accion != null) i.putExtra("tasca_accion", accion);
        return PendingIntent.getActivity(c, codigo, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void pintar(Context c, AppWidgetManager m, int wid) {
        RemoteViews v = new RemoteViews(c.getPackageName(), id(c, "layout", "widget_hoy"));
        String fecha = new SimpleDateFormat("EEE d MMM", new Locale("es", "ES")).format(new Date()).replace(".", "");
        v.setTextViewText(id(c, "id", "w_fecha"), fecha);

        JSONArray l = deHoy(c);
        Set<String> hechas = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet("hechas", new HashSet<>());
        int tareas = 0, eventos = 0;
        if (l != null) for (int k = 0; k < l.length(); k++) {
            JSONObject x = l.optJSONObject(k);
            if (x == null) continue;
            if ("t".equals(x.optString("tipo"))) { if (!hechas.contains(x.optString("id"))) tareas++; } else eventos++;
        }
        String resumen = l == null ? "Abre Tasca una vez para cargar el día"
            : (tareas == 0 && eventos == 0) ? "Nada pendiente 🎉"
            : (tareas == 1 ? "1 tarea" : tareas + " tareas") + (eventos > 0 ? " · " + (eventos == 1 ? "1 evento" : eventos + " eventos") : "");
        v.setTextViewText(id(c, "id", "w_resumen"), resumen);
        v.setTextViewText(id(c, "id", "w_vacio"), l == null ? "Abre Tasca para cargar tu día" : "Nada para hoy 🎉");

        Intent serv = new Intent(c, WidgetServicio.class);
        serv.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid);
        serv.setData(Uri.parse(serv.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(id(c, "id", "w_lista"), serv);
        v.setEmptyView(id(c, "id", "w_lista"), id(c, "id", "w_vacio"));

        Intent clic = new Intent(c, TascaWidget.class);
        clic.setAction(CLIC);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        v.setPendingIntentTemplate(id(c, "id", "w_lista"), PendingIntent.getBroadcast(c, 7, clic, flags));

        v.setOnClickPendingIntent(id(c, "id", "w_cab"), abrirApp(c, null, 1));
        v.setOnClickPendingIntent(id(c, "id", "w_vacio"), abrirApp(c, null, 1));
        v.setOnClickPendingIntent(id(c, "id", "w_mas"), abrirApp(c, "anadir", 2));
        m.updateAppWidget(wid, v);
    }

    /** A medianoche cambia de día aunque no abras la app */
    private static void programarMedianoche(Context c) {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, 1);
        cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 1); cal.set(Calendar.SECOND, 0);
        Intent i = new Intent(c, TascaWidget.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, TascaWidget.class)));
        PendingIntent pi = PendingIntent.getBroadcast(c, 8, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.set(AlarmManager.RTC, cal.getTimeInMillis(), pi);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int i : ids) pintar(c, m, i);
        m.notifyAppWidgetViewDataChanged(ids, id(c, "id", "w_lista"));
        programarMedianoche(c);
        TascaWidgetMini.refrescar(c);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        super.onReceive(c, i);
        if (!CLIC.equals(i.getAction())) return;
        String hecha = i.getStringExtra("hecha");
        if (hecha != null && !hecha.isEmpty()) {
            SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            Set<String> h = new HashSet<>(p.getStringSet("hechas", new HashSet<>()));
            Set<String> cola = new HashSet<>(p.getStringSet("cola", new HashSet<>()));
            if (h.contains(hecha)) { h.remove(hecha); cola.remove(hecha); } else { h.add(hecha); cola.add(hecha); }
            p.edit().putStringSet("hechas", h).putStringSet("cola", cola).apply();
            refrescar(c);
            return;
        }
        try { abrirApp(c, null, 1).send(); } catch (Exception ignored) {}
    }
}
