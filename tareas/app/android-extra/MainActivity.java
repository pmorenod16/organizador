package io.github.pmorenod16.tasca;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TemporizadorPlugin.class);
        registerPlugin(BloqueoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
