import React from 'react';

interface SuggestionActionsProps {
  onSelect: (text: string) => void;
}

export const SuggestionActions: React.FC<SuggestionActionsProps> = ({ onSelect }) => {
  const suggestions = [
    { label: "もっと詳しく教えて", icon: "🔍" },
    { label: "もっと簡単に説明して", icon: "💡" },
    { label: "具体例を教えて", icon: "📝" },
    { label: "ユアクラウド会計事務所について教えて", icon: "🏢" },
  ];

  return (
    <div className="flex flex-col items-end sm:items-start sm:ml-[10%] mb-6 animate-fade-in-up">
      <p className="text-xs text-gray-400 mb-2 ml-1">
        続けて追加の質問も可能です
      </p>
      <div className="flex flex-wrap gap-2 justify-end sm:justify-start">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion.label)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-bold rounded-full hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm active:scale-95"
          >
            <span>{suggestion.icon}</span>
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
};