#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const VERSION = "0.1.0";

const INIT_AEGIS_TOML = `base_url = "https://example.com"

[[fast]]
name = "home"
goto = "/"
expect_text = "Example"
expect_not = ["Internal Server Error"]

[[fast]]
name = "docs"
goto = "/"
click = "a[href='/docs']"
expect_text = "Docs"
`;

const INIT_FAST_RS = `#[path = "fast/navigation.rs"]
mod navigation;
`;

const INIT_FAST_NAVIGATION_RS = `#[test]
fn opens_docs() {
    aegis::fast("opens docs", |page| {
        page.goto("https://example.com");
        page.expect_status(200);
        page.expect_text("Example");
        page.expect_not("Internal Server Error");
    });
}
`;

const INIT_BROWSER_RS = `#[path = "browser/drawer.rs"]
mod drawer;
`;

const INIT_BROWSER_DRAWER_RS = `#[test]
#[ignore = "Aegis browser engine is reserved for a future release"]
fn opens_drawer() {
    aegis::browser("opens drawer", |page| {
        page.goto("https://example.com/components/drawer");
        page.click("[data-ax-drawer-open]");
        page.expect_text("Drawer");
    });
}
`;

async function main(argv) {
  const [command = "--help", ...args] = argv;

  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  if (command === "init") {
    runInit(args);
    return;
  }

  if (command === "smoke") {
    await runSmokeCommand(args);
    return;
  }

  if (command === "fast" || command === "test") {
    await runFastCommand(args);
    return;
  }

  if (command === "browser") {
    console.log("Aegis browser engine is reserved for a future release.");
    console.log("Use `aegis fast --config aegis.toml` for no-browser checks today.");
    return;
  }

  throw new Error(`unknown command '${command}'. Run 'aegis --help'.`);
}

function printHelp() {
  console.log(`Aegis ${VERSION}`);
  console.log("Frontend-friendly fast response checks for React, Next, and Axonyx sites.");
  console.log("");
  console.log("Usage:");
  console.log("  aegis init");
  console.log("  aegis smoke --url https://react.axonyx.dev --expect Axonyx");
  console.log("  aegis fast --config aegis.toml");
  console.log("  aegis browser");
}

function runInit(args) {
  const force = args.includes("--force") || args.includes("-f");
  writeFile("aegis.toml", INIT_AEGIS_TOML, force);
  writeFile(path.join("tests", "fast.rs"), INIT_FAST_RS, force);
  writeFile(path.join("tests", "fast", "navigation.rs"), INIT_FAST_NAVIGATION_RS, force);
  writeFile(path.join("tests", "browser.rs"), INIT_BROWSER_RS, force);
  writeFile(path.join("tests", "browser", "drawer.rs"), INIT_BROWSER_DRAWER_RS, force);
  console.log("Aegis project files created.");
  console.log("Next:");
  console.log("  aegis fast --config aegis.toml");
}

function writeFile(filePath, contents, force) {
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`${filePath} already exists; rerun with --force to overwrite`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

async function runSmokeCommand(args) {
  const url = readOption(args, "--url") ?? "http://127.0.0.1:3000/";
  const status = Number(readOption(args, "--status") ?? "200");
  const expect = readOption(args, "--expect");
  const expectNot = readRepeatedOption(args, "--expect-not");
  const result = await requestText(url);

  assertStatus(result, status);
  if (expect) assertContains(result.body, expect);
  for (const text of expectNot) assertNotContains(result.body, text);

  console.log("Aegis smoke passed");
  console.log(`  url: ${url}`);
  console.log(`  status: ${result.status}`);
  console.log(`  body: ${result.body.length} bytes`);
  if (expect) console.log(`  matched: ${expect}`);
}

async function runFastCommand(args) {
  const configPath = readOption(args, "--config") ?? readOption(args, "-c") ?? "aegis.toml";
  const config = parseAegisToml(fs.readFileSync(configPath, "utf8"));
  const checks = config.fast ?? [];

  if (checks.length === 0) {
    throw new Error(`config '${configPath}' does not define any [[fast]] checks`);
  }

  console.log("Aegis fast checks started");
  console.log(`  config: ${configPath}`);

  for (let index = 0; index < checks.length; index += 1) {
    const check = checks[index];
    const label = check.name ?? `fast ${index + 1}`;
    const result = await runFastCheck(config, check);
    console.log(`  ok ${label}: ${result.url} HTTP ${result.status} (${result.body.length} bytes)`);
  }

  console.log(`Aegis fast checks passed: ${checks.length} check(s)`);
}

async function runFastCheck(config, check) {
  let currentUrl = resolveConfigUrl(config, check.url ?? check.goto);
  let result = await requestText(currentUrl);
  assertStatus(result, Number(check.status ?? 200));

  if (check.click) {
    const href = hrefFromSelector(check.click);
    if (!href) {
      throw new Error(`fast click currently supports selectors shaped like a[href='/path']; got '${check.click}'`);
    }
    if (!result.body.includes(`href="${href}"`) && !result.body.includes(`href='${href}'`)) {
      throw new Error(`current page does not contain link href '${href}'`);
    }
    currentUrl = resolveHref(currentUrl, href);
    result = await requestText(currentUrl);
    assertStatus(result, Number(check.status ?? 200));
  }

  if (check.expect_text) assertContains(result.body, check.expect_text);
  for (const text of check.expect_all ?? []) assertContains(result.body, text);
  for (const text of check.expect_not ?? []) assertNotContains(result.body, text);

  return { ...result, url: currentUrl };
}

async function requestText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,*/*",
      "user-agent": `@axonyx/aegis/${VERSION}`,
    },
  });
  return {
    status: response.status,
    body: await response.text(),
  };
}

function assertStatus(result, expected) {
  if (result.status !== expected) {
    throw new Error(`expected HTTP ${expected}, got ${result.status}`);
  }
}

function assertContains(body, expected) {
  if (!body.includes(expected)) {
    throw new Error(`expected response body to contain '${expected}'`);
  }
}

function assertNotContains(body, unexpected) {
  if (body.includes(unexpected)) {
    throw new Error(`expected response body not to contain '${unexpected}'`);
  }
}

function parseAegisToml(source) {
  const config = { fast: [] };
  let current = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line === "[[fast]]") {
      current = {};
      config.fast.push(current);
      continue;
    }

    if (line === "[[smoke]]") {
      current = {};
      config.fast.push(current);
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const target = current ?? config;
    target[normalizeKey(key)] = parseTomlValue(rawValue);
  }

  return config;
}

function normalizeKey(key) {
  if (key === "path") return "goto";
  if (key === "expect") return "expect_text";
  return key;
}

function parseTomlValue(rawValue) {
  if (rawValue.startsWith("[")) {
    return [...rawValue.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
  }
  if (rawValue.startsWith("\"") && rawValue.endsWith("\"")) {
    return rawValue.slice(1, -1);
  }
  if (/^\d+$/.test(rawValue)) return Number(rawValue);
  return rawValue;
}

function resolveConfigUrl(config, pathOrUrl) {
  if (!pathOrUrl) throw new Error("fast check requires url or goto");
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  if (!config.base_url) throw new Error("relative goto requires base_url");
  return joinUrl(config.base_url, pathOrUrl);
}

function joinUrl(baseUrl, routePath) {
  const base = baseUrl.replace(/\/+$/, "");
  const route = routePath.replace(/^\/+/, "");
  return route ? `${base}/${route}` : `${base}/`;
}

function hrefFromSelector(selector) {
  const match = selector.trim().match(/^a\[href=(['"])(.*?)\1\]$/);
  return match?.[2] ?? null;
}

function resolveHref(currentUrl, href) {
  return new URL(href, currentUrl).toString();
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readRepeatedOption(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) values.push(args[index + 1]);
  }
  return values;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`Aegis error: ${error.message}`);
  process.exit(1);
});
