# Meridian — a navigational chart of your code

**Meridian** is a local-first code visualization tool: open a folder and
it draws the call graph of your source as a 19th-century nautical chart.
Every function is a mark, every call a route. It runs entirely on your
machine — nothing is uploaded.

- **9 languages** out of the box: TypeScript, TSX, JavaScript, Python,
  Go, Rust, Java, C, C++
- **Two ways to use it**: a web app (no install) and a native desktop
  app (Tauri, ~10 MB)
- **Static analysis** with [tree-sitter](https://tree-sitter.github.io/)
  WebAssembly — no runtime needed
- **Bilingual UI**: English / Español
- **Optional**: an MCP server so AI agents (Claude, etc.) can read your
  codebase's structure

---

## Table of contents

1. [Try it without installing (web)](#1-try-it-without-installing-web)
2. [Run the web app on your machine](#2-run-the-web-app-on-your-machine)
3. [Run the desktop app (Tauri)](#3-run-the-desktop-app-tauri)
4. [Try the specimen (no folder needed)](#4-try-the-specimen-no-folder-needed)
5. [Using the chart](#5-using-the-chart)
6. [Troubleshooting](#6-troubleshooting)
7. [Test, lint, build](#7-test-lint-build)
8. [MCP server](#8-mcp-server)

---

## 1. Try it without installing (web)

If you just want to see it in action, the published GitHub Pages build
runs in any modern browser — no clone, no install.

👉 **[ricardomaas7.github.io/meridian-atlas](https://ricardomaas7.github.io/meridian-atlas/)**

> **Note on folder pickers**: Chromium-based browsers (Chrome, Edge,
> Brave, Arc) get a native folder picker. Firefox and Safari get a
> fallback file picker. For the smoothest experience use Chrome or
> Edge.

---

## 2. Run the web app on your machine

If you want to run the web app locally (or build a custom version):

### Prerequisites

- **Node.js 18+** — [download](https://nodejs.org/) or `nvm install 18`
- **npm** (bundled with Node.js) — or `pnpm` / `yarn` if you prefer

### Steps

```sh
# 1. Clone the repo
git clone https://github.com/RicardoMaas7/meridian-atlas.git
cd meridian-atlas

# 2. Install dependencies (this also builds the MCP server bundle)
npm install
# or, if you prefer pnpm:
pnpm install

# 3. Start the dev server
npm run dev
# or: pnpm dev
```

Vite will print a URL, usually `http://localhost:5173`. Open it in
your browser. Click **Chart a folder** to pick a source directory, or
**View specimen** to see a small bundled example.

### Production web build

```sh
npm run build       # bundles to dist/
npm run preview     # serves the built bundle locally
```

The contents of `dist/` are static — drop them on any static host
(Netlify, Vercel, GitHub Pages, Cloudflare Pages…).

---

## 3. Run the desktop app (Tauri)

The desktop version is a real native window with the same code as the
web app, packaged via [Tauri 2.0](https://tauri.app). About **10 MB**
versus ~150 MB for an equivalent Electron app.

### Prerequisites

You need everything for the web app **plus** the Tauri toolchain.

- **Node.js 18+** (see above)
- **Rust** — install via [rustup](https://rustup.rs):
  ```sh
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **Platform-specific build tools:**
  - **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
    (the "Desktop development with C++" workload) + **WebView2** (already
    preinstalled on Windows 10/11)
  - **macOS**: Xcode Command Line Tools —
    `xcode-select --install`
  - **Linux (Debian/Ubuntu)**:
    ```sh
    sudo apt update
    sudo apt install -y \
      libwebkit2gtk-4.1-dev \
      libgtk-3-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev \
      patchelf \
      build-essential
    ```

### Run in development

```sh
npm install
npm run tauri dev
# or: pnpm tauri dev
```

The first run takes a few minutes — Tauri compiles the Rust backend.
Subsequent runs are fast. A native window titled "Meridian" will open.

### Build a production installer

```sh
npm run tauri build
```

The compiled binary and installer land in `src-tauri/target/release/`
(or `release/bundle/` for the installer):

- **Windows**: `Meridian_x.x.x_x64-setup.exe` and a portable `.exe`
- **macOS**: `Meridian.app` and a `.dmg`
- **Linux**: `.deb`, `.AppImage`, and `.rpm`

### Native shortcuts (desktop)

| Shortcut | Action |
|---|---|
| **Ctrl/Cmd + O** | Open folder |
| **Ctrl/Cmd + Shift + S** | View specimen |
| **Ctrl/Cmd + N** | New chart |
| **Ctrl/Cmd + R** | Re-survey current folder |
| **Ctrl/Cmd + Q** | Quit |
| **F12** | Toggle dev tools (debug build) |

---

## 4. Try the specimen (no folder needed)

The app ships with a small fictional codebase — a harbormaster's
program — that demonstrates the chart without you having to pick a
folder. Click **View specimen** on the landing page. It's two
TypeScript modules and one Python file, designed to showcase
lighthouses, ports of departure, rocks, and a Python island.

---

## 5. Using the chart

Once a chart is drawn:

- **Drag** to pan, **scroll** to zoom, **`0`** to recenter
- **Click any node** to open the right panel with the symbol's
  callers, callees, kind, complexity, and source excerpt
- **`/`** opens a Spotlight-style search
- **`F`** cycles the kind filter (functions → methods → classes)
- **`H`** toggles "hide rocks" (symbols with no incoming or outgoing
  calls)
- **`Ctrl/Cmd + N`** shows only symbols new since the last survey
- **`?`** opens the help overlay with all shortcuts
- Hover the toolbar's **?** button to **take the tour** — a guided
  6-step walkthrough that highlights a specific node and zooms in

The first time you reach the chart, a guided tour plays automatically
and your choice is remembered (`localStorage`).

---

## 6. Troubleshooting

### "Cannot find module @rollup/rollup-linux-x64-gnu" (or similar)

The native rollup binary is corrupted. On Windows this often shows up
as an I/O error in WSL2. Fix:

```sh
rm -rf node_modules package-lock.json pnpm-lock.yaml
npm cache clean --force
npm install
```

On Windows native (not WSL), open PowerShell as Administrator:

```powershell
cd C:\path\to\meridian-atlas
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

### "GTK 3 / gdk-3.0 not found" (Tauri on Linux)

You missed the system packages. Install them:

```sh
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### The chart shows nothing / "No supported source files found"

The folder you picked has no files matching the 9 supported extensions
(`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.go`, `.rs`,
`.java`, `.c`, `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh`, `.h`). Try
pointing it at a single project (e.g. `meridian-atlas/src`) instead of
your home directory.

### "WebGL is not available in this browser"

The 2D chart is rendered with SVG so this shouldn't happen anymore —
but if you see it, your browser has WebGL disabled. Enable it in
`chrome://flags` or `about:config` (Firefox).

### Build is slow / fails on Apple Silicon

Make sure you're on Node 18+ and have the latest Xcode CLT. If
`pnpm install` complains about ARM64 binaries, use `npm install`
instead.

---

## 7. Test, lint, build

```sh
npm test            # one-shot, ~15s
npm run test:watch  # watch mode
npm run test:coverage  # with coverage report
npm run lint        # ESLint
npm run build       # type-check + Vite build
npm run build:tauri # full Tauri installer
```

There are **50 unit tests** across:

- `src/parser/scan.test.ts` — language detection, file limits, scan
  fallback
- `src/graph/interpret.test.ts` — observation generation
- `src/graph/snapshot.test.ts` — survey diff + grade + relative time
- `src/native/fs.test.ts` — Tauri runtime detection

---

## 8. MCP server

Meridian ships with an [MCP](https://modelcontextprotocol.io/) server
so AI agents (Claude Desktop, etc.) can ask questions about your
codebase's structure: lighthouses, dead code, cross-module coupling.

```sh
# Build the MCP bundle
npm run build:mcp

# Add to Claude Desktop
claude mcp add meridian -- npx -y github:RicardoMaas7/meridian-atlas
```

Two tools are exposed:

- `survey <directory>` — parses the directory and returns a textual
  chart with grade, delta, and numbered observations
- `symbol <directory> <name>` — returns the symbol's callers,
  callees, position, and source excerpt

---

## Project layout

```
src/
  ui/              # React components (App, ChartCanvas 2D, SidePanel, Tour)
  graph/           # build, layout, interpretation, snapshots
  parser/          # tree-sitter queries + 9 language specs
  i18n/            # English/Spanish translations
  native/          # Tauri-native commands
  demo/            # Bundled example survey
src-tauri/         # Rust backend (Tauri 2.0)
mcp/               # MCP server source
scripts/           # Build helpers
public/wasm/       # tree-sitter WASM grammars
```

## License

MIT — see [LICENSE](LICENSE).
