# x-news-poster

freee・マネーフォワード・会計／税務／労務の最新ニュースを収集し、参考URL（と関連動画URL）付きのX投稿の下書きを生成し、**人が確認・承認したうえで**MCP経由でXへ投稿するための仕組みです。

- 依存を増やさないよう、RSS/Atom の解析と OAuth 1.0a 署名は標準モジュールだけで実装しています。
- 下書きは必ず「生成 → 提示 → 承認 → 投稿」の順に進み、未承認の下書きは投稿できません。
- 税務・労務の内容は有資格者の確認を前提としています。下書きには「確認すべき論点（checkPoints）」が付きます。

## 1. セットアップ

```bash
cd tools/x-news-poster
npm install
cp .env.example .env      # 値を埋める
```

### X API の認証情報（重要）

[X Developer Portal](https://developer.x.com/) で **Project に紐づいたアプリ** を作り、次を確認してください。

1. **User authentication settings** で App permissions を **Read and write** にする
2. 権限を変更した場合は **Access Token and Secret を再生成する**（古いトークンは読み取り専用のまま）
3. **Keys and tokens** から次の4つを取得し `.env` に設定する
   - API Key → `X_API_KEY`
   - API Key Secret → `X_API_SECRET`
   - Access Token → `X_ACCESS_TOKEN`
   - Access Token Secret → `X_ACCESS_TOKEN_SECRET`

この4つは開発者ポータルで直接発行するもので、**ブラウザの認可画面を経由しません**。
OAuth 2.0 の認可画面で「問題が発生しました／アプリにアクセスを許可できません」が出る場合の回避策になります。

設定できたら疎通を確認します。

```bash
npm run diagnose
```

`OK: 認証に成功しました。` と投稿先アカウント名が出れば完了です。
失敗した場合、401/403 の代表的な原因を日本語で表示します。

### ニュースソースの確認

このリポジトリの `config/feeds.json` には Google ニュースの検索フィードと、各社・官公庁のフィード候補が入っています。
公式サイトのフィードURLは**未検証**（`verified: false`）なので、実際に到達できるものだけ有効化してください。

```bash
npm run feeds:check
```

`ok` と出たソースだけ `config/feeds.json` で `enabled: true` にします。

### 動画を添えたい場合

`config/feeds.json` の `videoSources` に YouTube チャンネルの RSS を登録します。

```
https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxxxxxxxxxxxxx
```

`channel_id` はチャンネルページのHTMLソースで `"channelId":"UC...` を検索すると分かります。
登録した動画のうち、記事の内容とキーワードが十分重なるものだけが下書きに添えられます。関連が薄ければ動画は付きません。

## 2. Claude から使う（MCP）

リポジトリ直下の `.mcp.json` にこのサーバーが登録済みです。Claude Code をリポジトリ直下で起動すると読み込まれます。
認証情報はシェルの環境変数から渡されるため、リポジトリには入りません。

```bash
export $(grep -v '^#' tools/x-news-poster/.env | xargs)   # もしくは direnv 等
claude
```

### 公開しているツール

| ツール | 用途 |
| --- | --- |
| `x_diagnose` | 認証情報・ポリシー・ソース設定をまとめて診断する。まずこれを実行する |
| `x_verify_credentials` | どのアカウントに投稿されるかを確認する |
| `feeds_check` | 登録フィードの疎通を確認する |
| `news_collect` | ニュースを収集する（重複・投稿済みを除外） |
| `news_draft` | 下書きを生成する（参考URL・確認事項・検証結果つき） |
| `draft_list` | 下書きを一覧する |
| `draft_update` | 下書きの本文を修正する（承認は取り消される） |
| `draft_approve` | 下書きを承認する（検証エラーがあると承認できない） |
| `draft_reject` | 下書きを却下する |
| `x_post_draft` | **承認済み**の下書きを投稿する |
| `x_post_text` | 本文を直接指定して投稿する（`confirmedByUser: true` が必須） |
| `post_history` | 投稿履歴を見る |

### 想定する会話の流れ

```
あなた: 今日のニュースからX投稿の下書きを3件作って
Claude: （news_draft を実行し、本文・参考URL・確認事項を提示）
あなた: 1件目はこの表現を直して。2件目と3件目はOK
Claude: （draft_update → draft_approve → x_post_draft）
```

## 3. 毎日自動で回す（Claude Code の Routine）

Claude に次のように依頼すると、毎朝この流れを自動で開始する Routine が作成されます。

> 毎朝8時に「今日のX投稿の下書きを3件作って提示して」を実行する Routine を作って

Routine は**下書きの生成と提示まで**を行い、投稿はあなたの承認後に行われます
（`config/policy.json` の `requireHumanApproval: true` がこれを強制しています）。

## 4. CLI（MCPを使わない場合）

```bash
node src/cli.js diagnose
node src/cli.js feeds:check
node src/cli.js collect --since 3
node src/cli.js draft --count 3
node src/cli.js list
node src/cli.js approve --id <id>
node src/cli.js post --id <id> --dry-run
node src/cli.js post --id <id>
```

## 5. 投稿ポリシー

`config/policy.json` で制御します。

| 項目 | 既定値 | 意味 |
| --- | --- | --- |
| `maxPostsPerDay` | 3 | 1日の投稿上限 |
| `minMinutesBetweenPosts` | 90 | 連続投稿の最短間隔 |
| `requireHumanApproval` | true | 未承認の下書きの投稿を禁止する |
| `requireSourceUrl` | true | 参考URLのない投稿を禁止する |
| `dedupeWindowDays` | 30 | 同一本文・同一記事URLの再投稿を防ぐ期間 |
| `bannedPhrases` | — | 含まれていたら投稿を止める表現 |
| `cautionPhrases` | — | 含まれていたら警告する（人が判断する）表現 |

文字数はXの重み付き方式（日本語1文字=2、URLは一律23）で280以内かを判定します。

## 6. テスト

```bash
npm test
```

OAuth 1.0a の署名は公開されている既知ベクトルで検証しており、参照実装 `oauth-1.0a` と同じ署名になることを確認しています。

## 7. 注意事項

- X API の無料プランは投稿数の上限が小さく、その内容も改定されています。**運用前に必ず最新のプラン条件を確認してください。** 本ツールは `x-rate-limit-*` ヘッダを応答に含めるため、実際の残数はそこで確認できます。
- 生成された下書きは**税務・労務の最終判断ではありません**。公開前に税理士・社会保険労務士による確認を行ってください。適用年度・対象者・例外の有無は `checkPoints` に列挙されます。
- 収集したニュースの見出しや本文は配信元の著作物です。下書きは要約・論評の範囲に留め、原文の転載は避けてください。
