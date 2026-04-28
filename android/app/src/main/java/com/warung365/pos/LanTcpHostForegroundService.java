package com.warung365.pos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Keeps the LAN TCP host reachable while the tablet screen is off (Doze / WiFi power save).
 * Started when {@link LanTcpPlugin#startServer} binds; stopped when the server stops.
 */
public class LanTcpHostForegroundService extends Service {
  static final String CHANNEL_ID = "warung365_lan_host";
  static final int NOTIFICATION_ID = 76001;

  private WifiManager.WifiLock wifiLock;
  private PowerManager.WakeLock wakeLock;

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(
        CHANNEL_ID,
        getString(R.string.lan_host_channel_name),
        NotificationManager.IMPORTANCE_LOW
      );
      ch.setDescription(getString(R.string.lan_host_channel_desc));
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) nm.createNotificationChannel(ch);
    }
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    releaseLocks();
    acquireLocks();

    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(getString(R.string.lan_host_notification_title))
      .setContentText(getString(R.string.lan_host_notification_text))
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build();

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      );
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }

    return START_STICKY;
  }

  private void acquireLocks() {
    try {
      WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
      if (wm != null) {
        int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
          ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
          : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
        wifiLock = wm.createWifiLock(mode, "Warung365:LanHostWifi");
        wifiLock.setReferenceCounted(false);
        wifiLock.acquire();
      }
    } catch (Exception ignored) { }

    try {
      PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
      if (pm != null) {
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Warung365:LanHostCpu");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire();
      }
    } catch (Exception ignored) { }
  }

  private void releaseLocks() {
    if (wifiLock != null) {
      try {
        if (wifiLock.isHeld()) wifiLock.release();
      } catch (Exception ignored) { }
      wifiLock = null;
    }
    if (wakeLock != null) {
      try {
        if (wakeLock.isHeld()) wakeLock.release();
      } catch (Exception ignored) { }
      wakeLock = null;
    }
  }

  @Override
  public void onDestroy() {
    releaseLocks();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(Service.STOP_FOREGROUND_REMOVE);
    } else {
      stopForeground(true);
    }
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
