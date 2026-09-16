package br.com.territoriosidiomas.app;

import android.app.Activity;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "NativeLiveUpdate")
public class NativeLiveUpdatePlugin extends Plugin {
    private static final String LIVE_UPDATE_DIR = "live-updates";
    private static final String LIVE_UPDATE_PREFS_NAME = "native_live_update";
    private static final String ACTIVE_VERSION_KEY = "active_version";
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 30000;
    private static final int MAX_OLD_VERSIONS = 2;

    @PluginMethod
    public void check(PluginCall call) {
        execute(() -> {
            try {
                UpdateManifest manifest = fetchManifest(call.getString("manifestUrl"));
                String effectiveCurrentVersion = getEffectiveCurrentVersion(call.getString("currentVersion", ""));
                boolean updateAvailable = isNewerVersion(manifest.version, effectiveCurrentVersion);
                JSObject response = new JSObject();
                response.put("updateAvailable", updateAvailable);
                response.put("version", manifest.version);
                response.put("buildDate", manifest.buildDate);
                response.put("currentVersion", effectiveCurrentVersion);
                response.put("installedVersion", getActiveVersion());
                call.resolve(response);
            } catch (Exception exception) {
                call.reject("Nao foi possivel verificar atualizacao OTA.", exception);
            }
        });
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        execute(() -> {
            try {
                String manifestUrl = call.getString("manifestUrl");
                UpdateManifest manifest = fetchManifest(manifestUrl);
                String effectiveCurrentVersion = getEffectiveCurrentVersion(call.getString("currentVersion", ""));
                boolean updateAvailable = isNewerVersion(manifest.version, effectiveCurrentVersion);

                if (!updateAvailable) {
                    JSObject response = new JSObject();
                    response.put("installed", false);
                    response.put("updateAvailable", false);
                    response.put("version", manifest.version);
                    response.put("currentVersion", effectiveCurrentVersion);
                    response.put("installedVersion", getActiveVersion());
                    call.resolve(response);
                    return;
                }

                URL bundleUrl = new URL(new URL(manifestUrl), manifest.bundleUrl);
                File updatesRoot = new File(getContext().getFilesDir(), LIVE_UPDATE_DIR);
                File zipFile = new File(getContext().getCacheDir(), "live-update-" + sanitizeVersion(manifest.version) + ".zip");
                File pendingDir = new File(updatesRoot, sanitizeVersion(manifest.version) + "-pending");
                File targetDir = new File(updatesRoot, sanitizeVersion(manifest.version));

                deleteRecursively(pendingDir);
                mkdirsOrThrow(pendingDir);
                mkdirsOrThrow(updatesRoot);

                downloadToFile(bundleUrl, zipFile);
                verifySha256(zipFile, manifest.zipSha256);
                unzip(zipFile, pendingDir);

                File indexFile = new File(pendingDir, "index.html");
                if (!indexFile.exists()) {
                    throw new IOException("Pacote OTA sem index.html.");
                }

                deleteRecursively(targetDir);
                if (!pendingDir.renameTo(targetDir)) {
                    throw new IOException("Nao foi possivel ativar o pacote OTA.");
                }

                persistServerBasePath(targetDir.getAbsolutePath());
                persistActiveVersion(manifest.version);
                cleanupOldVersions(updatesRoot, targetDir);

                JSObject response = new JSObject();
                response.put("installed", true);
                response.put("updateAvailable", true);
                response.put("version", manifest.version);
                response.put("currentVersion", effectiveCurrentVersion);
                response.put("installedVersion", manifest.version);
                call.resolve(response);

                getActivity().runOnUiThread(() -> getBridge().setServerBasePath(targetDir.getAbsolutePath()));
            } catch (Exception exception) {
                call.reject("Nao foi possivel instalar atualizacao OTA.", exception);
            }
        });
    }

    private UpdateManifest fetchManifest(String manifestUrl) throws IOException, JSONException {
        if (manifestUrl == null || manifestUrl.trim().isEmpty()) {
            throw new IOException("manifestUrl nao informado.");
        }

        HttpURLConnection connection = openConnection(new URL(manifestUrl));
        try (InputStream input = new BufferedInputStream(connection.getInputStream())) {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IOException("Manifest retornou HTTP " + status);
            }

            String json = readString(input);
            JSONObject object = new JSONObject(json);
            return new UpdateManifest(
                object.getString("version"),
                object.optString("buildDate", ""),
                object.getString("bundleUrl"),
                object.optString("zipSha256", "")
            );
        } finally {
            connection.disconnect();
        }
    }

    private String readString(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        return output.toString(java.nio.charset.StandardCharsets.UTF_8.name());
    }

    private HttpURLConnection openConnection(URL url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setInstanceFollowRedirects(true);
        connection.setUseCaches(false);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("Accept", "application/json, application/zip, */*");
        return connection;
    }

    private void downloadToFile(URL url, File target) throws IOException {
        HttpURLConnection connection = openConnection(url);
        try (InputStream input = new BufferedInputStream(connection.getInputStream());
             FileOutputStream output = new FileOutputStream(target)) {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IOException("Bundle retornou HTTP " + status);
            }

            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        } finally {
            connection.disconnect();
        }
    }

    private void verifySha256(File file, String expectedHash) throws IOException {
        if (expectedHash == null || expectedHash.trim().isEmpty()) {
            return;
        }

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new FileInputStream(file)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    digest.update(buffer, 0, read);
                }
            }

            String actualHash = bytesToHex(digest.digest());
            if (!actualHash.equalsIgnoreCase(expectedHash)) {
                throw new IOException("Hash SHA-256 do pacote OTA nao confere.");
            }
        } catch (NoSuchAlgorithmException exception) {
            throw new IOException("SHA-256 indisponivel no dispositivo.", exception);
        }
    }

    private void unzip(File zipFile, File targetDir) throws IOException {
        String targetCanonicalPath = targetDir.getCanonicalPath() + File.separator;

        try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];

            while ((entry = zip.getNextEntry()) != null) {
                File outputFile = new File(targetDir, entry.getName());
                String outputCanonicalPath = outputFile.getCanonicalPath();

                if (!outputCanonicalPath.startsWith(targetCanonicalPath)) {
                    throw new IOException("Entrada invalida no pacote OTA: " + entry.getName());
                }

                if (entry.isDirectory()) {
                    mkdirsOrThrow(outputFile);
                    continue;
                }

                File parent = outputFile.getParentFile();
                if (parent != null) {
                    mkdirsOrThrow(parent);
                }

                try (FileOutputStream output = new FileOutputStream(outputFile)) {
                    int read;
                    while ((read = zip.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                    }
                }
            }
        }
    }

    private void persistServerBasePath(String path) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
            Activity.MODE_PRIVATE
        );
        prefs.edit().putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, path).apply();
    }

    private void persistActiveVersion(String version) {
        getContext()
            .getSharedPreferences(LIVE_UPDATE_PREFS_NAME, Activity.MODE_PRIVATE)
            .edit()
            .putString(ACTIVE_VERSION_KEY, version)
            .apply();
    }

    private String getActiveVersion() {
        return getContext()
            .getSharedPreferences(LIVE_UPDATE_PREFS_NAME, Activity.MODE_PRIVATE)
            .getString(ACTIVE_VERSION_KEY, "");
    }

    private String getEffectiveCurrentVersion(String bundledVersion) {
        String activeVersion = getActiveVersion();
        return compareVersions(activeVersion, bundledVersion) > 0 ? activeVersion : bundledVersion;
    }

    private void cleanupOldVersions(File updatesRoot, File activeDir) {
        File[] children = updatesRoot.listFiles(File::isDirectory);
        if (children == null || children.length <= MAX_OLD_VERSIONS) {
            return;
        }

        List<File> versions = new ArrayList<>();
        for (File child : children) {
            if (!child.equals(activeDir) && !child.getName().endsWith("-pending")) {
                versions.add(child);
            }
        }

        versions.sort(Comparator.comparingLong(File::lastModified).reversed());
        for (int index = MAX_OLD_VERSIONS - 1; index < versions.size(); index += 1) {
            deleteRecursively(versions.get(index));
        }
    }

    private boolean isNewerVersion(String remoteVersion, String currentVersion) {
        return compareVersions(remoteVersion, currentVersion) > 0;
    }

    private int compareVersions(String firstVersion, String secondVersion) {
        int[] first = parseVersion(firstVersion);
        int[] second = parseVersion(secondVersion);
        int length = Math.max(first.length, second.length);

        for (int index = 0; index < length; index += 1) {
            int firstPart = index < first.length ? first[index] : 0;
            int secondPart = index < second.length ? second[index] : 0;
            if (firstPart > secondPart) return 1;
            if (firstPart < secondPart) return -1;
        }

        return 0;
    }

    private int[] parseVersion(String version) {
        if (version == null || version.trim().isEmpty()) {
            return new int[] { 0 };
        }

        String[] parts = version.split("\\.");
        int[] values = new int[parts.length];
        for (int index = 0; index < parts.length; index += 1) {
            String digits = parts[index].replaceAll("[^0-9].*$", "");
            values[index] = digits.isEmpty() ? 0 : Integer.parseInt(digits);
        }
        return values;
    }

    private String sanitizeVersion(String version) {
        return version.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }

    private void mkdirsOrThrow(File dir) throws IOException {
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("Nao foi possivel criar diretorio: " + dir);
        }
    }

    private void deleteRecursively(File file) {
        if (file == null || !file.exists()) {
            return;
        }

        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }

        file.delete();
    }

    private static final class UpdateManifest {
        final String version;
        final String buildDate;
        final String bundleUrl;
        final String zipSha256;

        UpdateManifest(String version, String buildDate, String bundleUrl, String zipSha256) {
            this.version = version;
            this.buildDate = buildDate;
            this.bundleUrl = bundleUrl;
            this.zipSha256 = zipSha256;
        }
    }
}
