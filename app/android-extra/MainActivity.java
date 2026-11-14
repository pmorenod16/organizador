package io.github.pmorenod16.organizador;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
