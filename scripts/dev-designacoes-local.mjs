import { spawn } from "node:child_process";
const env = {
  ...process.env,
  VITE_LOCAL_EMULATORS: "true",
  VITE_NOTIFICATIONS_RELAY_URL: "",
  VITE_ONESIGNAL_APP_ID: "",
  VITE_ONESIGNAL_SAFARI_WEB_ID: "",
  VITE_PUBLIC_APP_URL: "http://localhost:5185",
  VITE_LIVE_UPDATE_MANIFEST_URL: "",
  VITE_FIREBASE_PROJECT_ID: "demo-territorios-designacoes",
  VITE_FIREBASE_API_KEY: "demo-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-territorios-designacoes.firebaseapp.com",
  VITE_FIREBASE_STORAGE_BUCKET: "demo-territorios-designacoes.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  VITE_FIREBASE_APP_ID: "1:000000000000:web:local",
  VITE_DESIGNACOES_API_URL: "http://127.0.0.1:8788",
  VITE_APP_TITLE: "Territórios — demonstração local",
  VITE_APP_SHORT_NAME: "Territórios",
  VITE_APP_ICON_192: "/icon-192.png",
  VITE_APP_ICON_512: "/icon-512.png",
};
const child = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--mode",
    "designacoes",
    "--host",
    "127.0.0.1",
    "--port",
    "5185",
    "--strictPort",
  ],
  { stdio: "inherit", env },
);
child.on("exit", (code) => process.exit(code || 0));
