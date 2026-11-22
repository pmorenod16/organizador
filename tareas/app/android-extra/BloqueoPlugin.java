package io.github.pmorenod16.tasca;

import android.app.AppOpsManager;
import android.os.Process;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Puente con el bloqueo de distracciones: permiso, lista de apps y qué bloquear hasta cuándo. */
@CapacitorPlugin(name = "Bloqueo")
public class BloqueoPlugin extends Plugin {

    /** Permiso «Acceso al uso»: para saber qué app está delante */
    private boolean accesoUso() {
        Context ctx = getContext();
        AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        int modo = Build.VERSION.SDK_INT >= 29
            ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName())
            : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        return modo == AppOpsManager.MODE_ALLOWED;
    }

    /** Xiaomi: «Mostrar ventanas emergentes mientras se ejecuta en segundo plano» (op 10021). null si no es Xiaomi o no se sabe */
    private Boolean fondoXiaomi() {
        if (!"xiaomi".equalsIgnoreCase(Build.MANUFACTURER)) return null;
        try {
            AppOpsManager ops = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
            java.lang.reflect.Method m = AppOpsManager.class.getMethod("checkOpNoThrow", int.class, int.class, String.class);
            int modo = (Integer) m.invoke(ops, 10021, Process.myUid(), getContext().getPackageName());
            return modo == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) { return null; }
    }

    /** Permiso «Mostrar sobre otras apps»: para tapar la app bloqueada */
    private boolean superponer() { return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext()); }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("uso", accesoUso());
        r.put("servicio", BloqueoServicio.enMarcha);
        r.put("fondoXiaomi", fondoXiaomi());
        r.put("ultimaApp", BloqueoServicio.ultimaVista);
        r.put("hasta", getContext().getSharedPreferences(BloqueoServicio.PREFS, Context.MODE_PRIVATE).getLong("hasta", 0L));
        r.put("superponer", superponer());
        r.put("activo", accesoUso() && superponer() && !Boolean.FALSE.equals(fondoXiaomi()));
        r.put("fabricante", Build.MANUFACTURER);
        r.put("android", Build.VERSION.SDK_INT);
        SharedPreferences p = getContext().getSharedPreferences(BloqueoServicio.PREFS, Context.MODE_PRIVATE);
        r.put("hasta", p.getLong("hasta", 0L));
        call.resolve(r);
    }

    @PluginMethod
    public void abrirUso(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); } catch (Exception e) { abrirInfoApp(call); return; }
        call.resolve();
    }

    @PluginMethod
    public void abrirSuperponer(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); } catch (Exception e) { abrirInfoApp(call); return; }
        call.resolve();
    }

    /** En Xiaomi: la pantalla de «Otros permisos» de Tasca */
    @PluginMethod
    public void abrirPermisosXiaomi(PluginCall call) {
        Intent i = new Intent("miui.intent.action.APP_PERM_EDITOR");
        i.putExtra("extra_pkgname", getContext().getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); } catch (Exception e) { abrirInfoApp(call); return; }
        call.resolve();
    }

    @PluginMethod
    public void abrirInfoApp(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void apps(PluginCall call) {
        new Thread(() -> {
            PackageManager pm = getContext().getPackageManager();
            Intent lanzador = new Intent(Intent.ACTION_MAIN);
            lanzador.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> lista = pm.queryIntentActivities(lanzador, 0);
            Set<String> vistos = new HashSet<>();
            JSArray out = new JSArray();
            for (ResolveInfo ri : lista) {
                String pkg = ri.activityInfo.packageName;
                if (pkg.equals(getContext().getPackageName()) || !vistos.add(pkg)) continue;
                try {
                    ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
                    JSObject o = new JSObject();
                    o.put("app", pkg);
                    o.put("nombre", pm.getApplicationLabel(ai).toString());
                    boolean juego = (Build.VERSION.SDK_INT >= 26 && ai.category == ApplicationInfo.CATEGORY_GAME) || (ai.flags & ApplicationInfo.FLAG_IS_GAME) != 0;
                    o.put("juego", juego);
                    o.put("icono", icono(pm.getApplicationIcon(ai)));
                    out.put(o);
                } catch (Exception ignored) {}
            }
            JSObject r = new JSObject();
            r.put("apps", out);
            call.resolve(r);
        }).start();
    }

    private String icono(Drawable d) {
        try {
            int t = 72;
            Bitmap b = Bitmap.createBitmap(t, t, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(b);
            d.setBounds(0, 0, t, t);
            d.draw(c);
            ByteArrayOutputStream s = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.PNG, 100, s);
            return "data:image/png;base64," + Base64.encodeToString(s.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) { return ""; }
    }

    /** apps: paquetes a bloquear; hasta: hora (ms) a la que se levanta el bloqueo (0 = nada bloqueado) */
    @PluginMethod
    public void configurar(PluginCall call) {
        Set<String> apps = new HashSet<>();
        JSArray lista = call.getArray("apps", new JSArray());
        for (int i = 0; i < lista.length(); i++) { try { apps.add(lista.getString(i)); } catch (Exception ignored) {} }
        long hasta = call.getLong("hasta", 0L);
        getContext().getSharedPreferences(BloqueoServicio.PREFS, Context.MODE_PRIVATE).edit().putStringSet("apps", apps).putLong("hasta", hasta).commit();
        JSObject r = new JSObject();
        try {
            if (hasta > System.currentTimeMillis() && !apps.isEmpty() && accesoUso()) { BloqueoServicio.arrancar(getContext()); r.put("arrancado", true); }
            else { BloqueoServicio.parar(getContext()); r.put("arrancado", false); }
        } catch (Exception e) { r.put("arrancado", false); r.put("error", e.getClass().getSimpleName() + ": " + e.getMessage()); }
        call.resolve(r);
    }
}
