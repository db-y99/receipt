import React, { useEffect } from 'react';
import { CustomerData, SlipType } from '../types';
import { FileText, Calculator } from 'lucide-react';

interface InputFormProps {
  data: CustomerData;
  onChange: (data: CustomerData) => void;
}

export const InputForm: React.FC<InputFormProps> = ({ data, onChange }) => {
  const handleChange = (field: keyof CustomerData, value: string | number) => {
    onChange({ ...data, [field]: value });
  };

  const handleTypeChange = (newType: SlipType) => {
    onChange({ ...data, type: newType });
  };

  // Auto-calculate total amount when in SETTLEMENT mode and breakdown fields change
  useEffect(() => {
    if (data.type === 'SETTLEMENT') {
      const total = (data.principal || 0) + (data.interest || 0) + (data.managementFee || 0) + (data.settlementFee || 0);
      // Only update if the total is actually different to avoid loops/re-renders if strict check was used elsewhere
      if (total !== data.amount) {
        onChange({ ...data, amount: total });
      }
    }
  }, [data.principal, data.interest, data.managementFee, data.settlementFee, data.type]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      
      {/* Type Selector */}
      <div className="mb-6 flex p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => handleTypeChange('STANDARD')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
            data.type === 'STANDARD' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Phiếu Thu Thường
        </button>
        <button
          onClick={() => handleTypeChange('SETTLEMENT')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
            data.type === 'SETTLEMENT' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Phiếu Tất Toán
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Thông tin khách hàng</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Họ tên khách hàng</label>
            <input
              type="text"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
              value={data.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Mã khách hàng</label>
            <input
              type="text"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
              value={data.customerId}
              onChange={(e) => handleChange('customerId', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Mã hợp đồng</label>
            <input
              type="text"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
              value={data.contractId}
              onChange={(e) => handleChange('contractId', e.target.value)}
            />
          </div>

           <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">
                {data.type === 'SETTLEMENT' ? 'Tổng tiền (Tự động tính)' : 'Số tiền (VND)'}
            </label>
            <input
              type="number"
              className={`w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 ${data.type === 'SETTLEMENT' ? 'bg-gray-50 font-bold text-blue-700' : ''}`}
              value={data.amount}
              readOnly={data.type === 'SETTLEMENT'}
              onChange={(e) => handleChange('amount', parseInt(e.target.value) || 0)}
            />
          </div>

          {/* Breakdown Fields - Only for SETTLEMENT */}
          {data.type === 'SETTLEMENT' && (
            <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="col-span-2 text-xs font-bold text-blue-800 uppercase tracking-wide">Chi tiết tất toán</div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Gốc</label>
                    <input
                        type="number"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={data.principal}
                        onChange={(e) => handleChange('principal', parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Lãi</label>
                    <input
                        type="number"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={data.interest}
                        onChange={(e) => handleChange('interest', parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Phí QL</label>
                    <input
                        type="number"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={data.managementFee}
                        onChange={(e) => handleChange('managementFee', parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Phí tất toán</label>
                    <input
                        type="number"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={data.settlementFee}
                        onChange={(e) => handleChange('settlementFee', parseInt(e.target.value) || 0)}
                    />
                </div>
            </div>
          )}

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-gray-700">Địa chỉ</label>
            <input
              type="text"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
              value={data.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-gray-700">Thời hạn thanh toán</label>
            <input
              type="date"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
              value={data.deadline}
              onChange={(e) => handleChange('deadline', e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-gray-700">Nội dung chuyển khoản</label>
            <input
              type="text"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
              value={data.transferContent}
              onChange={(e) => handleChange('transferContent', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};