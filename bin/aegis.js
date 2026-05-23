#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const VERSION = "0.1.0";

const native = findNativeAegis();

if (!native) {
  printMissingNative();
  process.exit(1);
}

const result = spawnSync(native, process.argv.slice(2), {
  stdio: "inherit",
  env: {
    ...process.env,
    AEGIS_NPM_WRAPPER: VERSION,
  },
});

if (result.error) {
  console.error(`Aegis npm wrapper could not start native binary: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 0);

function findNativeAegis() {
  const explicit = process.env.AEGIS_NATIVE_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  for (const candidate of cargoCandidates()) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function cargoCandidates() {
  const executable = process.platform === "win32" ? "aegis.exe" : "aegis";
  const candidates = [];

  if (process.env.CARGO_HOME) {
    candidates.push(join(process.env.CARGO_HOME, "bin", executable));
  }

  if (process.platform === "win32" && process.env.USERPROFILE) {
    candidates.push(join(process.env.USERPROFILE, ".cargo", "bin", executable));
  }

  if (process.env.HOME) {
    candidates.push(join(process.env.HOME, ".cargo", "bin", executable));
  }

  return candidates;
}

function printMissingNative() {
  console.error("Aegis native binary was not found.");
  console.error("");
  console.error("@axonyx/aegis is currently a thin npm launcher for the Rust Aegis engine.");
  console.error("Install the native engine once, then rerun this command:");
  console.error("");
  console.error("  cargo install axonyx-aegis --force");
  console.error("");
  console.error("Advanced:");
  console.error("  set AEGIS_NATIVE_PATH to a custom aegis binary path.");
}
