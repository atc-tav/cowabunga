// Node-side harness: boots the dev server + a headless Chromium, waits for the
// in-page `window.__testkit`, and hands scenarios a thin driver. Game-agnostic.
//
// Browser note: the Playwright CDN is blocked in this environment, so we point
// at the pre-installed Chromium under /opt/pw-browsers instead of downloading.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright';

const PORT = 5191;

function findBrowser() {
  const base = '/opt/pw-browsers';
  if (existsSync(base)) {
    for (const dir of readdirSync(base)) {
      for (const bin of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        const p = `${base}/${dir}/${bin}`;
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined; // fall back to Playwright's own resolution
}

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: 'localhost', port, path: '/' }, (res) => {
        res.destroy();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`dev server never came up on :${port}`));
        else setTimeout(tick, 300);
      });
    };
    tick();
  });
}

function makeDriver(page, errors) {
  const surf = (id) => `window.__testkit.surfaces[${JSON.stringify(id)}]`;
  return {
    /** (Re)start a scene and pause its loop so scenarios drive it deterministically. */
    async start(sceneKey) {
      await page.evaluate((k) => window.__testkit.game.scene.start(k), sceneKey);
      await page.waitForTimeout(450);
      await page.evaluate((k) => window.__testkit.game.scene.getScene(k).scene.pause(), sceneKey);
    },
    /** Start a scene and let it run live — for the fuzz bot. */
    async startLive(sceneKey) {
      await page.evaluate((k) => window.__testkit.game.scene.start(k), sceneKey);
      await page.waitForTimeout(500);
    },
    /** Hold a key down for `ms` (clears Phaser's edge-triggered-input gotcha). */
    async hold(key, ms) {
      await page.keyboard.down(key);
      await page.waitForTimeout(ms);
      await page.keyboard.up(key);
    },
    async tap(key) {
      await this.hold(key, 60);
    },
    async snapshot(gameId) {
      return page.evaluate((id) => window.__testkit.surfaces[id].snapshot(), gameId);
    },
    async invariants(gameId) {
      return page.evaluate((id) => window.__testkit.surfaces[id].invariants(), gameId);
    },
    async hook(gameId, name, ...args) {
      return page.evaluate(
        ({ id, name, args }) => window.__testkit.surfaces[id].hooks[name](...args),
        { id: gameId, name, args },
      );
    },
    errors: () => errors,
    screenshot: (path) => page.screenshot({ path }),
  };
}

/** Boot everything, run `fn(driver)`, then tear down. Returns fn's result. */
export async function withHarness(fn) {
  const dev = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  });
  let browser;
  try {
    await waitForPort(PORT, 45000);
    browser = await chromium.launch({
      executablePath: findBrowser(),
      args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 448, height: 512 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text());
    });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.__testkit), null, { timeout: 15000 });
    return await fn(makeDriver(page, errors));
  } finally {
    if (browser) await browser.close();
    try {
      process.kill(-dev.pid); // kill the dev-server process group
    } catch {
      /* already gone */
    }
  }
}
