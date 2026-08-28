#!/usr/bin/env node
/**
 * MCP を使わずに手元で動作確認・運用するための CLI。
 * 使い方: node src/cli.js <command> [options]
 */
import { allSources, enabledSources, loadPolicy } from './lib/config.js';
import { fetchFeed } from './lib/feeds.js';
import { collectNews, collectVideos } from './lib/collect.js';
import { generateDrafts } from './lib/draft.js';
import { validateDraft, checkPostingWindow } from './lib/validate.js';
import {
  todayJst, saveCollected, loadCollected, loadDrafts, upsertDrafts, updateDraft,
  recordPosted, loadPosted,
} from './lib/store.js';
import { createPost, verifyCredentials, loadCredentials, missingCredentialKeys } from './lib/x-client.js';

const [, , command, ...rest] = process.argv;

function flag(name, fallback) {
  const i = rest.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = rest[i + 1];
  if (next === undefined || next.startsWith('--')) return true;
  return next;
}

function print(value) {
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

const commands = {
  async diagnose() {
    const creds = loadCredentials();
    const missing = missingCredentialKeys(creds);
    print({
      authMode: creds.mode,
      missingEnvVars: missing,
      geminiApiKey: process.env.GEMINI_API_KEY || process.env.API_KEY ? '設定済み' : '未設定',
      enabledNewsSources: enabledSources().length,
      window: checkPostingWindow(),
    });
    if (missing.length) {
      print(`\n環境変数が足りません: ${missing.join(', ')}`);
      return;
    }
    try {
      print(await verifyCredentials(creds));
      print('\nOK: 認証に成功しました。');
    } catch (e) {
      print(`\nNG: ${e.message}`);
      process.exitCode = 1;
    }
  },

  async 'feeds:check'() {
    const results = await Promise.all(allSources().map((s) => fetchFeed(s)));
    for (const r of results) {
      const mark = r.ok ? 'ok ' : 'NG ';
      const state = r.source.enabled ? 'enabled ' : 'disabled';
      print(`${mark} [${state}] ${r.source.name} (${r.items.length}件) ${r.ok ? '' : '- ' + r.error}`);
      if (r.ok) print(`      例: ${r.items[0].title}`);
      print(`      ${r.source.url}`);
    }
    print('\nok のソースだけ config/feeds.json で enabled=true にしてください。');
  },

  async collect() {
    const date = todayJst();
    const result = await collectNews({
      sinceDays: Number(flag('since', 3)),
      limit: Number(flag('limit', 40)),
    });
    saveCollected(date, result.items);
    print({
      date,
      collected: result.items.length,
      failures: result.failures,
      items: result.items.map((i) => ({ title: i.title, url: i.url, publishedAt: i.publishedAt, urlResolved: i.urlResolved })),
    });
  },

  async draft() {
    const date = todayJst();
    const policy = loadPolicy();
    const count = Number(flag('count', policy.posting.maxPostsPerDay));
    let items = loadCollected(date).items;
    if (!items.length || flag('collect', false)) {
      const collected = await collectNews({ sinceDays: Number(flag('since', 3)) });
      saveCollected(date, collected.items);
      items = collected.items;
    }
    if (!items.length) {
      print('候補記事がありません。feeds:check でフィードを確認してください。');
      process.exitCode = 1;
      return;
    }
    const { videos } = await collectVideos({});
    const { drafts, groundingSources } = await generateDrafts({ items, count, videos, policy });
    upsertDrafts(date, drafts);
    print({ date, generated: drafts.length, groundingSources, drafts });
  },

  async list() {
    const date = String(flag('date', todayJst()));
    const { drafts } = loadDrafts(date);
    for (const d of drafts) {
      print(`\n--- ${d.id} [${d.status}] ${d.weightedLength}/280 ---`);
      print(d.text);
      if (d.checkPoints?.length) print(`確認事項: ${d.checkPoints.join(' / ')}`);
      if (d.validation && !d.validation.ok) print(`エラー: ${d.validation.errors.join(' / ')}`);
      if (d.validation?.warnings?.length) print(`注意: ${d.validation.warnings.join(' / ')}`);
    }
    if (!drafts.length) print('下書きはありません。');
  },

  async approve() {
    const date = String(flag('date', todayJst()));
    const id = String(flag('id', ''));
    const draft = loadDrafts(date).drafts.find((d) => d.id === id);
    if (!draft) {
      print(`下書きが見つかりません: ${id}`);
      process.exitCode = 1;
      return;
    }
    const validation = validateDraft(draft);
    if (!validation.ok) {
      print({ error: '検証エラーのため承認できません', errors: validation.errors });
      process.exitCode = 1;
      return;
    }
    print(updateDraft(date, id, { status: 'approved', validation, approvedAt: new Date().toISOString() }));
  },

  async post() {
    const date = String(flag('date', todayJst()));
    const id = String(flag('id', ''));
    const dryRun = flag('dry-run', false) !== false;
    const policy = loadPolicy();
    const draft = loadDrafts(date).drafts.find((d) => d.id === id);
    if (!draft) {
      print(`下書きが見つかりません: ${id}`);
      process.exitCode = 1;
      return;
    }
    if (policy.posting.requireHumanApproval && draft.status !== 'approved') {
      print('未承認の下書きは投稿できません。先に approve --id <id> を実行してください。');
      process.exitCode = 1;
      return;
    }
    const validation = validateDraft(draft, { policy });
    const window = checkPostingWindow({ policy });
    if (!validation.ok || !window.ok) {
      print({ errors: [...validation.errors, ...window.errors] });
      process.exitCode = 1;
      return;
    }
    if (dryRun) {
      print({ dryRun: true, text: draft.text, validation, window });
      return;
    }
    const result = await createPost({ text: draft.text });
    recordPosted({ draftId: draft.id, text: draft.text, sourceUrl: draft.sourceUrl, tweetId: result.id, tweetUrl: result.url });
    updateDraft(date, id, { status: 'posted', postedTweetId: result.id, postedTweetUrl: result.url });
    print({ posted: true, tweetUrl: result.url, rateLimit: result.rateLimit });
  },

  async history() {
    print(loadPosted());
  },

  async help() {
    print(`x-news-poster CLI

  diagnose                       X API の認証情報と設定を確認する
  feeds:check                    登録済みフィードの疎通を確認する
  collect [--since 3] [--limit 40]
                                 ニュースを収集して保存する
  draft [--count 3] [--collect]  下書きを生成する
  list [--date YYYY-MM-DD]       下書きを一覧する
  approve --id <id>              下書きを承認する
  post --id <id> [--dry-run]     承認済みの下書きを投稿する（--dry-run で検証のみ）
  history                        投稿履歴を表示する`);
  },
};

const run = commands[command] || commands.help;
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
