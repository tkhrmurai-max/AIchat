import React, { useState } from 'react';

interface DisclaimerModalProps {
  onAccept: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ onAccept }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleAccept = () => {
    setIsOpen(false);
    onAccept();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
        <div className="bg-gradient-to-r from-blue-800 to-indigo-900 px-6 py-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>⚖️</span> 利用規約と免責事項
          </h2>
        </div>
        
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-sm text-gray-700 leading-relaxed">
          <p className="font-bold text-base text-gray-900">
            当サービスを利用する前に必ずお読みください。
          </p>
          <ul className="list-disc pl-5 space-y-2 marker:text-blue-600">
            <li>
              当チャットボット「ユアクラウド会計事務所AI」は、Google Gemini AIを利用して回答を生成しています。
            </li>
            <li>
              公的機関の情報を優先的に参照しますが、必要に応じて信頼できる民間情報（法律事務所や会計事務所の解説等）も参照します。<span className="font-bold text-red-600">情報の完全性・正確性を保証するものではありません。</span>
            </li>
            <li>
              当サービスは一般的な情報の提供を目的としています。
              <span className="font-bold text-red-600">
                税理士、弁護士、社会保険労務士などの専門家による独占業務（個別具体的な税務申告代理、法的紛争の代理、社会保険手続きの代行など）を行うものではありません。
              </span>
            </li>
            <li>
              最終的な判断や手続きについては、必ず各分野の専門家または管轄の官公庁にご相談ください。
            </li>
            <li>
              入力情報はAIの改善に使用される可能性があるため、個人情報（氏名、住所、マイナンバー等）や機密情報は入力しないでください。
            </li>
          </ul>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleAccept}
            className="px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            同意して相談を始める
          </button>
        </div>
      </div>
    </div>
  );
};