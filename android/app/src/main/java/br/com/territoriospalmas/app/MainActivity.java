package br.com.territoriospalmas.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeLiveUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
