package io.github.pmorenod16.tasca;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TemporizadorPlugin.class);
        registerPlugin(BloqueoPlugin.class);
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
        accionWidget(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        accionWidget(intent);
    }

    /** El + del widget: la app lo recoge al ponerse delante y abre «Añadir tarea» */
    private void accionWidget(Intent i) {
        String a = i == null ? null : i.getStringExtra("tasca_accion");
        if (a == null) return;
        getSharedPreferences(TascaWidget.PREFS, Context.MODE_PRIVATE).edit().putString("accion", a).commit();
        i.removeExtra("tasca_accion");
    }
}
