import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// store がデータを書く先を一時ディレクトリに逃がしてから読み込む
process.env.X_NEWS_POSTER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xnp-'));

const { buildOAuth1Header, percentEncode } = await import('../src/lib/oauth1.js');
const { weightedLength, extractUrls } = await import('../src/lib/tweet-length.js');
const { parseFeed, fetchFeed } = await import('../src/lib/feeds.js');
const { validateDraft } = await import('../src/lib/validate.js');
const { isAggregatorUrl } = await import('../src/lib/collect.js');
const store = await import('../src/lib/store.js');

test('percentEncode は RFC3986 の予約文字も符号化する', () => {
  assert.equal(percentEncode("a b!*'()~-._"), 'a%20b%21%2A%27%28%29~-._');
});

test('OAuth 1.0a 署名が公開されている既知ベクトルと一致する', () => {
  const header = buildOAuth1Header({
    method: 'POST',
    url: 'https://api.twitter.com/1/statuses/update.json?include_entities=true',
    credentials: {
      consumerKey: 'xvz1evFS4wEEPTGEFPHBog',
      consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
      accessToken: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
      accessTokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
    },
    extraParams: { status: 'Hello Ladies + Include RT' },
    fixedNonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    fixedTimestamp: '1318622958',
  });
  const signature = decodeURIComponent(header.match(/oauth_signature="([^"]+)"/)[1]);
  // 参照実装 oauth-1.0a と一致することを確認済みの値
  assert.equal(signature, 'IZXxCV6ddNwB2B+jkuNngboxSBE=');
});

test('重み付き文字数は日本語を2、URLを23として数える', () => {
  assert.equal(weightedLength('abcdefghij'), 10);
  assert.equal(weightedLength('会計ソフト'), 10);
  assert.equal(weightedLength('https://example.com/very/long/path/that/is/long'), 23);
  assert.equal(weightedLength('会計 https://example.com'), 28);
});

test('本文からURLを取り出し、末尾の句読点を落とす', () => {
  assert.deepEqual(extractUrls('詳細は https://example.com/a。 こちら'), ['https://example.com/a']);
});

test('RSS と Atom の両方から記事を取り出せる', () => {
  const rss = '<rss><channel><item><title><![CDATA[freee 新機能 &amp; 提供開始]]></title>'
    + '<link>https://example.com/a</link><pubDate>Tue, 25 Aug 2026 09:00:00 +0900</pubDate>'
    + '<description>&lt;p&gt;本文&lt;/p&gt;</description></item></channel></rss>';
  const [item] = parseFeed(rss, { id: 'f', name: 'freee' });
  assert.equal(item.title, 'freee 新機能 & 提供開始');
  assert.equal(item.url, 'https://example.com/a');
  assert.equal(item.summary, '本文');

  const atom = '<feed><entry><title>MF決算</title>'
    + '<link rel="alternate" href="https://example.com/b"/><published>2026-08-26T00:00:00Z</published></entry></feed>';
  assert.equal(parseFeed(atom)[0].url, 'https://example.com/b');
});

test('中継URLを判別する', () => {
  assert.equal(isAggregatorUrl('https://news.google.com/rss/articles/CBMi'), true);
  assert.equal(isAggregatorUrl('https://corp.freee.co.jp/news/1'), false);
});

test('検証: 上限超過・URL欠落・禁止表現を検出する', () => {
  const noUrl = validateDraft({ text: '参考URLがない投稿です。' });
  assert.equal(noUrl.ok, false);
  assert.ok(noUrl.errors.some((e) => e.includes('参考URL')));

  const banned = validateDraft({ text: '必ず節税できます https://example.com/a' });
  assert.equal(banned.ok, false);
  assert.ok(banned.errors.some((e) => e.includes('禁止表現')));

  const tooLong = validateDraft({ text: 'あ'.repeat(200) + ' https://example.com/a' });
  assert.equal(tooLong.ok, false);
  assert.ok(tooLong.errors.some((e) => e.includes('上限')));

  const good = validateDraft({ text: 'インボイス制度の経過措置について公表されました。詳細は https://example.com/a #インボイス' });
  assert.equal(good.ok, true, JSON.stringify(good.errors));
});

test('検証: 断定的な表現は警告になるがエラーにはしない', () => {
  const r = validateDraft({ text: '確実に対象になります https://example.com/x' });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes('確実に')));
});

test('投稿済みの記事URLは重複として弾かれる', () => {
  store.recordPosted({ text: '過去の投稿', sourceUrl: 'https://example.com/dup?utm_source=x', tweetId: '1' });
  const r = validateDraft({ text: '別の本文です https://example.com/other', sourceUrl: 'https://example.com/dup' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('投稿済み')));
});

test('fetchFeed は実際のHTTP応答をパースする', async () => {
  const xml = '<rss><channel><item><title>ローカル記事</title><link>https://example.com/local</link></item></channel></rss>';
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    res.end(xml);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const result = await fetchFeed({ id: 'local', name: 'ローカル', url: `http://127.0.0.1:${port}/feed` });
    assert.equal(result.ok, true);
    assert.equal(result.items[0].title, 'ローカル記事');
  } finally {
    server.close();
  }
});

test('fetchFeed はRSSでない応答をエラーとして返す', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>これはフィードではありません</body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const result = await fetchFeed({ id: 'html', name: 'HTML', url: `http://127.0.0.1:${port}/` });
    assert.equal(result.ok, false);
    assert.match(result.error, /抽出できません/);
  } finally {
    server.close();
  }
});
