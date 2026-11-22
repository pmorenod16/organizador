package io.github.pmorenod16.tasca;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;

/** Puente entre la app y el widget: la app le pasa la agenda y recoge lo que se ha marcado en el widget */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void guardar(PluginCall call) {
        Context c = getContext();
        c.getSharedPreferences(TascaWidget.PREFS, Context.MODE_PRIVATE).edit()
            .putString("datos", call.getString("datos", "{}"))
            .putStringSet("hechas", new HashSet<>()) // la agenda nueva ya viene sin lo que se marcó
            .apply();
        TascaWidget.refrescar(c);
        call.resolve();
    }

    @PluginMethod
    public void pendientes(PluginCall call) {
        SharedPreferences p = getContext().getSharedPreferences(TascaWidget.PREFS, Context.MODE_PRIVATE);
        Set<String> cola = p.getStringSet("cola", new HashSet<>());
        JSObject r = new JSObject();
        JSArray a = new JSArray();
        for (String id : cola) a.put(id);
        r.put("hechas", a);
        r.put("accion", p.getString("accion", ""));
        p.edit().putStringSet("cola", new HashSet<>()).remove("accion").apply();
        call.resolve(r);
    }
}
