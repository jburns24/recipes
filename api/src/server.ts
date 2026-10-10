// API entry point: loads config, wires auth and the extractor, and starts the Hono server.
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createAuthenticator } from './auth.js';
import { loadConfig } from './config.js';
import { createExtractor } from './extract/factory.js';
import { createStore } from './store/index.js';

// Everything is validated up front: bad/unsafe config throws before listening.
const config = loadConfig(process.env);
const store = createStore(process.env);
const auth = createAuthenticator(config);
const extractor = createExtractor(config);

const app = createApp({ store, auth, extractor });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `API listening on http://localhost:${info.port} ` +
      `(auth=${config.authMode}, extractor=${config.claudeStub ? 'stub' : extractor ? 'claude' : 'disabled'})`,
  );
});
