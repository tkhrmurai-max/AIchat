import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');

/** 設定・データの置き場所。X_NEWS_POSTER_DATA_DIR で外に逃がせる。 */
export const DATA_DIR = process.env.X_NEWS_POSTER_DATA_DIR || path.join(ROOT, 'data');
export const CONFIG_DIR = process.env.X_NEWS_POSTER_CONFIG_DIR || path.join(ROOT, 'config');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadFeedsConfig() {
  return readJson(path.join(CONFIG_DIR, 'feeds.json'));
}

export function loadPolicy() {
  return readJson(path.join(CONFIG_DIR, 'policy.json'));
}

/** enabled のニュースソースだけを返す */
export function enabledSources(cfg = loadFeedsConfig()) {
  return (cfg.sources || []).filter((s) => s.enabled);
}

export function enabledVideoSources(cfg = loadFeedsConfig()) {
  return (cfg.videoSources || []).filter((s) => s.enabled);
}

/** すべてのソース（無効なものも含む）。疎通確認で使う。 */
export function allSources(cfg = loadFeedsConfig()) {
  return [...(cfg.sources || []), ...(cfg.videoSources || [])];
}
