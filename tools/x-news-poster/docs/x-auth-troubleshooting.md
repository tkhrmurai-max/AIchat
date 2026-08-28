# X連携でつまずいたときの切り分け

## 症状: 認可画面で「問題が発生しました／アプリにアクセスを許可できません。前に戻ってもう一度ログインしてください。」

これは **X 側の OAuth 2.0 認可画面が、認可リクエストを受け付けなかった**状態です。
Claude 側やネットワーク側の問題ではなく、X Developer Portal のアプリ設定に起因することがほとんどです。

### 本ツールでの回避策（推奨）

この仕組みは **OAuth 1.0a ユーザーコンテキスト**を既定にしています。
開発者ポータルで発行した固定のキーとトークンを使うため、**上記の認可画面自体を通りません**。

`.env` に次の4つを設定するだけで投稿できます。

```
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
```

確認は `npm run diagnose` です。

### それでも OAuth 2.0 の認可画面を使いたい場合の確認順序

上から順に確認してください。上のものほど頻度の高い原因です。

1. **アプリが Project に属しているか**
   Project に紐づいていないスタンドアロンのアプリでは X API v2 を使えません。
   Developer Portal でアプリを Project の下に移動します。

2. **User authentication settings が未設定でないか**
   アプリの設定画面で "User authentication settings" を **Set up** し、
   App permissions、Type of App、Callback URI、Website URL をすべて登録します。
   ここが未設定のままだと認可画面は必ず失敗します。

3. **App permissions が Read and write になっているか**
   読み取り専用のままだと投稿できません。
   **権限を変更したら Access Token を再生成してください。** 変更前に発行したトークンは古い権限のままです。

4. **Callback URI が完全一致しているか**
   スキーム（http/https）、ポート、末尾のスラッシュまで含めて、
   登録した文字列と認可リクエストの `redirect_uri` が1文字も違わないことを確認します。

5. **Type of App と PKCE の組み合わせが合っているか**
   Confidential Client として作成したアプリに `Authorization: Basic` を送らないと `unauthorized_client` になります。
   PKCE のみで進めたい場合はアプリ種別を Native App（Public Client）にして、認証情報を再生成します。

6. **認可の実行環境**
   アプリ内ブラウザ（WebView）では認可が失敗することがあります。
   通常のブラウザで、投稿したいアカウントにログインした状態で試してください。

## 症状: 401 Unauthorized

- キー・トークンの前後に空白や改行が混入していないか
- 権限変更後にトークンを再生成したか
- 実行環境の時刻が数分以上ずれていないか（OAuth 1.0a は `oauth_timestamp` を検証します）

## 症状: 403 Forbidden

認証は通っているが、その操作が許可されていない状態です。

- App permissions が Read のまま
- アプリが Project に紐づいていない
- 契約プランで許可されていない操作

## 症状: 429 Too Many Requests

レート上限です。本ツールは応答に `x-rate-limit-limit` / `x-rate-limit-remaining` / `x-rate-limit-reset` を含めて返すので、
`post_history` や `x_diagnose` で残数とリセット時刻を確認してください。

X API の無料プランの投稿上限は改定が続いており、公開情報の記載も揺れています。
**運用開始前に、契約中のプランの条件を Developer Portal で確認してください（要確認）。**
