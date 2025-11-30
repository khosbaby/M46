import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();
const serverDir = join(projectRoot, '.next', 'server');
const manifestPath = join(serverDir, 'middleware-manifest.json');

function ensureManifest() {
  try {
    mkdirSync(serverDir, { recursive: true });
    if (!existsSync(manifestPath)) {
      const payload = {
        version: 3,
        middleware: {},
        functions: {},
        sortedMiddleware: [],
        clientInfo: {},
      };
      writeFileSync(manifestPath, JSON.stringify(payload, null, 2));
    }
  } catch (error) {
    console.warn('[ensure-dev-manifest]', error);
  }
}

ensureManifest();
