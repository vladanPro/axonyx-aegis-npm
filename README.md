# @axonyx/aegis

Frontend-friendly npm launcher for the Rust Aegis CLI.

This package intentionally does not reimplement the Aegis engine in Node.
`axonyx-aegis` remains the Rust source of truth, and `@axonyx/aegis` is the npm
entrypoint for frontend projects.

```bash
npm install -D @axonyx/aegis
cargo install axonyx-aegis --force
npx aegis init
npx aegis fast --config aegis.toml
```

Example `aegis.toml`:

```toml
base_url = "https://react.axonyx.dev"

[[fast]]
name = "getting started docs"
goto = "/"
click = "a[href='/docs/getting-started']"
expect_text = "Getting Started"
expect_not = ["Application error"]
```

For now, the native engine must be installed once with Cargo:

```bash
cargo install axonyx-aegis
```

If you keep the binary somewhere else, set:

```bash
AEGIS_NATIVE_PATH=/path/to/aegis npx aegis --help
```

Long term, this npm package should download or select the native binary
automatically. Until then, npm stays a thin launcher so the test logic is not
duplicated in two places.
