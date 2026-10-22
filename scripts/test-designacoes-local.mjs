import { spawnSync } from "node:child_process";
if (
  !process.env.GCLOUD_PROJECT?.startsWith("demo-") ||
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw new Error("Execute dentro dos emuladores com um projeto demo.");
for (const script of [
  "scripts/test-firestore-rules.mjs",
  "scripts/smoke-enderecos-grupos-emulator.mjs",
  "scripts/smoke-designacoes-emulator.mjs",
  "scripts/smoke-cartao-emulator.mjs",
]) {
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
