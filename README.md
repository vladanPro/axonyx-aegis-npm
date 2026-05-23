# @axonyx/aegis

Frontend-friendly Aegis CLI for fast response checks.

This npm package is for React, Next, and frontend projects that should not need
to install Rust/Cargo just to run fast checks.

```bash
npm install -D @axonyx/aegis
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

The Rust-native package remains available as:

```bash
cargo install axonyx-aegis
```

Both CLIs share the same `aegis.toml` fast-check syntax.
