import crypto from 'node:crypto';

/** RFC3986 準拠のパーセントエンコード（encodeURIComponent は ! * ' ( ) を残すため補正する） */
export function percentEncode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function nonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * OAuth 1.0a (HMAC-SHA1) の Authorization ヘッダを生成する。
 *
 * JSON ボディの POST では、署名対象に含めるのは URL のクエリパラメータと oauth_* のみで、
 * リクエストボディは含めない（X API v2 の JSON リクエストはこの扱い）。
 *
 * fixedNonce / fixedTimestamp はテストで既知ベクトルを再現するためだけに使う。
 *
 * @param {{method:string,url:string,credentials:object,extraParams?:object,fixedNonce?:string,fixedTimestamp?:string}} args
 */
export function buildOAuth1Header({ method, url, credentials, extraParams = {}, fixedNonce, fixedTimestamp }) {
  const {
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
  } = credentials;

  const u = new URL(url);
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: fixedNonce || nonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: fixedTimestamp || Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  /** 署名基底文字列に含める全パラメータ（クエリ + oauth_* + 追加のフォームパラメータ） */
  const signingParams = { ...oauthParams, ...extraParams };
  for (const [k, v] of u.searchParams.entries()) signingParams[k] = v;

  const paramString = Object.keys(signingParams)
    .map((k) => [percentEncode(k), percentEncode(signingParams[k])])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return (
    'OAuth ' +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(headerParams[k])}"`)
      .join(', ')
  );
}
