import { GoogleGenAI } from '@google/genai';
import { loadPolicy } from './config.js';
import { draftId } from './store.js';
import { validateDraft } from './validate.js';
import { weightedLength } from './tweet-length.js';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3-pro-preview';

function apiKey(env = process.env) {
  const key = env.GEMINI_API_KEY || env.API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY が設定されていません。');
  return key;
}

function buildSystemInstruction(policy) {
  return `あなたは日本の会計事務所「${policy.account.name}」（運営: ${policy.account.operator}）のX（旧Twitter）投稿の下書きを作る編集担当です。

読者は中小企業の経営者・経理担当者・士業です。トーン: ${policy.account.voice}

【厳守事項】
1. 事実に忠実であること。与えられた記事に書かれていないことを足さない。数値・期限・制度名は記事とWeb検索で裏取りできたものだけを書く。裏取りできない場合はその論点を本文に書かない。
2. 税務・労務の断定的な助言をしない。「〜と発表されました」「〜が公表されています」のような事実の記述に留め、「必ず節税できる」等の断定・誇大表現は使わない。
3. 制度の話題では、適用時期（いつから／いつまで）と対象者を可能な限り明示する。曖昧なら書かない。
4. 参考URLを本文に必ず1つ入れる。URLは与えられたものをそのまま使い、勝手に作らない。
5. 本文はXの重み付き文字数で280以内（日本語1文字=2、URLは一律23で計算）。URLとハッシュタグを含めて収める。
6. ハッシュタグは最大${policy.content.maxHashtags}個。次から選ぶ: ${policy.content.hashtagPool.join(' ')}
7. 使用禁止の表現: ${(policy.content.bannedPhrases || []).join(' / ')}

【出力形式】
必ず次の形のJSONだけを出力する。前後に説明文やコードフェンスを付けない。
{
  "drafts": [
    {
      "sourceIndex": 0,
      "text": "投稿本文（参考URLを含む）",
      "angle": "この投稿の切り口を一言で",
      "checkPoints": ["有資格者が投稿前に確認すべき論点や前提を具体的に1〜3件"],
      "groundedFacts": ["本文に書いた事実のうち、記事または検索で確認できたものを列挙"],
      "confidence": "high | medium | low"
    }
  ]
}`;
}

function buildUserPrompt({ items, count, videos, notice }) {
  const list = items
    .map((it, i) => {
      const lines = [
        `[${i}] タイトル: ${it.title}`,
        `    URL: ${it.url}`,
        `    媒体: ${it.sourceName || '不明'} / 公開: ${it.publishedAt || '不明'}`,
      ];
      if (it.summary) lines.push(`    概要: ${it.summary.slice(0, 300)}`);
      if (!it.urlResolved) lines.push('    ※このURLは中継URLのままで、配信元URLに解決できていない（この記事は採用しない）');
      return lines.join('\n');
    })
    .join('\n\n');

  const videoBlock = videos && videos.length
    ? `\n\n【関連動画の候補】記事の内容と明確に関連する場合のみ、本文の末尾にURLを1つ添えてよい。関連が薄ければ添えない。\n` +
      videos.map((v, i) => `(${i}) ${v.title} ${v.url}`).join('\n')
    : '';

  return `以下の候補記事から、投稿価値の高いものを${count}件選び、それぞれ1つのX投稿の下書きを作ってください。
同じ話題に偏らないよう、できるだけテーマを分散させてください。
中継URLのままの記事は採用しないでください。

各下書きの本文には、末尾に次の一文の趣旨を必ず含めてください（字数の都合で短縮可）:「${notice}」

【候補記事】
${list}${videoBlock}`;
}

function extractJson(text) {
  const cleaned = String(text).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`モデルの出力からJSONを取り出せませんでした: ${text.slice(0, 300)}`);
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * 記事候補から投稿の下書きを生成する。
 * @param {{items:Array, count?:number, videos?:Array, useSearch?:boolean, model?:string}} args
 */
export async function generateDrafts({
  items,
  count = 3,
  videos = [],
  useSearch = true,
  model = DEFAULT_MODEL,
  policy = loadPolicy(),
} = {}) {
  const usable = items.filter((it) => it.urlResolved !== false);
  if (!usable.length) {
    return { drafts: [], warnings: ['採用できる記事がありません（すべて中継URLのままか、候補が空です）。'] };
  }

  const ai = new GoogleGenAI({ apiKey: apiKey() });
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ text: buildUserPrompt({ items: usable, count, videos, notice: policy.content.requiredNotice }) }],
      },
    ],
    config: {
      systemInstruction: buildSystemInstruction(policy),
      temperature: 0.4,
      ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  const parsed = extractJson(response.text || '');
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

  const drafts = (parsed.drafts || []).map((d) => {
    const source = usable[d.sourceIndex] || null;
    const text = String(d.text || '').trim();
    const draft = {
      id: draftId(text),
      status: 'pending',
      text,
      angle: d.angle || '',
      checkPoints: Array.isArray(d.checkPoints) ? d.checkPoints : [],
      groundedFacts: Array.isArray(d.groundedFacts) ? d.groundedFacts : [],
      confidence: d.confidence || 'medium',
      sourceTitle: source?.title || null,
      sourceUrl: source?.url || null,
      sourceName: source?.sourceName || null,
      publishedAt: source?.publishedAt || null,
      model,
      generatedAt: new Date().toISOString(),
      weightedLength: weightedLength(text),
    };
    draft.validation = validateDraft(draft, { policy });
    return draft;
  });

  return {
    drafts,
    warnings: [],
    groundingSources:
      groundingMetadata?.groundingChunks
        ?.map((c) => c.web && { title: c.web.title, uri: c.web.uri })
        .filter(Boolean) || [],
  };
}
