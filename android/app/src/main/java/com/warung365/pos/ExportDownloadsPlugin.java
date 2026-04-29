package com.warung365.pos;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Writes files into public Downloads / Documents via MediaStore (API 29+).
 * Used instead of @capacitor/filesystem which forces JDK 21 + Kotlin toolchain.
 */
@CapacitorPlugin(name = "ExportDownloads")
public class ExportDownloadsPlugin extends Plugin {

  @PluginMethod
  public void saveToDownloads(PluginCall call) {
    dispatchSave(call, true);
  }

  @PluginMethod
  public void saveToDocuments(PluginCall call) {
    dispatchSave(call, false);
  }

  private void dispatchSave(PluginCall call, boolean downloads) {
    String base64 = call.getString("base64", null);
    String fileName = call.getString("fileName", null);
    String mimeType = call.getString("mimeType", "application/octet-stream");

    if (base64 == null || fileName == null || fileName.trim().isEmpty()) {
      call.reject("base64 and fileName are required");
      return;
    }

    fileName = safeFileName(fileName);
    final byte[] bytes;
    try {
      bytes = Base64.decode(base64, Base64.DEFAULT);
    } catch (Exception e) {
      call.reject("Invalid base64");
      return;
    }

    Context ctx = getContext();
    if (ctx == null) {
      call.reject("No context");
      return;
    }

    JSObject ret = new JSObject();
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        if (downloads) {
          saveDownloadsApi29(ctx, fileName, mimeType, bytes, ret);
        } else {
          saveDocumentsApi29(ctx, fileName, mimeType, bytes, ret);
        }
      } else {
        if (downloads) {
          saveLegacyPublic(fileName, bytes, Environment.DIRECTORY_DOWNLOADS, ret);
        } else {
          saveLegacyPublic(fileName, bytes, Environment.DIRECTORY_DOCUMENTS, ret);
        }
      }
      call.resolve(ret);
    } catch (Exception e) {
      call.reject(e.getMessage() != null ? e.getMessage() : "save failed");
    }
  }

  private static void saveDownloadsApi29(Context ctx, String fileName, String mimeType, byte[] bytes, JSObject ret)
    throws Exception {
    ContentValues values = new ContentValues();
    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

    Uri uri = ctx.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
    if (uri == null) {
      throw new Exception("Could not insert into MediaStore.Downloads");
    }
    try (OutputStream out = ctx.getContentResolver().openOutputStream(uri)) {
      if (out == null) throw new Exception("Could not open output stream");
      out.write(bytes);
    }
    ret.put("ok", true);
    ret.put("path", Environment.DIRECTORY_DOWNLOADS + "/" + fileName);
  }

  private static void saveDocumentsApi29(Context ctx, String fileName, String mimeType, byte[] bytes, JSObject ret)
    throws Exception {
    ContentValues values = new ContentValues();
    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOCUMENTS);

    Uri collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
    Uri uri = ctx.getContentResolver().insert(collection, values);
    if (uri == null) {
      throw new Exception("Could not insert into MediaStore (Documents)");
    }
    try (OutputStream out = ctx.getContentResolver().openOutputStream(uri)) {
      if (out == null) throw new Exception("Could not open output stream");
      out.write(bytes);
    }
    ret.put("ok", true);
    ret.put("path", Environment.DIRECTORY_DOCUMENTS + "/" + fileName);
  }

  private static void saveLegacyPublic(String fileName, byte[] bytes, String dirType, JSObject ret) throws Exception {
    File dir = Environment.getExternalStoragePublicDirectory(dirType);
    if (!dir.exists() && !dir.mkdirs()) {
      throw new Exception("Public folder unavailable: " + dirType);
    }
    File outFile = new File(dir, fileName);
    try (FileOutputStream fos = new FileOutputStream(outFile)) {
      fos.write(bytes);
    }
    ret.put("ok", true);
    ret.put("path", outFile.getAbsolutePath());
  }

  static String safeFileName(String raw) {
    if (raw == null || raw.trim().isEmpty()) return "export.bin";
    String s = raw.replace('\\', '/');
    int i = s.lastIndexOf('/');
    if (i >= 0) {
      s = s.substring(i + 1);
    }
    return s.replace("..", "_");
  }
}
