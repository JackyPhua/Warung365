package com.warung365.pos;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(LanTcpPlugin.class);
    registerPlugin(ExportDownloadsPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
