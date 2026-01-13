import React, { useState } from 'react';

interface EstimateFormData {
  businessType: '法人' | '個人事業主';
  annualSales: string;
  employees: string;
  software: 'freee' | 'マネーフォワード' | 'その他（移行希望）' | '未導入';
  plan: string;
  consumptionTax: string;
  other: string;
}

interface EstimateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EstimateFormData) => void;
}

export const EstimateFormModal: React.FC<EstimateFormModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<EstimateFormData>({
    businessType: '法人',
    annualSales: '1,000万円未満',
    employees: '1名（ひとり社長/個人）',
    software: 'freee',
    plan: 'おまかせ（おすすめを提案してほしい）',
    consumptionTax: '免税事業者',
    other: ''
  });

  if (!isOpen) return null;

  const handleChange = (key: keyof EstimateFormData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex-none">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🤖</span> AI簡易見積フォーム
          </h2>
          <p className="text-xs text-white/90 mt-1">
            以下の情報を入力していただくと、AIが即座に概算見積もりを提示します。
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Business Type */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">事業形態 <span className="text-red-500">*</span></label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 flex-1">
                <input 
                  type="radio" 
                  name="businessType" 
                  checked={formData.businessType === '法人'}
                  onChange={() => handleChange('businessType', '法人')}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm font-medium">法人</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 flex-1">
                <input 
                  type="radio" 
                  name="businessType" 
                  checked={formData.businessType === '個人事業主'}
                  onChange={() => handleChange('businessType', '個人事業主')}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm font-medium">個人事業主</span>
              </label>
            </div>
          </div>

          {/* Sales */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">年商規模（売上） <span className="text-red-500">*</span></label>
            <select 
              value={formData.annualSales}
              onChange={(e) => handleChange('annualSales', e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              <option>1,000万円未満</option>
              <option>1,000万円〜3,000万円</option>
              <option>3,000万円〜5,000万円</option>
              <option>5,000万円〜1億円</option>
              <option>1億円〜3億円</option>
              <option>3億円〜5億円</option>
              <option>5億円以上</option>
            </select>
          </div>

          {/* Employees */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">従業員数（役員含む） <span className="text-red-500">*</span></label>
            <select 
              value={formData.employees}
              onChange={(e) => handleChange('employees', e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              <option>1名（ひとり社長/個人）</option>
              <option>2〜5名</option>
              <option>6〜10名</option>
              <option>11〜20名</option>
              <option>21〜50名</option>
              <option>51名以上</option>
            </select>
          </div>

          {/* Software */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">利用中の会計ソフト <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <label className={`flex items-center gap-2 cursor-pointer p-3 border rounded-lg transition-colors ${formData.software === 'freee' ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="software" 
                  checked={formData.software === 'freee'}
                  onChange={() => handleChange('software', 'freee')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-bold">freee</span>
              </label>
              <label className={`flex items-center gap-2 cursor-pointer p-3 border rounded-lg transition-colors ${formData.software === 'マネーフォワード' ? 'bg-orange-50 border-orange-300' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="software" 
                  checked={formData.software === 'マネーフォワード'}
                  onChange={() => handleChange('software', 'マネーフォワード')}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm font-bold">マネーフォワード</span>
              </label>
            </div>
             <div className="grid grid-cols-2 gap-2">
               <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                <input 
                  type="radio" 
                  name="software" 
                  checked={formData.software === 'その他（移行希望）'}
                  onChange={() => handleChange('software', 'その他（移行希望）')}
                  className="w-4 h-4 text-gray-500 focus:ring-gray-500"
                />
                <span className="text-sm text-gray-600">その他（移行希望）</span>
              </label>
               <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                <input 
                  type="radio" 
                  name="software" 
                  checked={formData.software === '未導入'}
                  onChange={() => handleChange('software', '未導入')}
                  className="w-4 h-4 text-gray-500 focus:ring-gray-500"
                />
                <span className="text-sm text-gray-600">未導入</span>
              </label>
             </div>
            <p className="text-[10px] text-red-500 mt-1">※原則、freeeまたはマネーフォワードクラウド以外のソフトには対応しておりません（移行が必要です）。</p>
          </div>

          {/* Plan */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">希望サービス・プラン <span className="text-red-500">*</span></label>
            <select 
              value={formData.plan}
              onChange={(e) => handleChange('plan', e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              <option>おまかせ（おすすめを提案してほしい）</option>
              <option>スタンダードプラン</option>
              <option>丸投げプラン</option>
              <option>人事労務プラン</option>
              <option>プレミアムプラン</option>
              <option>社労士プラン</option>
              <option>決算・確定申告のみ</option>
              <option>記帳代行＋決算・確定申告</option>
            </select>
          </div>

          {/* Consumption Tax */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">消費税納税義務 <span className="text-red-500">*</span></label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input 
                  type="radio" 
                  name="consumptionTax" 
                  checked={formData.consumptionTax === '免税事業者'}
                  onChange={() => handleChange('consumptionTax', '免税事業者')}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm">免税事業者</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input 
                  type="radio" 
                  name="consumptionTax" 
                  checked={formData.consumptionTax === '課税事業者（原則課税）'}
                  onChange={() => handleChange('consumptionTax', '課税事業者（原則課税）')}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">課税事業者（原則課税）</span>
                  <span className="text-[10px] text-gray-500">報酬に+20%加算されます</span>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input 
                  type="radio" 
                  name="consumptionTax" 
                  checked={formData.consumptionTax === '課税事業者（簡易課税）'}
                  onChange={() => handleChange('consumptionTax', '課税事業者（簡易課税）')}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">課税事業者（簡易課税）</span>
                  <span className="text-[10px] text-gray-500">報酬に+10%加算されます</span>
                </div>
              </label>
               <label className="flex items-center gap-2 cursor-pointer p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input 
                  type="radio" 
                  name="consumptionTax" 
                  checked={formData.consumptionTax === 'わからない'}
                  onChange={() => handleChange('consumptionTax', 'わからない')}
                  className="w-4 h-4 text-gray-500 focus:ring-gray-500"
                />
                <span className="text-sm">わからない</span>
              </label>
            </div>
          </div>

          {/* Other */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">その他ご要望（オプション等）</label>
            <textarea 
              value={formData.other}
              onChange={(e) => handleChange('other', e.target.value)}
              placeholder="例：インボイス対応について相談したい、給与計算も依頼したい"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none h-20 resize-none"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-gray-100 flex gap-3 flex-none bg-white">
          <button 
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
          >
            キャンセル
          </button>
          <button 
            onClick={handleSubmit}
            className="flex-[2] py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-bold shadow-md transition-all transform active:scale-95 flex items-center justify-center gap-2"
          >
            <span>🚀</span> この内容で見積もり作成
          </button>
        </div>
      </div>
    </div>
  );
};