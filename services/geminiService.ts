import { GoogleGenAI, Content, Part } from "@google/genai";
import { Message, GroundingMetadata, Attachment } from "../types";

const SYSTEM_INSTRUCTION = `
あなたは日本のビジネス実務（税務・会計・経理・法務・労務）に関する高度なAIアシスタント「ユアクラウド会計事務所AI」です。
以下のルールを厳守して回答してください：

1. **情報の参照**:
   - 必ず **Google検索ツール** を使用して、最新の情報を確認してください。
   - **優先ソース**: 国税庁、厚生労働省、法務省、経済産業省などの公的機関。
   - **許容ソース**: 大手監査法人、税理士法人、法律事務所、信頼できるビジネスメディアの解説記事（公的情報の補足として活用）。

2. **正確性と根拠**:
   - 回答の根拠となる法令、通達、公的ガイドラインを明確に示してください。
   - 最新の法改正に対応した情報を検索してください。

3. **免責事項**:
   - あなたは有資格者ではありません。一般的情報の提供に留め、「個別の判断は専門家にご相談ください」と必ず伝えてください。

4. **出力形式 (HTML)**:
   - 回答は **HTMLタグ** のみを使用して構造化してください。
   - Markdown記法（#や*）は使用しないでください。
   - 以下のタグを適切に使用し、読みやすいレイアウトにしてください：
     - \`<h2>\`, \`<h3>\`: 見出し
     - \`<p>\`: 段落
     - \`<ul>\`, \`<ol>\`, \`<li>\`: リスト
     - \`<strong>\`: 重要なキーワードの強調
     - \`<table>\`, \`<th>\`, \`<td>\`: 表組（必要な場合）
   - \`<html>\`や\`<body>\`タグは不要です。

5. **専門家への相談・依頼の案内（重要）**:
   - ユーザーの質問が以下のような場合、回答の最後に必ず【相談・依頼への誘導アクション】のHTMLブロックを表示してください。
     - **税務**: 申告書の作成、具体的な税額計算、節税スキームの適否
     - **法務**: 契約書の作成・レビュー、紛争解決、交渉、訴訟
     - **労務**: 就業規則の作成、助成金の申請代行、労使トラブルの解決
     - **その他**: 個別具体的な事情に基づく専門的な判断が必要な場合
   
   【相談・依頼への誘導アクション HTML】
   <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
     <div class="flex items-start gap-3">
       <div class="text-2xl">👨‍💼</div>
       <div class="flex-1">
         <p class="text-sm font-bold text-gray-800 mb-1">専門家への相談・依頼が可能です</p>
         <p class="text-xs text-gray-600 mb-3 leading-relaxed">
           この内容は個別の事情により判断が異なる場合があります。
           クラウドパートナーズでは、実績豊富な税理士・弁護士等の専門家への相談や業務依頼を受け付けています。
         </p>
         <div class="flex flex-wrap gap-2">
           <a href="https://ur-cloud.jp/contact" target="_blank" rel="noopener noreferrer" class="flex-1 min-w-[120px] bg-white !text-blue-700 border border-blue-300 hover:bg-blue-50 hover:border-blue-400 text-center py-2 px-3 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-1 !no-underline">
             <span>💬</span> 相談する
           </a>
           <a href="https://ur-cloud.jp/estimate" target="_blank" rel="noopener noreferrer" class="flex-1 min-w-[120px] bg-blue-600 !text-white border border-transparent hover:bg-blue-700 text-center py-2 px-3 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-1 !no-underline">
             <span>📝</span> 見積依頼
           </a>
         </div>
       </div>
     </div>
   </div>

ユーザーの質問に対して、検索結果に基づいた事実をわかりやすく解説してください。
`;

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string,
  attachments: Attachment[] = []
): Promise<{ text: string; groundingMetadata?: GroundingMetadata }> => {
  try {
    // Convert app history to Gemini Content format
    const contents: Content[] = history
      .filter((msg) => !msg.isError)
      .map((msg) => {
        const parts: Part[] = [];
        
        // Add text part
        if (msg.content) {
          parts.push({ text: msg.content });
        }

        // Add attachment parts
        if (msg.attachments && msg.attachments.length > 0) {
          msg.attachments.forEach((att) => {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data,
              },
            });
          });
        }

        return {
          role: msg.role,
          parts: parts,
        };
      });

    // Add the new message
    const currentParts: Part[] = [];
    if (newMessage) {
      currentParts.push({ text: newMessage });
    }
    
    // Add new attachments
    attachments.forEach((att) => {
      currentParts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data,
        },
      });
    });

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
        tools: [{ googleSearch: {} }], // Explicitly enable Search Grounding
      },
    });

    const text = response.text || "申し訳ありません。回答を生成できませんでした。";
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata as GroundingMetadata | undefined;

    return { text, groundingMetadata };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "通信エラーが発生しました。");
  }
};