# Meridian

A navigational chart of your code.

**Use it now: [ricardomaas7.github.io/meridian](https://ricardomaas7.github.io/meridian/)** —
no install, no account, no upload.

![A Meridian survey](public/og.png)

Open a local folder and Meridian draws its call graph as a 19th-century
nautical chart: every function is a sounding mark, every resolved call a
charted route. Everything runs in the browser — parsing included — so no
source code ever leaves your machine.

## Features

- **9 languages**: TypeScript, TSX, JavaScript, Python, Go, Rust, Java, C, C++
- **Static analysis** via [tree-sitter](https://tree-sitter.github.io/) WebAssembly
- **Bilingual UI**: English / Español (selector in top-right corner)
- **Cross-platform desktop** via Tauri 2.0 (Windows, macOS, Linux)
- **MCP server** so AI agents can read your code's structure
- **Zero upload**: everything runs locally

## Run (web)

```sh
npm install
npm run dev
```

Open the printed URL in a Chromium-based browser for the native folder
picker; other browsers get a standard directory upload fallback. Or press
**View specimen** to explore a small bundled example.

## Run (desktop)

The desktop version is built with [Tauri 2.0](https://tauri.app) — a native
window, native menus, and direct filesystem access. About **10 MB** instead
of the ~150 MB Electron would ship.

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** (install via [rustup](https://rustup.rs))
- Platform-specific deps:
  - **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + WebView2 (preinstalled on Win10+)
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev`

### Development

```sh
npm install
npm run tauri dev
```

### Production build (creates native installer)

```sh
npm run tauri build
```

Output:
- **Windows**: `src-tauri/target/release/bundle/msi/Meridian_0.1.0_x64_en-US.msi` and `.exe`
- **macOS**: `src-tauri/target/release/bundle/dmg/Meridian_0.1.0_x64.dmg` and `.app`
- **Linux**: `src-tauri/target/release/bundle/{deb,rpm,appimage}/`

## Test

```sh
npm test           # run once
npm run test:watch # watch mode
npm run test:coverage # with coverage
```

## How it works

- **Parsing**: tree-sitter compiled to WebAssembly, running locally. Nine
  grammars: TypeScript, TSX, JavaScript, Python, Go, Rust, Java, C, C++.
- **Graph**: declarations (functions, methods, classes) become nodes; call
  expressions are resolved first within the file, then by unique global
  name. Ambiguous matches are drawn dashed ("estimated route"); external
  and unresolvable calls are left off the chart rather than guessed at.
- **Chart**: d3-force layout with one rule of its own — each module is a
  "sea", and its symbols drift toward it. Rendering is plain Canvas 2D.
- **Native (Tauri)**: Rust backend exposes a `scan_directory` command that
  uses `walkdir` for fast filesystem traversal. The same `tree-sitter-wasm`
  parsing runs in the embedded webview.

## Architecture

```
src/
  ui/              # React components (App, ChartCanvas, SidePanel)
  graph/           # Chart construction, layout, interpretation, snapshots
  parser/          # tree-sitter queries and language specs
  i18n/            # English/Spanish translations
  native/          # Tauri-native commands (filesystem dialog, scan)
  demo/            # Bundled example survey
src-tauri/         # Rust backend (Tauri 2.0)
  src/lib.rs       # Commands: scan_directory, read_file, get_app_info
  tauri.conf.json  # Window, bundle, identifier
  capabilities/    # Plugin permissions
mcp/               # MCP server (separate process, stdio)
scripts/           # Build helpers (check-mcp, generate icons)
```

## Native shortcuts (desktop)

- **Ctrl/Cmd + O**: Open folder
- **Ctrl/Cmd + Shift + S**: View specimen
- **Ctrl/Cmd + N**: New chart
- **Ctrl/Cmd + R**: Re-survey current folder
- **Ctrl/Cmd + Q**: Quit
- **F12**: Toggle dev tools (debug build only)

## MCP server

The same survey, readable by agents. Two tools: `survey` (chart a directory;
returns the title block, the delta since the last survey, and the remarks)
and `symbol` (one symbol's callers, callees, and source). Snapshots persist
under `~/.meridian/surveys`, so an agent can edit code, re-survey, and read
exactly what changed.

```sh
claude mcp add meridian -- npx -y github:RicardoMaas7/meridian
```

Or from a clone: `npm run build:mcp`, then point your client at
`node /path/to/meridian/dist-mcp/server.mjs`. Verify the build with
`node scripts/check-mcp.mjs`.

## Roadmap

- Precise cross-file resolution via SCIP indexers (scip-typescript first)
- Symbol search & filter UI
- Export charts as SVG/PNG

