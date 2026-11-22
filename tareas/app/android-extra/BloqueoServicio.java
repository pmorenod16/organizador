package io.github.pmorenod16.tasca;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.accessibility.AccessibilityEvent;
import java.util.Collections;
import java.util.Set;

/**
 * Bloqueo de distracciones: cuando se abre una app de la lista mientras estudias, se tapa con la pantalla
 * de Tasca. Solo mira qué app pasa a primer plano (nombre del paquete); no lee nada de lo que hay dentro.
 */
public class BloqueoServicio extends AccessibilityService {
    static final String PREFS = "tasca_bloqueo";

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e == null || e.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || e.getPackageName() == null) return;
        String app = e.getPackageName().toString();
        if (app.equals(getPackageName())) return;
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        long ahora = System.currentTimeMillis();
        if (ahora >= p.getLong("hasta", 0L)) return;
        Set<String> apps = p.getStringSet("apps", Collections.<String>emptySet());
        if (apps == null || !apps.contains(app)) return;
        if (ahora < p.getLong("permiso_" + app, 0L)) return; // la dejaste usar un momento
        Intent i = new Intent(this, BloqueoActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        i.putExtra("app", app);
        startActivity(i);
    }

    @Override
    public void onInterrupt() {}
}
