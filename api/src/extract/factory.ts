import type { Config } from '../config.js';
import { AnthropicExtractor, StubExtractor, type Extractor } from './extractor.js';

/**
 * CLAUDE_STUB -> StubExtractor (loadConfig already refuses it in production; checked
 * again here), else ANTHROPIC_API_KEY -> real extractor, else undefined (POST
 * /api/extract answers 503).
 */
export function createExtractor(config: Config): Extractor | undefined {
  if (config.claudeStub) {
    if (config.isProduction) throw new Error('CLAUDE_STUB is forbidden when NODE_ENV=production');
    return new StubExtractor();
  }
  return config.anthropicApiKey
    ? AnthropicExtractor.fromApiKey(config.anthropicApiKey, config.claudeModel)
    : undefined;
}
