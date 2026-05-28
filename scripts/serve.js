import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
]);

function safeResolveUrl(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requestPath = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.resolve(root, `.${requestPath}`);
  if (!resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    const filePath = safeResolveUrl(req.url ?? '/');
    if (!filePath) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes.get(ext) ?? 'application/octet-stream';
    const data = await readFile(filePath);

    res.writeHead(200, { 'content-type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

const port = Number(process.env.PORT ?? 5173);
server.listen(port, () => {
  console.log(`CircuitGame dev server running at http://localhost:${port}`);
});
