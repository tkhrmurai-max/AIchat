/**
 * 依存ライブラリなしの RSS 2.0 / RSS 1.0 (RDF) / Atom パーサ。
 * 記事一覧の取得に必要な最小限のフィールドだけを取り出す。
 */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ENTITIES[n]);
}

function stripCdata(s) {
  const m = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : s;
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, '');
}

function clean(s) {
  if (s === null || s === undefined) return '';
  // description に HTML がエスケープされて入っている例が多いため、
  // 実体参照を戻してからタグを落とし、最後にもう一度実体参照を戻す。
  const decoded = decodeEntities(stripCdata(s));
  return decodeEntities(stripTags(decoded)).replace(/\s+/g, ' ').trim();
}

/** 指定タグの中身を取り出す（名前空間プレフィックス付きも拾う） */
function tagText(block, ...names) {
  for (const name of names) {
    const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${name}>`, 'i');
    const m = block.match(re);
    if (m) {
      const v = clean(m[1]);
      if (v) return v;
    }
  }
  return '';
}

/** Atom の <link href="..."/> を含めたリンク抽出 */
function extractLink(block) {
  const alt = block.match(/<link[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i)
    || block.match(/<link[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']alternate["']/i);
  if (alt) return decodeEntities(alt[1]);

  const href = block.match(/<link[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  if (href) return decodeEntities(href[1]);

  const text = tagText(block, 'link', 'guid', 'id');
  return text;
}

function parseDate(block) {
  const raw = tagText(block, 'pubDate', 'published', 'updated', 'date', 'modified');
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** フィード XML を記事配列に変換する */
export function parseFeed(xml, source = {}) {
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ].map((m) => m[1]);

  return blocks.map((block) => ({
    title: tagText(block, 'title'),
    url: extractLink(block),
    publishedAt: parseDate(block),
    summary: tagText(block, 'description', 'summary', 'content', 'encoded').slice(0, 600),
    sourceId: source.id || null,
    sourceName: source.name || null,
    category: source.category || null,
  })).filter((it) => it.title && it.url);
}

/** 1本のフィードを取得して記事配列を返す */
export async function fetchFeed(source, { timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        // 一部サイトは UA 無しのリクエストを拒否する
        'User-Agent': 'x-news-poster/0.1 (+https://github.com/tkhrmurai-max/AIchat)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      return { ok: false, source, error: `HTTP ${res.status}`, items: [] };
    }
    const xml = await res.text();
    const items = parseFeed(xml, source);
    if (!items.length) {
      return { ok: false, source, error: 'フィードは取得できましたが記事を1件も抽出できませんでした（RSS/Atom ではない可能性）', items: [] };
    }
    return { ok: true, source, items };
  } catch (e) {
    return { ok: false, source, error: e.name === 'AbortError' ? 'タイムアウト' : e.message, items: [] };
  } finally {
    clearTimeout(timer);
  }
}

/** 複数フィードを並行取得する */
export async function fetchAllFeeds(sources, opts) {
  return Promise.all(sources.map((s) => fetchFeed(s, opts)));
}
