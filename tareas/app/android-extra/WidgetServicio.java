package io.github.pmorenod16.tasca;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Filas del widget: eventos y tareas de hoy por hora */
public class WidgetServicio extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) { return new Filas(getApplicationContext(), intent.getBooleanExtra("estudio", false)); }

    static class Filas implements RemoteViewsFactory {
        private final Context c;
        private final List<JSONObject> items = new ArrayList<>();
        private Set<String> hechas = new HashSet<>();
        private final boolean estudio;
        Filas(Context c, boolean estudio) { this.c = c; this.estudio = estudio; }

        @Override public void onCreate() {}
        @Override public void onDestroy() {}
        @Override public int getCount() { return items.size(); }
        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int i) { return i; }
        @Override public boolean hasStableIds() { return false; }

        @Override
        public void onDataSetChanged() {
            items.clear();
            hechas = new HashSet<>(c.getSharedPreferences(TascaWidget.PREFS, Context.MODE_PRIVATE).getStringSet("hechas", new HashSet<>()));
            JSONArray l = TascaWidget.deHoy(c);
            if (l != null) for (int k = 0; k < l.length(); k++) { JSONObject x = l.optJSONObject(k); if (x == null) continue;
                // en el widget de Estudio, solo las tareas pendientes (primero las que tienen sesión de estudio)
                if (estudio && (!"t".equals(x.optString("tipo")) || hechas.contains(x.optString("id")))) continue;
                items.add(x); }
            if (estudio) { List<JSONObject> ses = new ArrayList<>(), resto = new ArrayList<>(); for (JSONObject x : items) (x.optBoolean("estudio") ? ses : resto).add(x); items.clear(); items.addAll(ses); items.addAll(resto); }
        }

        private int color(String s, int defecto) { try { return Color.parseColor(s); } catch (Exception e) { return defecto; } }

        @Override
        public RemoteViews getViewAt(int pos) {
            RemoteViews v = new RemoteViews(c.getPackageName(), TascaWidget.id(c, "layout", "widget_fila"));
            if (pos >= items.size()) return v;
            JSONObject x = items.get(pos);
            boolean tarea = "t".equals(x.optString("tipo"));
            String id = x.optString("id");
            boolean hecha = tarea && hechas.contains(id);
            int col = color(x.optString("color"), Color.GRAY);

            String titulo = x.optString("titulo");
            if (hecha) { SpannableString s = new SpannableString(titulo); s.setSpan(new StrikethroughSpan(), 0, titulo.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE); v.setTextViewText(TascaWidget.id(c, "id", "f_titulo"), s); }
            else v.setTextViewText(TascaWidget.id(c, "id", "f_titulo"), titulo);
            String sub = x.optString("sub");
            v.setTextViewText(TascaWidget.id(c, "id", "f_sub"), sub);
            v.setViewVisibility(TascaWidget.id(c, "id", "f_sub"), sub.isEmpty() ? View.GONE : View.VISIBLE);
            v.setTextColor(TascaWidget.id(c, "id", "f_sub"), x.optBoolean("vencida") ? Color.parseColor("#C8553D") : c.getResources().getColor(TascaWidget.id(c, "color", "widget_suave")));
            v.setTextColor(TascaWidget.id(c, "id", "f_titulo"), c.getResources().getColor(TascaWidget.id(c, "color", hecha ? "widget_suave" : "widget_texto")));

            int check = TascaWidget.id(c, "id", "f_check"), barra = TascaWidget.id(c, "id", "f_barra");
            v.setViewVisibility(check, tarea ? View.VISIBLE : View.GONE);
            v.setViewVisibility(barra, tarea ? View.GONE : View.VISIBLE);
            if (tarea) {
                v.setImageViewResource(check, TascaWidget.id(c, "drawable", hecha ? "widget_hecho" : "widget_circulo"));
                int prio = x.optInt("prio", 4);
                int tinte = prio == 1 ? Color.parseColor("#D1453B") : prio == 2 ? Color.parseColor("#EB8909") : prio == 3 ? Color.parseColor("#246FE0") : col;
                v.setInt(check, "setColorFilter", tinte);
                Intent marcar = new Intent(); marcar.putExtra("hecha", id);
                v.setOnClickFillInIntent(check, marcar);
            } else v.setInt(barra, "setColorFilter", col);
            if (estudio) {
                v.setViewVisibility(check, View.GONE);
                v.setViewVisibility(barra, View.VISIBLE);
                v.setInt(barra, "setColorFilter", col);
                if (x.optBoolean("estudio")) v.setTextViewText(TascaWidget.id(c, "id", "f_titulo"), "📚 " + titulo);
                v.setOnClickFillInIntent(TascaWidget.id(c, "id", "f_texto"), new Intent().putExtra("tasca_accion", "estudiar:" + id));
                v.setOnClickFillInIntent(barra, new Intent().putExtra("tasca_accion", "estudiar:" + id));
            } else v.setOnClickFillInIntent(TascaWidget.id(c, "id", "f_texto"), new Intent().putExtra("abrir", true));
            return v;
        }
    }
}
