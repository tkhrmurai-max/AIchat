import React from 'react';
import { Message } from '../types';
import { SourceChips } from './SourceChips';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`}>
      <div
        className={`
          relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-4 shadow-sm
          ${isUser
            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-none'
            : isError
              ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-none'
              : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
          }
        `}
      >
        {/* Role Icon / Avatar */}
        {!isUser && (
          <div className="absolute -left-10 top-0 flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm overflow-hidden">
             {isError ? (
               <span className="text-lg">⚠️</span>
             ) : (
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-600">
                  <path fillRule="evenodd" d="M4.5 9.75a6 6 0 0111.573-2.226 3.75 3.75 0 014.133 4.303A4.5 4.5 0 0118 20.25H6.75a5.25 5.25 0 01-2.25-10.5z" clipRule="evenodd" />
               </svg>
             )}
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-2 mb-3 ${isUser ? 'justify-end' : ''}`}>
            {message.attachments.map((att, idx) => (
              <div key={idx} className="overflow-hidden rounded-lg border border-white/20 bg-black/5 max-w-full">
                {att.mimeType.startsWith('image/') ? (
                  <img 
                    src={`data:${att.mimeType};base64,${att.data}`} 
                    alt="attachment" 
                    className="max-h-60 object-contain bg-white"
                  />
                ) : (
                  <div className={`flex items-center gap-3 p-3 ${isUser ? 'bg-white/10' : 'bg-gray-50'}`}>
                    <span className="text-2xl">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isUser ? 'text-white' : 'text-gray-700'}`}>
                        {att.name || 'ドキュメント'}
                      </p>
                      <p className={`text-xs uppercase ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
                        {att.mimeType.split('/')[1] || 'FILE'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message Content */}
        {message.content && (
          isUser ? (
            <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-light">
              {message.content}
            </div>
          ) : (
            <div 
              className="text-sm sm:text-base prose-content"
              dangerouslySetInnerHTML={{ __html: message.content }} 
            />
          )
        )}

        {/* Sources (Only for model) */}
        {!isUser && !isError && (
          <SourceChips metadata={message.groundingMetadata} />
        )}

        {/* Timestamp */}
        <div className={`text-[10px] mt-2 opacity-60 text-right ${isUser ? 'text-blue-100' : 'text-gray-400'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};