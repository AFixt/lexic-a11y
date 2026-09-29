import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { createAfixtEngineChecker } from './src/afixt-engine.js';

/** Largest document the demo endpoint accepts. */
const MAX_BODY_BYTES = 1024 * 1024;

/** Read a request body, refusing anything over MAX_BODY_BYTES. */
function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

/**
 * Dev-server-only endpoint that runs @afixt/afixt-engine, so the demo's
 * Accessibility check works end to end (issue #155). It is what a host's own
 * server does with `dist/afixt-engine.js`; `apply: 'serve'` keeps it out of
 * `vite build`, and the engine is only loaded on the first request.
 */
function afixtEngineDevEndpoint() {
  let engine;
  let checkerPromise;

  const getChecker = () => {
    // `afixt-engine-v6` is @afixt/afixt-engine 6.x under an npm alias. A plain
    // `@afixt/afixt-engine` devDependency would take that name's top-level
    // slot, which @afixt/a11y-assert 2.x's engine 1.x currently fills, and
    // re-hoist the rules package that engine runs (see package.json overrides).
    checkerPromise ??= import('afixt-engine-v6').then(({ AccessibilityEngine }) => {
      engine = new AccessibilityEngine({ browser: { maxInstances: 1 } });
      // Every rule the engine has, not just its WCAG 2.2 AA default, so the
      // demo also shows best-practice findings such as a skipped heading level
      // (STRUCTURE-08) — the editor itself already prevents most AA failures
      // an author could type, such as an image without alt text.
      return createAfixtEngineChecker(engine, { standards: '*' });
    });
    return checkerPromise;
  };

  return {
    name: 'afixt-engine-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__a11y-check', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end();
          return;
        }
        // Only a JSON request: a cross-site page can POST a "simple" text/plain
        // body without a CORS preflight, which would let any site the developer
        // visits have this machine render arbitrary HTML in headless Chrome.
        if (!/^application\/json\b/.test(request.headers['content-type'] || '')) {
          response.statusCode = 415;
          response.end();
          return;
        }
        try {
          const { html } = JSON.parse(await readBody(request));
          const issues = await (await getChecker())({ html });
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(issues));
        } catch (error) {
          server.config.logger.error(`[a11y-check] ${error.message}`);
          response.statusCode = 500;
          response.end();
        }
      });
      server.httpServer?.once('close', () => engine?.close());
    },
  };
}

export default defineConfig({
  plugins: [react(), afixtEngineDevEndpoint()],
  server: {
    port: 4001,
    open: true,
  },
  build: {
    outDir: 'build',
  },
  esbuild: {
    loader: 'jsx',
    // Treat .js/.jsx in both the library source and the examples as JSX so the
    // example can import straight from src/ with no build step.
    include: /(?:src|examples)\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
});
