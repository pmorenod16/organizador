package io.github.pmorenod16.tasca;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
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
    private static final String CANAL = "temporizador";
    private static final int ID = 4000;

    private NotificationManager gestor() {
        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel c = new NotificationChannel(CANAL, "Reloj del Enfoque", NotificationManager.IMPORTANCE_LOW);
            c.setDescription("El tiempo que queda mientras estudias");
            c.setShowBadge(false);
            c.setSound(null, null);
            c.enableVibration(false);
            nm.createNotificationChannel(c);
        }
        return nm;
    }

    @PluginMethod
    public void mostrar(PluginCall call) {
        Context ctx = getContext();
        String titulo = call.getString("titulo", "Enfoque");
        String texto = call.getString("texto", "");
        long base = call.getLong("base", System.currentTimeMillis());
        boolean cuentaAtras = call.getBoolean("cuentaAtras", true);
        boolean pausa = call.getBoolean("pausa", false);

        Intent abrir = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (abrir != null) abrir.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent pi = PendingIntent.getActivity(ctx, ID, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        int icono = ctx.getResources().getIdentifier("ic_stat_tasca", "drawable", ctx.getPackageName());
        if (icono == 0) icono = ctx.getApplicationInfo().icon;

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CANAL)
            .setSmallIcon(icono)
            .setContentTitle(titulo)
            .setContentText(texto)
            .setContentIntent(pi)
            .setOngoing(!pausa)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        if (!pausa) {
            b.setUsesChronometer(true).setShowWhen(true).setWhen(base);
            if (cuentaAtras) {
                if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(true);
                long queda = base - System.currentTimeMillis();
                if (queda > 0) b.setTimeoutAfter(queda + 1000);
            }
        }
        gestor().notify(ID, b.build());
        call.resolve();
    }

    @PluginMethod
    public void ocultar(PluginCall call) {
        gestor().cancel(ID);
        call.resolve();
    }
}
