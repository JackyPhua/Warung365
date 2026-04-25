package com.warung365.pos;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.NetworkInfo;
import android.net.wifi.p2p.WifiP2pConfig;
import android.net.wifi.p2p.WifiP2pDevice;
import android.net.wifi.p2p.WifiP2pDeviceList;
import android.net.wifi.p2p.WifiP2pInfo;
import android.net.wifi.p2p.WifiP2pManager;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@CapacitorPlugin(
  name = "WifiDirect",
  permissions = {
    @Permission(
      strings = { Manifest.permission.ACCESS_FINE_LOCATION },
      alias = "location"
    ),
    @Permission(
      strings = { "android.permission.NEARBY_WIFI_DEVICES" },
      alias = "nearbyWifi"
    )
  }
)
public class WifiDirectPlugin extends Plugin {
  private WifiP2pManager manager;
  private WifiP2pManager.Channel channel;
  private BroadcastReceiver receiver;
  private final List<WifiP2pDevice> peers = new CopyOnWriteArrayList<>();
  private volatile WifiP2pInfo lastInfo = null;

  private volatile ServerSocket serverSocket = null;
  private final List<Socket> serverClients = new CopyOnWriteArrayList<>();
  private volatile Socket clientSocket = null;
  private volatile DataOutputStream clientOut = null;
  private volatile DataInputStream clientIn = null;

  @Override
  public void load() {
    manager = (WifiP2pManager) getContext().getSystemService(Context.WIFI_P2P_SERVICE);
    if (manager != null) {
      channel = manager.initialize(getContext(), getContext().getMainLooper(), null);
    }
    setupReceiver();
  }

  @Override
  protected void handleOnDestroy() {
    super.handleOnDestroy();
    try { unregisterReceiver(); } catch (Exception ignored) {}
    stopServerInternal();
    disconnectClientInternal();
  }

  @PluginMethod
  public void requestPermissions(PluginCall call) {
    boolean needsNearby = Build.VERSION.SDK_INT >= 33;
    PermissionState loc = getPermissionState("location");
    PermissionState near = needsNearby ? getPermissionState("nearbyWifi") : PermissionState.GRANTED;

    if (loc == PermissionState.GRANTED && near == PermissionState.GRANTED) {
      JSObject ret = new JSObject();
      ret.put("granted", true);
      call.resolve(ret);
      return;
    }
    // Request location first, then nearby if needed
    requestPermissionForAlias("location", call, "onLocationPerms");
  }

  @PermissionCallback
  private void onLocationPerms(PluginCall call) {
    boolean needsNearby = Build.VERSION.SDK_INT >= 33;
    PermissionState loc = getPermissionState("location");
    if (loc != PermissionState.GRANTED) {
      call.reject("Location permission is required for Wi‑Fi Direct discovery.");
      return;
    }
    if (!needsNearby) {
      JSObject ret = new JSObject();
      ret.put("granted", true);
      call.resolve(ret);
      return;
    }
    requestPermissionForAlias("nearbyWifi", call, "onNearbyPerms");
  }

  @PermissionCallback
  private void onNearbyPerms(PluginCall call) {
    PermissionState near = getPermissionState("nearbyWifi");
    if (near != PermissionState.GRANTED) {
      call.reject("Nearby Wi‑Fi permission is required on Android 13+.");
      return;
    }
    JSObject ret = new JSObject();
    ret.put("granted", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void createGroupOwner(PluginCall call) {
    if (!ensureReady(call)) return;
    manager.createGroup(channel, new WifiP2pManager.ActionListener() {
      @Override public void onSuccess() {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
      }
      @Override public void onFailure(int reason) {
        call.reject("createGroup failed: " + reason);
      }
    });
  }

  @PluginMethod
  public void removeGroup(PluginCall call) {
    if (!ensureReady(call)) return;
    manager.removeGroup(channel, new WifiP2pManager.ActionListener() {
      @Override public void onSuccess() {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
      }
      @Override public void onFailure(int reason) {
        call.reject("removeGroup failed: " + reason);
      }
    });
  }

  @PluginMethod
  public void discoverPeers(PluginCall call) {
    if (!ensureReady(call)) return;
    manager.discoverPeers(channel, new WifiP2pManager.ActionListener() {
      @Override public void onSuccess() {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
      }
      @Override public void onFailure(int reason) {
        call.reject("discoverPeers failed: " + reason);
      }
    });
  }

  @PluginMethod
  public void getPeers(PluginCall call) {
    JSArray arr = new JSArray();
    for (WifiP2pDevice d : peers) {
      JSObject o = new JSObject();
      o.put("deviceName", d.deviceName);
      o.put("deviceAddress", d.deviceAddress);
      o.put("status", d.status);
      arr.put(o);
    }
    JSObject ret = new JSObject();
    ret.put("peers", arr);
    call.resolve(ret);
  }

  @PluginMethod
  public void connect(PluginCall call) {
    if (!ensureReady(call)) return;
    String address = call.getString("deviceAddress", null);
    if (address == null || address.trim().isEmpty()) {
      call.reject("deviceAddress is required");
      return;
    }

    WifiP2pConfig cfg = new WifiP2pConfig();
    cfg.deviceAddress = address;

    manager.connect(channel, cfg, new WifiP2pManager.ActionListener() {
      @Override public void onSuccess() {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
      }
      @Override public void onFailure(int reason) {
        call.reject("connect failed: " + reason);
      }
    });
  }

  @PluginMethod
  public void requestConnectionInfo(PluginCall call) {
    if (!ensureReady(call)) return;
    manager.requestConnectionInfo(channel, info -> {
      lastInfo = info;
      call.resolve(infoToJS(info));
    });
  }

  @PluginMethod
  public void startServer(PluginCall call) {
    int port = call.getInt("port", 8765);
    stopServerInternal();
    new Thread(() -> {
      try {
        ServerSocket ss = new ServerSocket(port);
        serverSocket = ss;
        JSObject ev = new JSObject();
        ev.put("port", port);
        notifyListeners("serverStarted", ev);

        while (!ss.isClosed()) {
          Socket s = ss.accept();
          serverClients.add(s);
          notifyListeners("clientConnected", socketInfo(s));
          startServerReadLoop(s);
        }
      } catch (IOException e) {
        if (serverSocket != null) {
          JSObject err = new JSObject();
          err.put("message", e.getMessage());
          notifyListeners("serverError", err);
        }
      }
    }).start();

    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("port", port);
    call.resolve(ret);
  }

  @PluginMethod
  public void stopServer(PluginCall call) {
    stopServerInternal();
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void connectToGroupOwner(PluginCall call) {
    String host = call.getString("host", null);
    int port = call.getInt("port", 8765);

    if (host == null || host.trim().isEmpty()) {
      // Default Wi‑Fi Direct GO address (most devices)
      host = "192.168.49.1";
    }

    final String finalHost = host;
    disconnectClientInternal();
    new Thread(() -> {
      try {
        Socket s = new Socket(finalHost, port);
        clientSocket = s;
        clientOut = new DataOutputStream(new BufferedOutputStream(s.getOutputStream()));
        clientIn = new DataInputStream(new BufferedInputStream(s.getInputStream()));
        notifyListeners("clientReady", socketInfo(s));
        startClientReadLoop(s, clientIn);
      } catch (IOException e) {
        JSObject err = new JSObject();
        err.put("message", e.getMessage());
        notifyListeners("clientError", err);
      }
    }).start();

    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("host", finalHost);
    ret.put("port", port);
    call.resolve(ret);
  }

  @PluginMethod
  public void disconnectClient(PluginCall call) {
    disconnectClientInternal();
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void send(PluginCall call) {
    String base64 = call.getString("base64", null);
    if (base64 == null) {
      call.reject("base64 is required");
      return;
    }
    byte[] bytes;
    try {
      bytes = Base64.decode(base64, Base64.DEFAULT);
    } catch (Exception e) {
      call.reject("Invalid base64");
      return;
    }

    // Prefer client socket if exists, else broadcast to server clients
    if (clientOut != null && clientSocket != null && clientSocket.isConnected()) {
      try {
        writeFrame(clientOut, bytes);
        call.resolve(ok());
        return;
      } catch (IOException e) {
        call.reject(e.getMessage());
        return;
      }
    }

    if (serverClients.isEmpty()) {
      call.reject("No connected socket");
      return;
    }

    List<Socket> snapshot = new ArrayList<>(serverClients);
    int sent = 0;
    for (Socket s : snapshot) {
      try {
        DataOutputStream out = new DataOutputStream(new BufferedOutputStream(s.getOutputStream()));
        writeFrame(out, bytes);
        sent++;
      } catch (Exception ignored) {}
    }
    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("sent", sent);
    call.resolve(ret);
  }

  // ───────────────────────── Internal ─────────────────────────
  private boolean ensureReady(PluginCall call) {
    if (manager == null || channel == null) {
      call.reject("WifiP2pManager not available on this device");
      return false;
    }
    return true;
  }

  private void setupReceiver() {
    if (receiver != null) return;
    receiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        if (manager == null || channel == null) return;
        String action = intent.getAction();
        if (WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION.equals(action)) {
          int state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1);
          JSObject ev = new JSObject();
          ev.put("enabled", state == WifiP2pManager.WIFI_P2P_STATE_ENABLED);
          notifyListeners("stateChanged", ev);
        } else if (WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION.equals(action)) {
          manager.requestPeers(channel, (WifiP2pDeviceList list) -> {
            peers.clear();
            peers.addAll(list.getDeviceList());
            JSObject ev = new JSObject();
            ev.put("count", peers.size());
            notifyListeners("peersChanged", ev);
          });
        } else if (WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION.equals(action)) {
          NetworkInfo networkInfo = intent.getParcelableExtra(WifiP2pManager.EXTRA_NETWORK_INFO);
          boolean connected = networkInfo != null && networkInfo.isConnected();
          JSObject ev = new JSObject();
          ev.put("connected", connected);
          notifyListeners("connectionChanged", ev);

          if (connected) {
            manager.requestConnectionInfo(channel, info -> {
              lastInfo = info;
              notifyListeners("connectionInfo", infoToJS(info));
            });
          }
        }
      }
    };

    IntentFilter filter = new IntentFilter();
    filter.addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION);
    filter.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION);
    filter.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION);
    filter.addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION);

    getActivity().registerReceiver(receiver, filter);
  }

  private void unregisterReceiver() {
    if (receiver == null) return;
    try { getActivity().unregisterReceiver(receiver); } catch (Exception ignored) {}
    receiver = null;
  }

  private JSObject infoToJS(WifiP2pInfo info) {
    JSObject o = new JSObject();
    if (info == null) {
      o.put("available", false);
      return o;
    }
    o.put("available", info.groupFormed);
    o.put("isGroupOwner", info.isGroupOwner);
    InetAddress addr = info.groupOwnerAddress;
    o.put("groupOwnerAddress", addr != null ? addr.getHostAddress() : null);
    return o;
  }

  private JSObject ok() {
    JSObject o = new JSObject();
    o.put("ok", true);
    return o;
  }

  private JSObject socketInfo(Socket s) {
    JSObject o = new JSObject();
    o.put("remoteAddress", s.getInetAddress() != null ? s.getInetAddress().getHostAddress() : null);
    o.put("remotePort", s.getPort());
    return o;
  }

  private void stopServerInternal() {
    ServerSocket ss = serverSocket;
    serverSocket = null;
    if (ss != null) {
      try { ss.close(); } catch (Exception ignored) {}
    }
    for (Socket s : new ArrayList<>(serverClients)) {
      try { s.close(); } catch (Exception ignored) {}
    }
    serverClients.clear();
  }

  private void disconnectClientInternal() {
    Socket s = clientSocket;
    clientSocket = null;
    clientOut = null;
    clientIn = null;
    if (s != null) {
      try { s.close(); } catch (Exception ignored) {}
    }
  }

  private void startServerReadLoop(Socket s) {
    new Thread(() -> {
      try {
        DataInputStream in = new DataInputStream(new BufferedInputStream(s.getInputStream()));
        while (!s.isClosed()) {
          byte[] msg = readFrame(in);
          if (msg == null) break;
          JSObject ev = new JSObject();
          ev.put("base64", Base64.encodeToString(msg, Base64.NO_WRAP));
          ev.put("from", socketInfo(s));
          notifyListeners("message", ev);
        }
      } catch (IOException ignored) {
      } finally {
        serverClients.remove(s);
        try { s.close(); } catch (Exception ignored2) {}
        notifyListeners("clientDisconnected", socketInfo(s));
      }
    }).start();
  }

  private void startClientReadLoop(Socket s, DataInputStream in) {
    new Thread(() -> {
      try {
        while (!s.isClosed()) {
          byte[] msg = readFrame(in);
          if (msg == null) break;
          JSObject ev = new JSObject();
          ev.put("base64", Base64.encodeToString(msg, Base64.NO_WRAP));
          notifyListeners("message", ev);
        }
      } catch (IOException ignored) {
      } finally {
        notifyListeners("clientDisconnected", socketInfo(s));
        disconnectClientInternal();
      }
    }).start();
  }

  private void writeFrame(DataOutputStream out, byte[] payload) throws IOException {
    out.writeInt(payload.length);
    out.write(payload);
    out.flush();
  }

  private byte[] readFrame(DataInputStream in) throws IOException {
    int len;
    try {
      len = in.readInt();
    } catch (IOException e) {
      return null;
    }
    if (len <= 0 || len > (1024 * 1024 * 10)) {
      return null;
    }
    byte[] buf = new byte[len];
    in.readFully(buf);
    return buf;
  }
}

