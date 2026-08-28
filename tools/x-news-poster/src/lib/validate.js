import { loadPolicy } from './config.js';
import { weightedLength, extractUrls, MAX_WEIGHTED_LENGTH } from './tweet-length.js';
import { isDuplicate, minutesSinceLastPost, postsToday } from './store.js';
import { isAggregatorUrl } from './collect.js';

/**
 * 1件の下書きを検証する。
 * errors が空でなければ投稿してはいけない。warnings は人間の判断に委ねる。
 */
export function validateDraft(draft, { policy = loadPolicy(), allowAggregatorUrl = false } = {}) {
  const errors = [];
  const warnings = [];
  const text = String(draft.text || '');

  if (!text.trim()) errors.push('本文が空です。');

  const len = weightedLength(text);
  if (len > MAX_WEIGHTED_LENGTH) {
    errors.push(`本文が${len}文字相当で上限${MAX_WEIGHTED_LENGTH}を超えています（日本語1文字=2、URLは一律23で計算）。`);
  }

  const urls = extractUrls(text);
  if (policy.posting.requireSourceUrl && urls.length === 0) {
    errors.push('参考URLが本文に含まれていません。');
  }
  for (const u of urls) {
    if (isAggregatorUrl(u) && !allowAggregatorUrl) {
      errors.push(`中継URL（${u}）が含まれています。配信元の記事URLに置き換えてください。`);
    }
  }

  for (const phrase of policy.content.bannedPhrases || []) {
    if (text.includes(phrase)) errors.push(`禁止表現「${phrase}」が含まれています。`);
  }
  for (const phrase of policy.content.cautionPhrases || []) {
    if (text.includes(phrase)) {
      warnings.push(`断定的な表現「${phrase}」が含まれています。税務・労務の断定を避けた表現か確認してください。`);
    }
  }

  const hashtags = text.match(/#[^\s#　]+/g) || [];
  if (hashtags.length > (policy.content.maxHashtags ?? 3)) {
    warnings.push(`ハッシュタグが${hashtags.length}件あります（推奨は${policy.content.maxHashtags}件まで）。`);
  }

  if (isDuplicate({ text, sourceUrl: draft.sourceUrl }, policy.posting.dedupeWindowDays)) {
    errors.push('同じ本文または同じ記事URLを既に投稿済みです。');
  }

  return { ok: errors.length === 0, errors, warnings, weightedLength: len, urls };
}

/** 投稿ペース（1日の上限・間隔）を確認する */
export function checkPostingWindow({ policy = loadPolicy() } = {}) {
  const errors = [];
  const today = postsToday();
  if (today.length >= policy.posting.maxPostsPerDay) {
    errors.push(`本日は既に${today.length}件投稿済みで、上限（${policy.posting.maxPostsPerDay}件/日）に達しています。`);
  }
  const since = minutesSinceLastPost();
  if (since !== null && since < policy.posting.minMinutesBetweenPosts) {
    errors.push(
      `前回投稿から${Math.round(since)}分しか経っていません（最短間隔は${policy.posting.minMinutesBetweenPosts}分）。`
    );
  }
  return { ok: errors.length === 0, errors, postedToday: today.length };
}
