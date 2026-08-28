#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { loadPolicy, allSources, enabledSources } from '../lib/config.js';
import { fetchFeed } from '../lib/feeds.js';
import { collectNews, collectVideos, matchVideo } from '../lib/collect.js';
import { generateDrafts } from '../lib/draft.js';
import { validateDraft, checkPostingWindow } from '../lib/validate.js';
import { weightedLength } from '../lib/tweet-length.js';
import {
  todayJst, loadDrafts, upsertDrafts, updateDraft, saveCollected, loadCollected,
  recordPosted, loadPosted, draftId,
} from '../lib/store.js';
import { createPost, verifyCredentials, loadCredentials, missingCredentialKeys } from '../lib/x-client.js';

const server = new McpServer({ name: 'x-news-poster', version: '0.1.0' });

const json = (value) => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});
const fail = (message, extra = {}) => ({
  isError: true,
  content: [{ type: 'text', text: JSON.stringify({ error: message, ...extra }, null, 2) }],
});

/** 下書きを人が読みやすい形に整える */
function summarizeDraft(d) {
  return {
    id: d.id,
    status: d.status,
    text: d.text,
    weightedLength: d.weightedLength ?? weightedLength(d.text),
    angle: d.angle,
    confidence: d.confidence,
    sourceTitle: d.sourceTitle,
    sourceUrl: d.sourceUrl,
    publishedAt: d.publishedAt,
    checkPoints: d.checkPoints,
    groundedFacts: d.groundedFacts,
    validation: d.validation,
    postedTweetUrl: d.postedTweetUrl || null,
  };
}

server.registerTool(
  'x_diagnose',
  {
    title: 'X連携の診断',
    description:
      'X APIの認証情報・投稿ポリシー・ニュースソースの設定状態をまとめて確認する。投稿がうまくいかないときに最初に実行する。',
    inputSchema: {
      checkNetwork: z.boolean().optional().describe('X APIへ実際に疎通確認する（既定: true）'),
    },
  },
  async ({ checkNetwork = true }) => {
    const creds = loadCredentials();
    const missing = missingCredentialKeys(creds);
    const policy = loadPolicy();
    const report = {
      authMode: creds.mode === 'oauth2' ? 'OAuth 2.0 ユーザートークン' : 'OAuth 1.0a ユーザーコンテキスト',
      missingEnvVars: missing,
      geminiApiKey: process.env.GEMINI_API_KEY || process.env.API_KEY ? '設定済み' : '未設定',
      enabledNewsSources: enabledSources().length,
      totalNewsSources: allSources().length,
      policy: policy.posting,
      window: checkPostingWindow({ policy }),
    };

    if (missing.length) {
      report.next = `環境変数 ${missing.join(', ')} を設定してください。OAuth 1.0a を使う場合、X Developer Portal のアプリの Keys and tokens から API Key/Secret と Access Token/Secret を発行します（ブラウザの認可画面は不要）。`;
      return json(report);
    }
    if (checkNetwork) {
      try {
        const { user, rateLimit } = await verifyCredentials(creds);
        report.account = user;
        report.rateLimit = rateLimit;
        report.result = 'OK: 認証に成功しました。';
      } catch (e) {
        report.result = 'NG: 認証に失敗しました。';
        report.error = e.message;
        report.hint =
          'アプリ権限が「Read and write」になっているか、権限変更後に Access Token を再生成したか、アプリがProjectに紐づいているかを確認してください。';
      }
    }
    return json(report);
  }
);

server.registerTool(
  'x_verify_credentials',
  {
    title: '投稿先アカウントの確認',
    description: 'X APIの認証情報で /2/users/me を呼び、どのアカウントに投稿されるかを確認する。',
    inputSchema: {},
  },
  async () => {
    try {
      return json(await verifyCredentials());
    } catch (e) {
      return fail(e.message);
    }
  }
);

server.registerTool(
  'feeds_check',
  {
    title: 'ニュースソースの疎通確認',
    description:
      'config/feeds.json に登録された各フィードを実際に取得し、記事を抽出できるかを確認する。enabled=false のものも含めて検査する。',
    inputSchema: {
      includeDisabled: z.boolean().optional().describe('無効なソースも検査する（既定: true）'),
    },
  },
  async ({ includeDisabled = true }) => {
    const sources = includeDisabled ? allSources() : enabledSources();
    const results = await Promise.all(sources.map((s) => fetchFeed(s)));
    return json({
      results: results.map((r) => ({
        id: r.source.id,
        name: r.source.name,
        url: r.source.url,
        enabled: !!r.source.enabled,
        ok: r.ok,
        itemCount: r.items.length,
        error: r.error || null,
        sampleTitle: r.items[0]?.title || null,
      })),
      hint: 'ok=true のソースだけ config/feeds.json で enabled=true にしてください。',
    });
  }
);

server.registerTool(
  'news_collect',
  {
    title: 'ニュース収集',
    description:
      'freee・マネーフォワード・会計/税務/労務の最新ニュースをフィードから収集し、重複と投稿済みを除いて保存する。',
    inputSchema: {
      sinceDays: z.number().int().min(1).max(30).optional().describe('何日以内の記事を対象にするか（既定: 3）'),
      limit: z.number().int().min(1).max(100).optional().describe('最大件数（既定: 40）'),
    },
  },
  async ({ sinceDays = 3, limit = 40 }) => {
    const date = todayJst();
    const { items, failures, sourceCount } = await collectNews({ sinceDays, limit });
    saveCollected(date, items);
    return json({
      date,
      sourceCount,
      collected: items.length,
      unresolvedUrls: items.filter((i) => !i.urlResolved).length,
      failures,
      items: items.map((i) => ({
        title: i.title,
        url: i.url,
        sourceName: i.sourceName,
        publishedAt: i.publishedAt,
        urlResolved: i.urlResolved,
      })),
    });
  }
);

server.registerTool(
  'news_draft',
  {
    title: '投稿下書きの生成',
    description:
      '収集済みのニュースからX投稿の下書きを生成する。各下書きには参考URL・確認すべき論点・検証結果が付く。投稿はまだ行わない。',
    inputSchema: {
      count: z.number().int().min(1).max(10).optional().describe('生成する下書き件数（既定: ポリシーの1日上限）'),
      collectFirst: z.boolean().optional().describe('先にニュース収集も行う（既定: true）'),
      sinceDays: z.number().int().min(1).max(30).optional(),
      includeVideos: z.boolean().optional().describe('設定済みのYouTubeチャンネルから関連動画を探して添える（既定: true）'),
    },
  },
  async ({ count, collectFirst = true, sinceDays = 3, includeVideos = true }) => {
    const date = todayJst();
    const policy = loadPolicy();
    const n = count ?? policy.posting.maxPostsPerDay;

    let items;
    if (collectFirst) {
      const collected = await collectNews({ sinceDays, limit: 40 });
      saveCollected(date, collected.items);
      items = collected.items;
    } else {
      items = loadCollected(date).items;
    }
    if (!items.length) return fail('候補記事がありません。先に news_collect を実行するか、feeds_check でフィードを確認してください。');

    let videos = [];
    if (includeVideos) {
      const v = await collectVideos({});
      videos = v.videos;
    }

    try {
      const { drafts, groundingSources } = await generateDrafts({ items, count: n, videos, policy });
      const merged = upsertDrafts(date, drafts);
      return json({
        date,
        generated: drafts.length,
        totalDraftsToday: merged.length,
        groundingSources,
        drafts: drafts.map(summarizeDraft),
        next:
          'この下書きを利用者に提示し、内容の確認を受けてください。修正は draft_update、承認は draft_approve、投稿は x_post_draft を使います。',
      });
    } catch (e) {
      return fail(e.message);
    }
  }
);

server.registerTool(
  'draft_list',
  {
    title: '下書き一覧',
    description: '指定日（既定は本日・日本時間）の下書きを検証結果つきで一覧する。',
    inputSchema: {
      date: z.string().optional().describe('YYYY-MM-DD（既定: 本日）'),
      status: z.enum(['pending', 'approved', 'posted', 'rejected', 'all']).optional(),
    },
  },
  async ({ date = todayJst(), status = 'all' }) => {
    const { drafts } = loadDrafts(date);
    const filtered = status === 'all' ? drafts : drafts.filter((d) => d.status === status);
    return json({ date, count: filtered.length, drafts: filtered.map(summarizeDraft) });
  }
);

server.registerTool(
  'draft_update',
  {
    title: '下書きの修正',
    description: '下書きの本文を差し替える。修正すると承認は取り消され、再検証される。',
    inputSchema: {
      id: z.string().describe('下書きID'),
      text: z.string().describe('差し替える本文'),
      date: z.string().optional(),
    },
  },
  async ({ id, text, date = todayJst() }) => {
    const current = loadDrafts(date).drafts.find((d) => d.id === id);
    if (!current) return fail(`下書きが見つかりません: ${id}`);
    const next = { ...current, text, weightedLength: weightedLength(text), status: 'pending' };
    next.validation = validateDraft(next);
    const saved = updateDraft(date, id, next);
    return json({ draft: summarizeDraft(saved), note: '修正したため status は pending に戻りました。' });
  }
);

server.registerTool(
  'draft_approve',
  {
    title: '下書きの承認',
    description:
      '利用者が内容を確認したうえで下書きを承認する。検証エラーがある下書きは承認できない。承認は投稿の前提条件。',
    inputSchema: {
      id: z.string(),
      date: z.string().optional(),
      approvedBy: z.string().optional().describe('承認者の名前（記録用）'),
    },
  },
  async ({ id, date = todayJst(), approvedBy = 'user' }) => {
    const current = loadDrafts(date).drafts.find((d) => d.id === id);
    if (!current) return fail(`下書きが見つかりません: ${id}`);
    const validation = validateDraft(current);
    if (!validation.ok) return fail('検証エラーがあるため承認できません。', { errors: validation.errors });
    const saved = updateDraft(date, id, {
      status: 'approved',
      validation,
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
    return json({ draft: summarizeDraft(saved) });
  }
);

server.registerTool(
  'draft_reject',
  {
    title: '下書きの却下',
    description: '投稿しない下書きに印を付ける。',
    inputSchema: { id: z.string(), date: z.string().optional(), reason: z.string().optional() },
  },
  async ({ id, date = todayJst(), reason = '' }) => {
    const saved = updateDraft(date, id, { status: 'rejected', rejectedReason: reason });
    if (!saved) return fail(`下書きが見つかりません: ${id}`);
    return json({ draft: summarizeDraft(saved) });
  }
);

server.registerTool(
  'x_post_draft',
  {
    title: '承認済み下書きをXへ投稿',
    description:
      '承認済み（status=approved）の下書きをXへ投稿する。利用者本人の確認なしに呼び出してはいけない。dryRun=true で投稿せず検証だけ行える。',
    inputSchema: {
      id: z.string().describe('下書きID'),
      date: z.string().optional(),
      dryRun: z.boolean().optional().describe('true なら投稿せず検証結果だけ返す（既定: false）'),
    },
  },
  async ({ id, date = todayJst(), dryRun = false }) => {
    const draft = loadDrafts(date).drafts.find((d) => d.id === id);
    if (!draft) return fail(`下書きが見つかりません: ${id}`);
    if (draft.status === 'posted') return fail('この下書きは既に投稿済みです。', { tweetUrl: draft.postedTweetUrl });

    const policy = loadPolicy();
    if (policy.posting.requireHumanApproval && draft.status !== 'approved') {
      return fail('未承認の下書きは投稿できません。利用者に内容を提示し、draft_approve で承認を受けてください。', {
        status: draft.status,
      });
    }

    const validation = validateDraft(draft, { policy });
    const window = checkPostingWindow({ policy });
    if (!validation.ok) return fail('検証エラーのため投稿しません。', { errors: validation.errors });
    if (!window.ok) return fail('投稿ペースの制限に掛かっています。', { errors: window.errors });

    if (dryRun) return json({ dryRun: true, validation, window, text: draft.text });

    try {
      const result = await createPost({ text: draft.text });
      recordPosted({
        draftId: draft.id,
        text: draft.text,
        sourceUrl: draft.sourceUrl,
        tweetId: result.id,
        tweetUrl: result.url,
      });
      const saved = updateDraft(date, id, {
        status: 'posted',
        postedTweetId: result.id,
        postedTweetUrl: result.url,
      });
      return json({ posted: true, tweetUrl: result.url, rateLimit: result.rateLimit, draft: summarizeDraft(saved) });
    } catch (e) {
      return fail(e.message, { rateLimit: e.rateLimit });
    }
  }
);

server.registerTool(
  'x_post_text',
  {
    title: '本文を指定してXへ投稿',
    description:
      '下書きを経由せず本文を直接投稿する。利用者が本文そのものを提示して投稿を指示した場合にだけ使う。confirmedByUser=true が必須。',
    inputSchema: {
      text: z.string().describe('投稿本文'),
      confirmedByUser: z.boolean().describe('利用者がこの本文をそのまま確認し、投稿に同意した場合のみ true'),
      sourceUrl: z.string().optional().describe('参考記事のURL（重複判定に使う）'),
      dryRun: z.boolean().optional(),
    },
  },
  async ({ text, confirmedByUser, sourceUrl, dryRun = false }) => {
    if (!confirmedByUser) {
      return fail('confirmedByUser が false です。投稿する本文を利用者に提示し、同意を得てから実行してください。');
    }
    const policy = loadPolicy();
    const candidate = { id: draftId(text), text, sourceUrl };
    const validation = validateDraft(candidate, { policy });
    const window = checkPostingWindow({ policy });
    if (!validation.ok) return fail('検証エラーのため投稿しません。', { errors: validation.errors });
    if (!window.ok) return fail('投稿ペースの制限に掛かっています。', { errors: window.errors });
    if (dryRun) return json({ dryRun: true, validation, window, text });

    try {
      const result = await createPost({ text });
      recordPosted({ draftId: candidate.id, text, sourceUrl: sourceUrl || null, tweetId: result.id, tweetUrl: result.url });
      return json({ posted: true, tweetUrl: result.url, rateLimit: result.rateLimit });
    } catch (e) {
      return fail(e.message, { rateLimit: e.rateLimit });
    }
  }
);

server.registerTool(
  'post_history',
  {
    title: '投稿履歴',
    description: 'この仕組みから投稿した履歴を新しい順に返す。重複投稿の確認に使う。',
    inputSchema: { limit: z.number().int().min(1).max(200).optional() },
  },
  async ({ limit = 20 }) => {
    const posts = [...loadPosted().posts].reverse().slice(0, limit);
    return json({ count: posts.length, postedToday: checkPostingWindow().postedToday, posts });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
