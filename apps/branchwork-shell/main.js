// BranchWork desktop shell.
// Owns the server lifecycle (start if not running, keep running on quit) and
// presents the canvas in a real native window with its own app identity.
const { app, BrowserWindow } = require("electron");
const { exec } = require("node:child_process");
const path = require("node:path");

// Repo root when this file lives in <repo>/apps/branchwork-shell.
// Override with BRANCHWORK_ROOT if you relocate the shell elsewhere.
const ROOT = process.env.BRANCHWORK_ROOT || path.resolve(__dirname, "..", "..");

const APP_URL = "http://localhost:3210";
// Use localhost everywhere so storage is shared with the browser.
// (branchwork.local was the old origin — storage is per origin, so
//  a custom hostname splits the data away from browser sessions.)
const NODE_BIN = require("fs").existsSync("/home/jamie/.local/bin/node")
  ? "/home/jamie/.local/bin/node"
  : "node";
const SERVER_ARGS = [path.join(ROOT, "scripts", "dev.mjs")];
const SERVER_CWD = ROOT;
const SERVER_LOG = "/tmp/branchwork-dev.log";
const ICON = path.join(__dirname, "branchwork.png");

let win = null;

function serverUp() {
  return new Promise((resolve) => {
    exec(
      `curl -sf -o /dev/null --max-time 2 ${APP_URL}`,
      (err) => resolve(!err)
    );
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await serverUp()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "BranchWork",
    icon: ICON,
    backgroundColor: "#f4f2ec",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // external links open in the default browser, not inside the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      require("electron").shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  win.loadURL(APP_URL);
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { win = null; });
}

app.whenReady().then(async () => {
  if (!(await serverUp())) {
    const child = require("child_process").spawn(NODE_BIN, SERVER_ARGS, {
      cwd: SERVER_CWD,
      detached: true,
      stdio: ["ignore", require("fs").openSync(SERVER_LOG, "a"), require("fs").openSync(SERVER_LOG, "a")],
    });
    // Without an 'error' handler, a spawn failure becomes an uncaught
    // exception and Electron shows a crash dialog on startup.
    child.on("error", (err) =>
      console.error("failed to start dev server:", err)
    );
    child.unref();
    const ok = await waitForServer();
    if (!ok) {
      // still open the window; Next.js dev may surface its own error page
      console.error("server did not become healthy in time");
    }
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Mac convention; harmless elsewhere
app.on("window-all-closed", () => {
  app.quit();
});
