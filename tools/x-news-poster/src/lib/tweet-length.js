/**
 * X の重み付き文字数カウント。
 * 既定の設定（twitter-text v3 configuration v3）では
 *   - 基本重み 200（= 2文字ぶん）
 *   - ラテン文字・記号など下記コードポイント範囲は重み 100（= 1文字ぶん）
 *   - 上限は 280（scale=100 なので内部的には 28000）
 *   - URL は t.co に短縮されるため一律 23 文字として数える
 * 日本語は 1 文字 = 2 としてカウントされる。
 */
const LIGHT_RANGES = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2032],
  [0x203e, 0x203e],
  [0x2070, 0x209f],
];

export const MAX_WEIGHTED_LENGTH = 280;
export const TRANSFORMED_URL_LENGTH = 23;

/** 本文中の URL を素朴に抽出する（http/https のみを対象にする） */
export const URL_RE = /https?:\/\/[^\s　]+/g;

function charWeight(codePoint) {
  for (const [lo, hi] of LIGHT_RANGES) {
    if (codePoint >= lo && codePoint <= hi) return 1;
  }
  return 2;
}

/** X の数え方に合わせた重み付き文字数を返す */
export function weightedLength(text) {
  const urls = text.match(URL_RE) || [];
  let rest = text;
  for (const url of urls) rest = rest.replace(url, '');

  let total = urls.length * TRANSFORMED_URL_LENGTH;
  for (const ch of rest) total += charWeight(ch.codePointAt(0));
  return total;
}

export function remainingLength(text) {
  return MAX_WEIGHTED_LENGTH - weightedLength(text);
}

export function extractUrls(text) {
  return (text.match(URL_RE) || []).map((u) => u.replace(/[)\]、。,.]+$/, ''));
}
