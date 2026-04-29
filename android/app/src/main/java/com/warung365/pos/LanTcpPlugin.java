package com.warung365.pos;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * LAN sync over the shop router: TCP server/client + local IPv4 discovery.
 * No Wi‑Fi Direct / P2P — those APIs are not used.
 */
@CapacitorPlugin(name = "LanTcp")
public class LanTcpPlugin extends Plugin {
  private volatile ServerSocket serverSocket = null;
  private final List<Socket> serverClients = new CopyOnWriteArrayList<>();
  private volatile Socket clientSocket = null;
  private volatile DataOutputStream clientOut = null;
  private volatile DataInputStream clientIn = null;

  @Override
  protected void handleOnDestroy() {
    super.handleOnDestroy();
    stopServerInternal();
    disconnectClientInternal();
  }

  @PluginMethod
  public void getLocalIp(PluginCall call) {
    JSObject ret = new JSObject();
    try {
      String ip = findLocalIpv4();
      if (ip == null) {
        ret.put("available", false);
        call.resolve(ret);
        return;
      }
      ret.put("available", true);
      ret.put("ip", ip);
      call.resolve(ret);
    } catch (Exception e) {
      call.reject("getLocalIp failed: " + e.getMessage());
    }
  }

  @PluginMethod
  public void startServer(PluginCall call) {
    int port = call.getInt("port", 8765);
    stopServerInternal();
    Context ctxBind = getContext();
    if (ctxBind != null) {
      Runnable fg = this::startHostForegroundService;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        ctxBind.getMainExecutor().execute(fg);
      } else {
        new Handler(Looper.getMainLooper()).post(fg);
      }
    }
    new Thread(() -> {
      try {
        ServerSocket ss = new ServerSocket();
        ss.setReuseAddress(true);
        ss.bind(new InetSocketAddress("0.0.0.0", port), 10);
        serverSocket = ss;

        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("port", port);
        ret.put("bound", ss.getLocalSocketAddress().toString());
        call.resolve(ret);

        notifyListeners("serverStarted", ret);

        while (!ss.isClosed()) {
          try {
            Socket s = ss.accept();
            s.setKeepAlive(true);
            s.setTcpNoDelay(true);
            serverClients.add(s);
            notifyListeners("clientConnected", socketInfo(s));
            startServerReadLoop(s);
          } catch (IOException acceptErr) {
            if (ss.isClosed()) break;
          }
        }
      } catch (IOException e) {
        stopHostForegroundService();
        JSObject err = new JSObject();
        err.put("message", e.getMessage());
        notifyListeners("serverError", err);
        call.reject("Server start failed: " + e.getMessage());
      }
    }).start();
  }

  @PluginMethod
  public void stopServer(PluginCall call) {
    stopServerInternal();
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  /** TCP connect to host (worker). host = LAN IP of main device. */
  @PluginMethod
  public void connectToGroupOwner(PluginCall call) {
    String host = call.getString("host", null);
    int port = call.getInt("port", 8765);
    int retries = call.getInt("retries", 5);

    if (host == null || host.trim().isEmpty()) {
      call.reject("host IP is required (router LAN address of main device)");
      return;
    }

    final String finalHost = host.trim();
    final int maxRetries = Math.max(1, retries);
    disconnectClientInternal();
    new Thread(() -> {
      IOException lastError = null;
      for (int attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          Socket s = new Socket(finalHost, port);
          s.setKeepAlive(true);
          s.setTcpNoDelay(true);
          clientSocket = s;
          clientOut = new DataOutputStream(new BufferedOutputStream(s.getOutputStream()));
          clientIn = new DataInputStream(new BufferedInputStream(s.getInputStream()));
          notifyListeners("clientReady", socketInfo(s));
          startClientReadLoop(s, clientIn);
          JSObject ret = new JSObject();
          ret.put("ok", true);
          ret.put("host", finalHost);
          ret.put("port", port);
          ret.put("attempt", attempt);
          call.resolve(ret);
          return;
        } catch (IOException e) {
          lastError = e;
          if (attempt < maxRetries) {
            try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
          }
        }
      }
      JSObject err = new JSObject();
      err.put("message", lastError != null ? lastError.getMessage() : "Connection failed");
      notifyListeners("clientError", err);
      call.reject("TCP connect failed after " + maxRetries + " attempts: "
        + (lastError != null ? lastError.getMessage() : "unknown"));
    }).start();
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
    stopHostForegroundService();
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

  private void startHostForegroundService() {
    Context ctx = getContext();
    if (ctx == null) return;
    try {
      Intent i = new Intent(ctx, LanTcpHostForegroundService.class);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(i);
      } else {
        ctx.startService(i);
      }
    } catch (Exception ignored) { }
  }

  private void stopHostForegroundService() {
    Context ctx = getContext();
    if (ctx == null) return;
    try {
      ctx.stopService(new Intent(ctx, LanTcpHostForegroundService.class));
    } catch (Exception ignored) { }
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

  private String findLocalIpv4() {
    try {
      Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
      if (interfaces == null) return null;
      while (interfaces.hasMoreElements()) {
        NetworkInterface nif = interfaces.nextElement();
        if (nif == null) continue;
        try {
          if (!nif.isUp() || nif.isLoopback()) continue;
        } catch (Exception ignored) {}

        String name = nif.getName();
        boolean preferred = name != null && (name.startsWith("wlan") || name.startsWith("wifi"));

        Enumeration<InetAddress> addrs = nif.getInetAddresses();
        while (addrs.hasMoreElements()) {
          InetAddress addr = addrs.nextElement();
          if (addr == null) continue;
          String host = addr.getHostAddress();
          if (host == null) continue;
          if (host.contains(":")) continue;
          if (host.startsWith("127.")) continue;
          if (preferred) return host;
        }
      }
      interfaces = NetworkInterface.getNetworkInterfaces();
      if (interfaces == null) return null;
      while (interfaces.hasMoreElements()) {
        NetworkInterface nif = interfaces.nextElement();
        if (nif == null) continue;
        try {
          if (!nif.isUp() || nif.isLoopback()) continue;
        } catch (Exception ignored) {}
        Enumeration<InetAddress> addrs = nif.getInetAddresses();
        while (addrs.hasMoreElements()) {
          InetAddress addr = addrs.nextElement();
          if (addr == null) continue;
          String host = addr.getHostAddress();
          if (host == null) continue;
          if (host.contains(":")) continue;
          if (host.startsWith("127.")) continue;
          return host;
        }
      }
      return null;
    } catch (Exception e) {
      return null;
    }
  }
}
