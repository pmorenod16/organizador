package io.github.pmorenod16.organizador;

import android.content.Intent;
import android.provider.AlarmClock;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Pone una alarma de verdad en la app Reloj de Android (sin abrirla). */
@CapacitorPlugin(name = "Alarma")
public class AlarmaPlugin extends Plugin {
    @PluginMethod
    public void poner(PluginCall call) {
        Integer hora = call.getInt("hora");
        Integer minuto = call.getInt("minuto");
        if (hora == null || minuto == null) { call.reject("Faltan la hora o el minuto"); return; }
        Intent i = new Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hora)
            .putExtra(AlarmClock.EXTRA_MINUTES, minuto)
            .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("mensaje", "Organizador"))
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(i);
            JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
        } catch (Exception e) {
            call.reject("No hay app de reloj que acepte alarmas", e);
        }
    }
}
