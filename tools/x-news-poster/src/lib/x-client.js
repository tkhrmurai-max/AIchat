import { buildOAuth1Header } from './oauth1.js';

const API_BASE = process.env.X_API_BASE || 'https://api.x.com';

/**
 * 認証情報を環境変数から読む。
 * 既定は OAuth 1.0a ユーザーコンテキスト（開発者ポータルで発行する固定トークン）。
 * ブラウザの認可画面を通らないため、OAuth 2.0 の認可フローで発生する
 * 「アプリにアクセスを許可できません」を回避できる。
 */
export function loadCredentials(env = process.env) {
  const oauth2 = env.X_OAUTH2_ACCESS_TOKEN;
  if (oauth2) {
    return { mode: 'oauth2', bearer: oauth2 };
  }
  return {
    mode: 'oauth1',
    consumerKey: env.X_API_KEY,
    consumerSecret: env.X_API_SECRET,
    accessToken: env.X_ACCESS_TOKEN,
    accessTokenSecret: env.X_ACCESS_TOKEN_SECRET,
  };
}

export function missingCredentialKeys(creds) {
  if (creds.mode === 'oauth2') return creds.bearer ? [] : ['X_OAUTH2_ACCESS_TOKEN'];
  const map = {
    X_API_KEY: creds.consumerKey,
    X_API_SECRET: creds.consumerSecret,
    X_ACCESS_TOKEN: creds.accessToken,
    X_ACCESS_TOKEN_SECRET: creds.accessTokenSecret,
  };
  return Object.keys(map).filter((k) => !map[k]);
}

function authHeader({ method, url, creds }) {
  if (creds.mode === 'oauth2') return `Bearer ${creds.bearer}`;
  return buildOAuth1Header({ method, url, credentials: creds });
}

function readRateLimit(headers) {
  const num = (k) => {
    const v = headers.get(k);
    return v === null ? null : Number(v);
  };
  const reset = num('x-rate-limit-reset');
  return {
    limit: num('x-rate-limit-limit'),
    remaining: num('x-rate-limit-remaining'),
    resetAt: reset ? new Date(reset * 1000).toISOString() : null,
    userLimit24h: num('x-user-limit-24hour-limit'),
    userRemaining24h: num('x-user-limit-24hour-remaining'),
  };
}

/** ステータスコードから、実務上ありがちな原因を日本語で示す */
function explain(status, body) {
  const detail = typeof body === 'object' ? JSON.stringify(body) : String(body);
  switch (status) {
    case 401:
      return `401 Unauthorized: キーまたはトークンが不正です。よくある原因 — (1) Access Token を発行した後にアプリ権限を変更した（権限変更後はトークンの再生成が必要）、(2) キーの前後に空白や改行が混入している、(3) サーバーの時刻が数分以上ずれている。詳細: ${detail}`;
    case 403:
      return `403 Forbidden: 認証は通っていますが操作が許可されていません。よくある原因 — (1) アプリ権限が「Read」のままで「Read and write」になっていない、(2) アプリが Project に紐づいておらず v2 を使えない、(3) 無料プランで許可されていない操作。詳細: ${detail}`;
    case 429:
      return `429 Too Many Requests: レート上限に達しました。x-rate-limit-reset まで待つ必要があります。詳細: ${detail}`;
    default:
      return `HTTP ${status}: ${detail}`;
  }
}

async function request({ method, path, body, creds }) {
  const url = `${API_BASE}${path}`;
  const headers = {
    Authorization: authHeader({ method, url, creds }),
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  const rateLimit = readRateLimit(res.headers);
  if (!res.ok) {
    const err = new Error(explain(res.status, parsed));
    err.status = res.status;
    err.body = parsed;
    err.rateLimit = rateLimit;
    throw err;
  }
  return { data: parsed, rateLimit };
}

/** 認証情報が有効かを確認し、投稿先アカウントを返す */
export async function verifyCredentials(creds = loadCredentials()) {
  const missing = missingCredentialKeys(creds);
  if (missing.length) {
    throw new Error(`環境変数が未設定です: ${missing.join(', ')}`);
  }
  const { data, rateLimit } = await request({
    method: 'GET',
    path: '/2/users/me?user.fields=username,name,id',
    creds,
  });
  return { user: data.data, rateLimit };
}

/**
 * ポストを1件作成する。
 * @param {{text:string, inReplyToTweetId?:string, creds?:object}} args
 */
export async function createPost({ text, inReplyToTweetId, creds = loadCredentials() }) {
  const missing = missingCredentialKeys(creds);
  if (missing.length) {
    throw new Error(`環境変数が未設定です: ${missing.join(', ')}`);
  }
  const body = { text };
  if (inReplyToTweetId) body.reply = { in_reply_to_tweet_id: inReplyToTweetId };

  const { data, rateLimit } = await request({
    method: 'POST',
    path: '/2/tweets',
    body,
    creds,
  });
  const id = data?.data?.id;
  return {
    id,
    url: id ? `https://x.com/i/web/status/${id}` : null,
    rateLimit,
  };
}
