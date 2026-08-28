import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './config.js';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/** JST での YYYY-MM-DD。運用は日本時間を基準にする。 */
export function todayJst(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const draftsFile = (date) => path.join(DATA_DIR, 'drafts', `${date}.json`);
const postedFile = () => path.join(DATA_DIR, 'posted.json');
const collectedFile = (date) => path.join(DATA_DIR, 'collected', `${date}.json`);

export function draftId(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);
}

/** 記事URLの正規化。トラッキングパラメータを落として重複判定を安定させる。 */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|oc$|ved$)/i.test(k)) u.searchParams.delete(k);
    }
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

export function saveCollected(date, items) {
  writeJson(collectedFile(date), { date, collectedAt: new Date().toISOString(), items });
}

export function loadCollected(date) {
  return readJson(collectedFile(date), { date, items: [] });
}

export function loadDrafts(date) {
  return readJson(draftsFile(date), { date, drafts: [] });
}

export function saveDrafts(date, drafts) {
  writeJson(draftsFile(date), { date, updatedAt: new Date().toISOString(), drafts });
}

export function upsertDrafts(date, newDrafts) {
  const current = loadDrafts(date);
  const byId = new Map(current.drafts.map((d) => [d.id, d]));
  for (const d of newDrafts) {
    // 既に承認済み・投稿済みのものは上書きしない
    const existing = byId.get(d.id);
    if (existing && (existing.status === 'posted' || existing.status === 'approved')) continue;
    byId.set(d.id, d);
  }
  const merged = [...byId.values()];
  saveDrafts(date, merged);
  return merged;
}

export function updateDraft(date, id, patch) {
  const current = loadDrafts(date);
  const idx = current.drafts.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  current.drafts[idx] = { ...current.drafts[idx], ...patch };
  saveDrafts(date, current.drafts);
  return current.drafts[idx];
}

export function loadPosted() {
  return readJson(postedFile(), { posts: [] });
}

export function recordPosted(entry) {
  const store = loadPosted();
  store.posts.push({ ...entry, postedAt: new Date().toISOString() });
  writeJson(postedFile(), store);
  return store;
}

/** 過去 windowDays 以内に、同じ記事URLまたは同一本文を投稿済みか */
export function isDuplicate({ text, sourceUrl }, windowDays = 30) {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const normalized = sourceUrl ? normalizeUrl(sourceUrl) : null;
  return loadPosted().posts.some((p) => {
    if (new Date(p.postedAt).getTime() < cutoff) return false;
    if (text && p.text === text) return true;
    if (normalized && p.sourceUrl && normalizeUrl(p.sourceUrl) === normalized) return true;
    return false;
  });
}

/** 直近の投稿からの経過分。まだ1件も無ければ null。 */
export function minutesSinceLastPost() {
  const posts = loadPosted().posts;
  if (!posts.length) return null;
  const last = posts.reduce((a, b) => (new Date(a.postedAt) > new Date(b.postedAt) ? a : b));
  return (Date.now() - new Date(last.postedAt).getTime()) / 60000;
}

export function postsToday(date = todayJst()) {
  return loadPosted().posts.filter((p) => todayJst(new Date(p.postedAt)) === date);
}
