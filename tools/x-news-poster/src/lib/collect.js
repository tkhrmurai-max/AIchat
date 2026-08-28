import { fetchAllFeeds } from './feeds.js';
import { enabledSources, enabledVideoSources, loadPolicy } from './config.js';
import { normalizeUrl, loadPosted } from './store.js';

/** Googleニュース等の中継URLかどうか */
export function isAggregatorUrl(url) {
  return /(^|\.)news\.google\.com$/i.test(safeHost(url));
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * 中継URLから配信元の記事URLを解決する。
 * リダイレクトで別ホストに着地すればそれを採用し、駄目なら本文中の外部リンクを拾う。
 * 解決できない場合は元のURLをそのまま返し、resolved=false を立てる。
 */
export async function resolveFinalUrl(url, { timeoutMs = 15000 } = {}) {
  if (!isAggregatorUrl(url)) return { url, resolved: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; x-news-poster/0.1)' },
    });
    if (res.url && !isAggregatorUrl(res.url)) return { url: res.url, resolved: true };

    const html = await res.text();
    const candidates = [...html.matchAll(/https?:\/\/[^\s"'<>\\]+/g)]
      .map((m) => m[0])
      .filter((u) => {
        const h = safeHost(u);
        return h && !/google\.com$|gstatic\.com$|googleapis\.com$|schema\.org$|w3\.org$/i.test(h);
      });
    if (candidates.length) return { url: candidates[0], resolved: true };
    return { url, resolved: false };
  } catch {
    return { url, resolved: false };
  } finally {
    clearTimeout(timer);
  }
}

function withinDays(iso, days) {
  if (!iso) return true; // 日付が取れないフィードもあるので落とさない
  return Date.now() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
}

/**
 * 有効なニュースソースから記事を集め、重複と投稿済みを除いて返す。
 * @param {{sinceDays?:number, limit?:number, resolveUrls?:boolean}} opts
 */
export async function collectNews({ sinceDays = 3, limit = 40, resolveUrls = true } = {}) {
  const sources = enabledSources();
  const results = await fetchAllFeeds(sources);

  const failures = results.filter((r) => !r.ok).map((r) => ({
    source: r.source.name,
    url: r.source.url,
    error: r.error,
  }));

  const postedUrls = new Set(
    loadPosted().posts.filter((p) => p.sourceUrl).map((p) => normalizeUrl(p.sourceUrl))
  );

  const seen = new Set();
  let items = [];
  for (const r of results) {
    for (const item of r.items) {
      if (!withinDays(item.publishedAt, sinceDays)) continue;
      const key = normalizeUrl(item.url);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ ...item, alreadyPosted: postedUrls.has(key) });
    }
  }

  items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  items = items.filter((i) => !i.alreadyPosted).slice(0, limit);

  if (resolveUrls) {
    // 中継URLだけ、同時実行数を抑えて解決する
    const targets = items.filter((i) => isAggregatorUrl(i.url));
    const chunkSize = 5;
    for (let i = 0; i < targets.length; i += chunkSize) {
      const chunk = targets.slice(i, i + chunkSize);
      const resolved = await Promise.all(chunk.map((it) => resolveFinalUrl(it.url)));
      chunk.forEach((it, idx) => {
        it.originalUrl = it.url;
        it.url = resolved[idx].url;
        it.urlResolved = resolved[idx].resolved;
      });
    }
  }
  for (const it of items) if (it.urlResolved === undefined) it.urlResolved = true;

  return { items, failures, sourceCount: sources.length };
}

/** 有効な動画ソース（YouTubeチャンネルRSS）から最近の動画を集める */
export async function collectVideos({ sinceDays = 30, limit = 30 } = {}) {
  const sources = enabledVideoSources();
  if (!sources.length) return { videos: [], failures: [] };
  const results = await fetchAllFeeds(sources);
  const videos = [];
  for (const r of results) {
    for (const item of r.items) {
      if (!withinDays(item.publishedAt, sinceDays)) continue;
      videos.push(item);
    }
  }
  videos.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  return {
    videos: videos.slice(0, limit),
    failures: results.filter((r) => !r.ok).map((r) => ({ source: r.source.name, error: r.error })),
  };
}

/** ニュース見出しと動画タイトルのキーワード重なりで、関連しそうな動画を選ぶ */
export function matchVideo(newsTitle, videos, { minOverlap = 2 } = {}) {
  const tokens = (s) =>
    new Set(
      String(s)
        .replace(/[「」『』（）()【】、。,.!?：:／/]/g, ' ')
        .split(/\s+/)
        .flatMap((w) => (/[ぁ-んァ-ヶ一-龠]/.test(w) ? ngrams(w, 2) : [w.toLowerCase()]))
        .filter((w) => w.length >= 2)
    );
  const a = tokens(newsTitle);
  let best = null;
  let bestScore = 0;
  for (const v of videos) {
    const b = tokens(v.title);
    let score = 0;
    for (const t of a) if (b.has(t)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return bestScore >= minOverlap ? { video: best, score: bestScore } : null;
}

function ngrams(s, n) {
  const out = [];
  for (let i = 0; i + n <= s.length; i += 1) out.push(s.slice(i, i + n));
  return out;
}

export { loadPolicy };
