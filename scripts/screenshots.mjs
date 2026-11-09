import { mkdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = join(root, 'dist');
const docs = join(root, 'docs');
mkdirSync(docs, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function serveDist(port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let url = decodeURIComponent(req.url || '/').split('?')[0];
      // Support GitHub Pages base `/yearbillcard/`
      if (url.startsWith('/yearbillcard')) url = url.slice('/yearbillcard'.length) || '/';
      if (url === '/') url = '/index.html';
      const path = join(dist, url.replace(/^\//, ''));
      if (!path.startsWith(dist) || !existsSync(path) || statSync(path).isDirectory()) {
        res.writeHead(404);
        res.end('not found: ' + url);
        return;
      }
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
      res.end(readFileSync(path));
    });
    server.listen(port, () => resolve(server));
  });
}

const port = 4177;
const server = await serveDist(port);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
await page.goto(`http://127.0.0.1:${port}/yearbillcard/`, { waitUntil: 'networkidle' });
await page.click('#demo');
await page.waitForTimeout(2000);
await page.waitForFunction(() => window.__yearbill?.getStats?.());
await page.screenshot({ path: join(docs, 'main-page.png'), fullPage: true });

async function shotPoster(name) {
  await page.evaluate(() => {
    const el = document.querySelector('.poster');
    if (el) {
      el.classList.remove('scaled');
      el.style.transform = 'none';
    }
  });
  const poster = page.locator('.poster');
  await poster.screenshot({ path: join(docs, name) });
  await page.evaluate(() => {
    const el = document.querySelector('.poster');
    if (el) el.classList.add('scaled');
  });
}

for (const skin of ['midnight', 'peach', 'mint']) {
  await page.evaluate((s) => window.__yearbill.setSkin(s), skin);
  await page.waitForTimeout(400);
  await shotPoster(`poster-${skin}.png`);
}

await page.evaluate(() => window.__yearbill.setPrivacy(true));
await page.waitForTimeout(800);
await page.evaluate(() => window.__yearbill.setSkin('midnight'));
await page.waitForTimeout(400);
await shotPoster('poster-privacy.png');

await browser.close();
server.close();
console.log('screenshots written to docs/');
