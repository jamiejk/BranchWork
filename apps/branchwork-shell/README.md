# BranchWork Electron shell

A thin desktop wrapper that presents the BranchWork web app in a native window
with its own app identity (icon, WM class), and owns the server lifecycle:
if `http://branchwork.local:3210` isn't responding, it starts the dev server
itself (via the repo's `scripts/dev.mjs` preflight, which also picks a free
port) and keeps it running after the window closes.

## Files

- `main.js` — Electron main process: health-check, spawn-if-needed, window.
- `branchwork-shell.sh` — launcher entrypoint (`npx electron`).
- `branchwork.png` — window/app icon.
- `package.json` — declares the `electron` dev dependency.

## Install (as a desktop app)

```bash
cd apps/branchwork-shell
npm install          # installs electron locally
./branchwork-shell.sh
```

For a menu entry, create `~/.local/share/applications/branchwork.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=BranchWork
GenericName=Spatial Writing & Research
Comment=Spatial writing & research canvas
Exec=/path/to/BranchWork/apps/branchwork-shell/branchwork-shell.sh
Icon=branchwork
Terminal=false
Categories=Office;ProjectManagement;
StartupWMClass=branchwork
X-KDE-StartupNotify=true
```

`branchwork.local:3210` must resolve (e.g. a `/etc/hosts` entry pointing it at
`127.0.0.1`) and the repo root is auto-detected relative to `main.js`; set
`BRANCHWORK_ROOT` to override.

## Note on spawn safety

The dev server is started with `spawn(node, [scripts/dev.mjs])` — never
`spawn("npm run dev")`. `spawn()` treats its first argument as a single
executable filename, so a full command line there fails with
`spawn npm run dev ENOENT`, and without an `error` handler on the child that
failure surfaces as an uncaught-exception dialog at startup.
