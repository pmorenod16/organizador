package io.github.pmorenod16.tasca;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget pequeño (2×2): cuántas cosas quedan hoy y las 3 siguientes */
public class TascaWidgetMini extends AppWidgetProvider {
    static void refrescar(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int i : m.getAppWidgetIds(new ComponentName(c, TascaWidgetMini.class))) pintar(c, m, i);
    }

    static void pintar(Context c, AppWidgetManager m, int wid) {
        RemoteViews v = new RemoteViews(c.getPackageName(), TascaWidget.id(c, "layout", "widget_mini"));
        JSONArray l = TascaWidget.deHoy(c);
        Set<String> hechas = c.getSharedPreferences(TascaWidget.PREFS, Context.MODE_PRIVATE).getStringSet("hechas", new HashSet<>());
        String ahora = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        int quedan = 0, puestas = 0;
        int[] filas = { TascaWidget.id(c, "id", "m_1"), TascaWidget.id(c, "id", "m_2"), TascaWidget.id(c, "id", "m_3") };
        if (l != null) for (int k = 0; k < l.length(); k++) {
            JSONObject x = l.optJSONObject(k);
            if (x == null) continue;
            boolean tarea = "t".equals(x.optString("tipo"));
            if (tarea && hechas.contains(x.optString("id"))) continue;
            String fin = x.optString("fin");
            if (!tarea && !fin.isEmpty() && fin.compareTo(ahora) <= 0) continue; // evento que ya ha pasado
            if (tarea) quedan++;
            if (puestas < 3) {
                String ini = x.optString("ini");
                String texto = (ini.isEmpty() ? "" : ini + "  ") + x.optString("titulo");
                v.setTextViewText(filas[puestas], (tarea ? "○ " : "▍") + texto);
                int col; try { col = Color.parseColor(x.optString("color")); } catch (Exception e) { col = Color.GRAY; }
                v.setTextColor(filas[puestas], x.optBoolean("vencida") ? Color.parseColor("#C8553D") : c.getResources().getColor(TascaWidget.id(c, "color", "widget_texto")));
                v.setViewVisibility(filas[puestas], View.VISIBLE);
                puestas++;
            }
        }
        for (int k = puestas; k < 3; k++) v.setViewVisibility(filas[k], View.GONE);
        v.setTextViewText(TascaWidget.id(c, "id", "m_num"), l == null ? "–" : String.valueOf(quedan));
        v.setTextViewText(TascaWidget.id(c, "id", "m_txt"), l == null ? "Abre Tasca" : quedan == 1 ? "tarea hoy" : "tareas hoy");
        v.setViewVisibility(TascaWidget.id(c, "id", "m_vacio"), l != null && puestas == 0 ? View.VISIBLE : View.GONE);

        Intent abrir = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(TascaWidget.id(c, "id", "m_raiz"), PendingIntent.getActivity(c, 11, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        Intent mas = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("tasca_accion", "anadir");
        v.setOnClickPendingIntent(TascaWidget.id(c, "id", "m_mas"), PendingIntent.getActivity(c, 12, mas, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        m.updateAppWidget(wid, v);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int i : ids) pintar(c, m, i); }
}
