import React, { useState, useRef, useEffect } from 'react';
import { Message, Attachment } from './types';
import { sendMessageToGemini } from './services/geminiService';
import { MessageBubble } from './components/MessageBubble';
import { DisclaimerModal } from './components/DisclaimerModal';
import { ThinkingIndicator } from './components/ThinkingIndicator';
import { SuggestionActions } from './components/SuggestionActions';

const INITIAL_MESSAGE: Message = {
  id: 'init-1',
  role: 'model',
  content: '<p>こんにちは。<strong>ユアクラウド会計事務所AI</strong>です。</p><p>税務・会計・経理・法務・労務に関する幅広いご質問にお答えします。</p><p>公的機関の情報を優先的に参照しつつ、信頼できる情報源をもとに回答を作成します。</p><ul><li>「インボイス制度の登録要件は？」(税務)</li><li>「接待交際費の損金算入ルールは？」(経理)</li><li>「36協定の届出について教えて」(労務)</li><li>「契約書の収入印紙の金額は？」(法務)</li></ul><p>また、<strong>資料（PDFや画像）を添付</strong>して質問することも可能です。</p>',
  timestamp: new Date(),
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on load (after disclaimer)
  useEffect(() => {
    if (isDisclaimerAccepted) {
      if (messages.length === 0) {
        setMessages([INITIAL_MESSAGE]);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isDisclaimerAccepted]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Limit size (e.g. 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert("ファイルサイズは10MB以下にしてください。");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        // result is "data:mime;base64,data..."
        const [header, base64Data] = result.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
        
        setPendingAttachments([{
          mimeType,
          data: base64Data,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input to allow selecting the same file again if needed
    e.target.value = '';
  };

  const removeAttachment = () => {
    setPendingAttachments([]);
  };

  const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    
    // Use override text (from suggestions) or input value
    let userText = overrideText !== undefined ? overrideText : inputValue.trim();
    
    // Special handling for initial state suggestions (Context: No prior user questions)
    // If the user clicks suggestions on the very first screen, map them to usage instructions for the AI.
    if (messages.length === 1 && overrideText) {
      if (overrideText === "もっと詳しく教えて") {
        userText = "この「ユアクラウド会計事務所AI」の使い方や、対応している相談範囲について詳しく教えてください。";
      } else if (overrideText === "もっと簡単に説明して") {
        userText = "このAIチャットを使うと何ができるのですか？初心者向けに簡単に説明してください。";
      } else if (overrideText === "具体例を教えて") {
        userText = "このAIチャットで相談できる質問の具体例を、税務・法務・労務などの分野別にいくつか教えてください。";
      }
      // "ユアクラウド会計事務所について教えて" sends the text as is, which is handled by the system prompt's knowledge base.
    }

    const isTextEmpty = !userText;
    const isAttachmentsEmpty = pendingAttachments.length === 0;

    if ((isTextEmpty && isAttachmentsEmpty) || isLoading) return;

    const currentAttachments = [...pendingAttachments];
    
    setInputValue('');
    setPendingAttachments([]);
    
    // Reset textarea height
    if (inputRef.current) {
        inputRef.current.style.height = 'auto';
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      attachments: currentAttachments,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    try {
      const { text, groundingMetadata } = await sendMessageToGemini(messages, userText, currentAttachments);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: text,
        timestamp: new Date(),
        groundingMetadata,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: '<p>申し訳ありません。エラーが発生しました。時間をおいて再度お試しください。</p>',
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleSuggestionClick = (text: string) => {
    handleSendMessage(undefined, text);
  };

  const lastMessage = messages[messages.length - 1];
  const showSuggestions = !isLoading && lastMessage?.role === 'model' && !lastMessage.isError;

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
      <DisclaimerModal onAccept={() => setIsDisclaimerAccepted(true)} />

      {/* Header */}
      <header className="flex-none bg-white border-b border-gray-200 px-6 py-4 shadow-sm z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center bg-blue-600 rounded-lg text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M4.5 9.75a6 6 0 0111.573-2.226 3.75 3.75 0 014.133 4.303A4.5 4.5 0 0118 20.25H6.75a5.25 5.25 0 01-2.25-10.5z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">ユアクラウド会計事務所AI</h1>
              <p className="text-xs text-gray-500 font-medium">税務・会計・経理・法務・労務相談チャット</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://ur-cloud.jp/contact" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
              お問い合わせ
            </a>
            <div className="hidden sm:block text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
              Powered by Gemini 3 Pro
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 scroll-smooth">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && <ThinkingIndicator />}
          {showSuggestions && (
            <SuggestionActions onSelect={handleSuggestionClick} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-none bg-white border-t border-gray-200 p-4 sm:p-6 z-10">
        <div className="max-w-4xl mx-auto relative">
          <div className="bg-gray-100 rounded-2xl border border-gray-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all duration-200 shadow-inner">
            
            {/* Attachment Preview */}
            {pendingAttachments.length > 0 && (
              <div className="px-3 pt-3 pb-1 flex gap-2 overflow-x-auto">
                {pendingAttachments.map((att, idx) => (
                  <div key={idx} className="relative group bg-white border border-gray-200 rounded-lg p-2 flex items-center gap-2 pr-8 shadow-sm">
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded text-lg">
                      {att.mimeType.startsWith('image/') ? '🖼️' : '📄'}
                    </div>
                    <div className="flex flex-col max-w-[150px]">
                      <span className="text-xs font-medium text-gray-700 truncate">{att.name}</span>
                      <span className="text-[10px] text-gray-400">{att.mimeType.split('/')[1]}</span>
                    </div>
                    <button 
                      onClick={removeAttachment}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative flex items-end gap-2 p-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || !isDisclaimerAccepted}
                className="flex-none p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="ファイル(画像・PDF)を添付"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>

              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={isDisclaimerAccepted ? "質問を入力..." : "利用規約に同意してください"}
                disabled={!isDisclaimerAccepted || isLoading}
                className="w-full bg-transparent border-none focus:ring-0 text-gray-800 placeholder-gray-400 resize-none py-3 px-1 min-h-[50px] max-h-[150px] disabled:opacity-50"
                rows={1}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={(!inputValue.trim() && pendingAttachments.length === 0) || isLoading || !isDisclaimerAccepted}
                className={`
                  flex-none mb-1 mr-1 p-3 rounded-xl transition-all duration-200 flex items-center justify-center
                  ${(!inputValue.trim() && pendingAttachments.length === 0) || isLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform active:scale-95'
                  }
                `}
                aria-label="送信"
                title="Shift + Enterで送信"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2 px-1">
            <p className="text-[10px] text-gray-400">
              Shift + Enter で送信
            </p>
            <p className="text-[10px] text-gray-400">
              AIは間違いを犯す可能性があります。必ず専門家（税理士・弁護士等）に確認してください。
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}