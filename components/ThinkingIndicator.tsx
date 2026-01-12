import React from 'react';

export const ThinkingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start mb-6">
       <div className="relative max-w-[85%] sm:max-w-[75%] bg-white border border-gray-100 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex items-center gap-3">
          <div className="absolute -left-10 top-0 flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm overflow-hidden">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-600">
                <path fillRule="evenodd" d="M4.5 9.75a6 6 0 0111.573-2.226 3.75 3.75 0 014.133 4.303A4.5 4.5 0 0118 20.25H6.75a5.25 5.25 0 01-2.25-10.5z" clipRule="evenodd" />
             </svg>
          </div>
          <div className="text-sm text-gray-500 font-medium">公的情報を検索中...</div>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
          </div>
       </div>
    </div>
  );
};