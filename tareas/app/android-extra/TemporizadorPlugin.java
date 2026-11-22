package io.github.pmorenod16.tasca;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.SystemClock;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Notificación fija con el reloj del Enfoque. El tiempo lo cuenta Android solo (cronómetro del sistema),
 * así sigue bien aunque la app esté en segundo plano o cerrada. Se quita sola al llegar a cero.
 */
@CapacitorPlugin(name = "Temporizador")
public class TemporizadorPlugin extends Plugin {
    // canal nuevo con importancia normal (sin sonido): los de importancia baja no salen en la pantalla de bloqueo
    static final String CANAL = "reloj_estudio";
    static final int ID = 4000;
    /** La última notificación del reloj: el bloqueo de apps la usa como su notificación (así solo hay una) */
    static volatile android.app.Notification ultima = null;
    static volatile boolean visible = false;

    static NotificationManager gestor(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel c = new NotificationChannel(CANAL, "Reloj del estudio", NotificationManager.IMPORTANCE_DEFAULT);
            c.setDescription("El tiempo que queda mientras estudias (también en la pantalla de bloqueo)");
            c.setShowBadge(false);
            c.setSound(null, null);
            c.enableVibration(false);
            c.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(c);
            try { nm.deleteNotificationChannel("temporizador"); nm.deleteNotificationChannel("bloqueo"); } catch (Exception ignored) {}
        }
        return nm;
    }

    private NotificationManager gestor() { return gestor(getContext()); }

    @PluginMethod
    public void mostrar(PluginCall call) {
        Context ctx = getContext();
        String titulo = call.getString("titulo", "Enfoque");
        String texto = call.getString("texto", "");
        long base = call.getLong("base", System.currentTimeMillis());
        boolean cuentaAtras = call.getBoolean("cuentaAtras", true);
        boolean pausa = call.getBoolean("pausa", false);
        long restante = call.getLong("restante", 0L);   // en pausa: lo que queda (o lo que llevas, si cuenta hacia arriba)
        String color = call.getString("color", "#8E7CC3");

        Intent abrir = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (abrir != null) abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent pi = PendingIntent.getActivity(ctx, ID, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        int icono = ctx.getResources().getIdentifier("ic_stat_tasca", "drawable", ctx.getPackageName());
        if (icono == 0) icono = ctx.getApplicationInfo().icon;

        // Reloj grande con una vista propia (el cronómetro del sistema en la cabecera es muy pequeño).
        // El Chronometer cuenta con el reloj de arranque del móvil: se pasa la base a ese reloj.
        long ahora = System.currentTimeMillis(), arranque = SystemClock.elapsedRealtime();
        long baseCrono = pausa ? (cuentaAtras ? arranque + restante : arranque - restante)
                               : (cuentaAtras ? arranque + (base - ahora) : arranque - (ahora - base));
        RemoteViews peque = vista(ctx, "notif_reloj", titulo, texto, baseCrono, !pausa, cuentaAtras);
        RemoteViews grande = vista(ctx, "notif_reloj_grande", titulo, texto, baseCrono, !pausa, cuentaAtras);
        int col;
        try { col = Color.parseColor(color); } catch (Exception e) { col = 0xFF8E7CC3; }

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CANAL)
            .setSmallIcon(icono)
            .setContentTitle(titulo)
            .setContentText(texto)
            .setColor(col)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(peque)
            .setCustomBigContentView(grande)
            .setShowWhen(false)
            .setContentIntent(pi)
            .setOngoing(!pausa)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        if (!pausa && cuentaAtras) {
            long queda = base - ahora;
            if (queda > 0) b.setTimeoutAfter(queda + 1000); // al llegar a cero se quita (llega el aviso de fin)
        }
        android.app.Notification n = b.build();
        ultima = n; visible = true;
        gestor().notify(ID, n);
        call.resolve();
    }

    private RemoteViews vista(Context ctx, String layout, String titulo, String texto, long baseCrono, boolean enMarcha, boolean cuentaAtras) {
        int id = ctx.getResources().getIdentifier(layout, "layout", ctx.getPackageName());
        RemoteViews v = new RemoteViews(ctx.getPackageName(), id);
        v.setTextViewText(idDe(ctx, "reloj_titulo"), titulo);
        v.setTextViewText(idDe(ctx, "reloj_texto"), texto);
        int crono = idDe(ctx, "reloj_crono");
        v.setChronometer(crono, baseCrono, null, enMarcha);
        if (Build.VERSION.SDK_INT >= 24) v.setChronometerCountDown(crono, cuentaAtras);
        return v;
    }

    private int idDe(Context ctx, String nombre) {
        return ctx.getResources().getIdentifier(nombre, "id", ctx.getPackageName());
    }

    @PluginMethod
    public void ocultar(PluginCall call) {
        visible = false; ultima = null;
        gestor().cancel(ID);
        call.resolve();
    }
}
