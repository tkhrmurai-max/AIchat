import React from 'react';

interface SuggestionActionsProps {
  onSelect: (text: string) => void;
}

export const SuggestionActions: React.FC<SuggestionActionsProps> = ({ onSelect }) => {
  const suggestions = [
    { label: "AI簡易見積を試す", icon: "🤖" },
    { label: "ユアクラウドについて", icon: "🏢" },
    { label: "もっと詳しく教えて", icon: "🔍" },
    { label: "具体例を教えて", icon: "📝" },
  ];

  return (
    <div className="flex flex-col items-end sm:items-start sm:ml-[10%] mb-6 animate-fade-in-up">
      <p className="text-xs text-gray-400 mb-2 ml-1">
        続けて追加の質問も可能です
      </p>
      <div className="flex flex-wrap gap-2 justify-end sm:justify-start">
        {suggestions.map((suggestion, index) => {
          const isEstimate = suggestion.label === "AI簡易見積を試す";
          return (
            <button
              key={index}
              onClick={() => onSelect(suggestion.label)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 border
                ${isEstimate 
                  ? 'bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 border-orange-200 hover:from-orange-100 hover:to-orange-200' 
                  : 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300'
                }
              `}
            >
              <span>{suggestion.icon}</span>
              {suggestion.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};