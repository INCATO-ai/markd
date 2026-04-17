# Markd

A distraction-free WYSIWYG markdown editor for Windows. Similar in spirit to Typora: rendered view by default, fenced source mode on demand, live preview of images and syntax-highlighted code blocks.

Built on [Tauri 2](https://v2.tauri.app/) (Rust) + [TipTap 2](https://tiptap.dev/) (React 19).

## Status

**Built for internal use at [INCATO](https://incato.com). Best-effort, no SLA, no warranty.**

Published publicly because it solves a real problem and a few people asked. If it works for you, great. If not, patches welcome — see below.

## Features

- WYSIWYG rendered view with a keyboard-shortcut source-mode toggle (Ctrl+/)
- File / Edit / View / Help menubar with native shortcuts
- Recent files, folder-tree sidebar, outline panel
- Find + replace (Ctrl+F / Ctrl+H)
- Auto-save every 30 seconds for named files
- Two themes (light, dark) — extendable via CSS custom properties
- Syntax highlighting for fenced code blocks (via [lowlight](https://github.com/wooorm/lowlight))
- Relative image paths resolve against the current file's directory — your markdown stays portable
- `.md` / `.markdown` / `.mdx` / `.txt` file associations on install
- PDF export via print-to-file with chrome-less print stylesheet

## Known issues

- **Focus mode doesn't dim non-cursor blocks yet.** Typewriter scroll works. Details + investigation notes in the project's internal TODO.
- UNC paths from WSL (`\\wsl.localhost\...`) work for opening markdown files and for the asset protocol that serves relative images, but they can be slow or flaky. Keep files on a local drive if you hit issues.
- Devtools are enabled in the current release binary. Disable by setting `features = []` on the `tauri` dependency in `src-tauri/Cargo.toml` before rebuilding.

## Install

Grab the latest release from [Releases](../../releases):

- **MSI** — for IT-managed installs.
- **NSIS** (`Markd_*-setup.exe`) — for individual users. Uninstaller lands in *Apps & Features*.

Or run the bare `markd.exe` without installation — it's portable.

## Build from source

Requirements: [Node.js 20+](https://nodejs.org), [pnpm 10+](https://pnpm.io), [Rust toolchain](https://rustup.rs), [Visual Studio Build Tools with C++ workload](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows), [WebView2 runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually already installed on Windows 10/11).

```bash
pnpm install
pnpm tauri build
```

Output lands in `src-tauri/target/release/` — `markd.exe`, plus MSI and NSIS installers under `bundle/`.

For development with hot reload:

```bash
pnpm tauri dev
```

### Building from WSL

If you're on WSL like I am, `pnpm tauri build` from ext4 fails because Node (WSL) invokes `cargo.exe` (Windows) and the tauri-cli mangles the returned UNC paths. Workaround: rsync the project to a Windows path first.

```bash
rsync -a --exclude=node_modules --exclude='src-tauri/target' --exclude=dist --exclude=.git . /mnt/c/temp/markd-build/
cmd.exe /c "cd /d C:\temp\markd-build && pnpm install && pnpm tauri build"
```

## Contributing

Bug reports with a minimal reproduction are appreciated — use the issue template. Feature requests are likely to be closed with a polite "not now"; this is a personal-scratch project, not a product.

Pull requests are welcome for:

- Bug fixes
- Themes (add a new CSS file under `src/styles/themes/` and it'll show up in the View menu)
- Accessibility improvements
- Documentation

Please don't open a PR for a large feature without opening an issue first — I'd rather save you the time if it's not going to merge.

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgments

- [Tauri](https://v2.tauri.app/) — the Rust + webview framework
- [TipTap](https://tiptap.dev/) — the editor engine
- [tiptap-markdown](https://github.com/aguingand/tiptap-markdown) — markdown parser/serializer on top of TipTap
- [lowlight](https://github.com/wooorm/lowlight) — syntax highlighting
- [Typora](https://typora.io/) — for the design target
