<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/14cyX6uKVPmMYbL_amlbHBuVVY_fdxKRW

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## X（旧Twitter）自動投稿ツール

freee・マネーフォワード・会計／税務／労務のニュースを収集し、参考URL付きのX投稿の下書きを生成して、
確認・承認のうえMCP経由で投稿する仕組みを `tools/x-news-poster/` に用意しています。
セットアップと使い方は [tools/x-news-poster/README.md](tools/x-news-poster/README.md) を参照してください。
