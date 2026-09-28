package com.uzuriliving.app;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PrintActivity extends Activity {
    private static final int BLUETOOTH_PERMISSION_REQUEST = 4101;
    private static final String USB_PERMISSION_ACTION = "com.uzuriliving.app.USB_PERMISSION";
    private static final UUID SERIAL_PORT_PROFILE = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private Uri pendingUri;

    private final BroadcastReceiver usbPermissionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!USB_PERMISSION_ACTION.equals(intent.getAction())) return;
            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
            if (granted && device != null && pendingUri != null) {
                byte[] payload = decodePayload(pendingUri);
                boolean sent = sendUsb(device, payload);
                showResult(sent, sent ? "Label sent to USB printer." : "USB printer did not accept the full label payload.");
            } else {
                showResult(false, "USB printer permission was not granted.");
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        IntentFilter filter = new IntentFilter(USB_PERMISSION_ACTION);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(usbPermissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(usbPermissionReceiver, filter);
        pendingUri = getIntent().getData();
        if (pendingUri == null || !"print".equals(pendingUri.getHost())) {
            showResult(false, "Invalid Uzuri Living print request.");
            return;
        }
        if ("BLUETOOTH".equals(transport())) {
            if (needsBluetoothPermission()) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.BLUETOOTH_CONNECT}, BLUETOOTH_PERMISSION_REQUEST);
                return;
            }
        }
        startPrint();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != BLUETOOTH_PERMISSION_REQUEST) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) startPrint();
        else showResult(false, "Bluetooth permission is required to print.");
    }

    private boolean needsBluetoothPermission() {
        return Build.VERSION.SDK_INT >= 31 && ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED;
    }

    private String transport() {
        return pendingUri == null ? "" : String.valueOf(pendingUri.getQueryParameter("transport")).toUpperCase();
    }

    private byte[] decodePayload(Uri uri) {
        try {
            String encoded = uri.getQueryParameter("data");
            if (encoded == null || encoded.isEmpty()) throw new IllegalArgumentException("Missing print data.");
            return Base64.decode(encoded, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
        } catch (IllegalArgumentException error) {
            showResult(false, error.getMessage() == null ? "Invalid print data." : error.getMessage());
            return new byte[0];
        }
    }

    private void startPrint() {
        byte[] payload = decodePayload(pendingUri);
        if (payload.length == 0) return;
        executor.execute(() -> {
            try {
                Boolean usbResult = null;
                switch (transport()) {
                    case "LAN": sendLan(payload); break;
                    case "BLUETOOTH": sendBluetooth(payload); break;
                    case "USB": usbResult = sendUsbOrRequestPermission(payload); break;
                    default: throw new IOException("Unsupported Android printer transport.");
                }
                if (usbResult == null) showResult(true, "Label sent to printer.");
                else if (usbResult) showResult(true, "Label sent to USB printer.");
                else showResult(false, "USB printer did not accept the full label payload.");
            } catch (Exception error) {
                showResult(false, error.getMessage() == null ? "Android printer failed." : error.getMessage());
            }
        });
    }

    private void sendLan(byte[] payload) throws IOException {
        String host = pendingUri.getQueryParameter("host");
        int port = parseInt(pendingUri.getQueryParameter("port"), 9100);
        if (host == null || host.trim().isEmpty()) throw new IOException("Printer LAN address is missing.");
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host.trim(), port), 5000);
            OutputStream output = socket.getOutputStream();
            output.write(payload);
            output.flush();
        }
    }

    private void sendBluetooth(byte[] payload) throws Exception {
        String address = pendingUri.getQueryParameter("bluetoothAddress");
        if (address == null || address.trim().isEmpty()) throw new IOException("Paired Bluetooth address is missing.");
        android.bluetooth.BluetoothAdapter adapter = ((android.bluetooth.BluetoothManager) getSystemService(BLUETOOTH_SERVICE)).getAdapter();
        if (adapter == null) throw new IOException("This phone does not support Bluetooth.");
        android.bluetooth.BluetoothDevice device = adapter.getRemoteDevice(address.trim());
        try (android.bluetooth.BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SERIAL_PORT_PROFILE)) {
            socket.connect();
            OutputStream output = socket.getOutputStream();
            output.write(payload);
            output.flush();
        }
    }

    private Boolean sendUsbOrRequestPermission(byte[] payload) throws IOException {
        UsbManager manager = (UsbManager) getSystemService(Context.USB_SERVICE);
        UsbDevice device = findUsbDevice(manager);
        if (device == null) throw new IOException("No compatible USB printer was found. Connect it with a USB OTG adapter.");
        if (!manager.hasPermission(device)) {
            PendingIntent permission = PendingIntent.getBroadcast(this, 0, new Intent(USB_PERMISSION_ACTION).setPackage(getPackageName()), PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
            pendingUri = getIntent().getData();
            manager.requestPermission(device, permission);
            return null;
        }
        return sendUsb(device, payload);
    }

    private UsbDevice findUsbDevice(UsbManager manager) {
        int vendorId = parseInt(pendingUri.getQueryParameter("usbVendorId"), -1);
        int productId = parseInt(pendingUri.getQueryParameter("usbProductId"), -1);
        HashMap<String, UsbDevice> devices = manager.getDeviceList();
        for (UsbDevice device : devices.values()) {
            if (vendorId >= 0 && device.getVendorId() != vendorId) continue;
            if (productId >= 0 && device.getProductId() != productId) continue;
            for (int i = 0; i < device.getInterfaceCount(); i++) {
                UsbInterface usbInterface = device.getInterface(i);
                for (int j = 0; j < usbInterface.getEndpointCount(); j++) {
                    UsbEndpoint endpoint = usbInterface.getEndpoint(j);
                    if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && endpoint.getDirection() == UsbConstants.USB_DIR_OUT) return device;
                }
            }
        }
        return null;
    }

    private boolean sendUsb(UsbDevice device, byte[] payload) {
        UsbManager manager = (UsbManager) getSystemService(Context.USB_SERVICE);
        UsbDeviceConnection connection = manager.openDevice(device);
        if (connection == null) return false;
        boolean sent = false;
        try {
            for (int i = 0; i < device.getInterfaceCount() && !sent; i++) {
                UsbInterface usbInterface = device.getInterface(i);
                UsbEndpoint output = null;
                for (int j = 0; j < usbInterface.getEndpointCount(); j++) {
                    UsbEndpoint endpoint = usbInterface.getEndpoint(j);
                    if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && endpoint.getDirection() == UsbConstants.USB_DIR_OUT) { output = endpoint; break; }
                }
                if (output == null || !connection.claimInterface(usbInterface, true)) continue;
                int written = connection.bulkTransfer(output, payload, payload.length, 10_000);
                connection.releaseInterface(usbInterface);
                sent = written == payload.length;
            }
        } finally { connection.close(); }
        return sent;
    }

    private int parseInt(String value, int fallback) {
        try { return Integer.parseInt(value); } catch (Exception ignored) { return fallback; }
    }

    private void showResult(boolean success, String message) {
        runOnUiThread(() -> {
            Toast.makeText(this, message, Toast.LENGTH_LONG).show();
            if (success || !message.isEmpty()) finish();
        });
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        try { unregisterReceiver(usbPermissionReceiver); } catch (Exception ignored) { }
        super.onDestroy();
    }
}
