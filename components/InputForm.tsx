import React, { useEffect, useRef } from 'react';
import { CustomerData, SlipType } from '../types';
import { FileText, Calculator, RefreshCw } from 'lucide-react';

interface InputFormProps {
  data: CustomerData;
  onChange: (data: CustomerData) => void;
}

export const InputForm: React.FC<InputFormProps> = ({ data, onChange }) => {
  const addressTextareaRef = useRef<HTMLTextAreaElement>(null);
  const transferContentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isTransferContentManuallyEdited = useRef(false);

  // Format number with thousand separators
  const formatNumber = (num: number): string => {
    if (!num || num === 0) return '';
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  // Parse number from input, handling thousand separators and decimals
  // Removes commas and dots used as thousand separators
  const parseNumberInput = (value: string): number => {
    if (!value || value === '') return 0;
    
    // Remove all spaces
    let cleaned = value.replace(/\s/g, '');
    
    // Handle Vietnamese format: dots are thousand separators
    // Remove dots that are followed by exactly 3 digits (thousand separator)
    // Keep dots that might be decimals (followed by 1-2 digits)
    // But since we use parseInt, we'll remove all dots and commas
    // For better UX, we'll detect if it's likely a decimal or thousand separator
    
    // Remove commas (always thousand separators in numbers)
    cleaned = cleaned.replace(/,/g, '');
    
    // Remove dots - in Vietnamese format, dots are thousand separators
    // But we need to be smart: if there's only one dot and it's followed by 1-2 digits, it might be a decimal
    // However, since the fields use parseInt, we'll treat all dots as thousand separators
    cleaned = cleaned.replace(/\./g, '');
    
    // Parse as integer (since the original code uses parseInt)
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Handle paste event for number inputs
  const handleNumberPaste = (e: React.ClipboardEvent<HTMLInputElement>, field: keyof CustomerData) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const cleanedValue = parseNumberInput(pastedText);
    handleChange(field, cleanedValue);
  };

  // Remove Vietnamese accents
  const removeVietnameseAccents = (str: string): string => {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  };

  // Generate transfer content in format: Họ tên KH Mã hđ Goc [số tiền] Lai [số tiền] PhiQL [số tiền] Phi Phat [số tiền] PhiTatToan [số tiền]
  // Limited to 95 characters for QR code compatibility
  // Abbreviations: Gốc = Goc, Lãi = Lai, Phí QL = PhiQL, Phí phạt = Phi Phat, Phí tất toán = PhiTatToan
  // Note: Numbers in transfer content should NOT have thousand separators (dots)
  const generateTransferContent = (): string => {
    const parts: string[] = [];
    
    if (data.fullName) parts.push(removeVietnameseAccents(data.fullName));
    if (data.contractId) parts.push(removeVietnameseAccents(data.contractId));
    if (data.principal && data.principal > 0) parts.push(removeVietnameseAccents(`Goc ${data.principal}`));
    if (data.interest && data.interest > 0) parts.push(removeVietnameseAccents(`Lai ${data.interest}`));
    if (data.managementFee && data.managementFee > 0) parts.push(removeVietnameseAccents(`PhiQL ${data.managementFee}`));
    if (data.overdueFee && data.overdueFee > 0) parts.push(removeVietnameseAccents(`Phi Phat ${data.overdueFee}`));
    if (data.settlementFee && data.settlementFee > 0) parts.push(removeVietnameseAccents(`PhiTatToan ${data.settlementFee}`));
    
    const content = parts.join(' ');
    // Limit to 95 characters
    return content.length > 95 ? content.substring(0, 95) : content;
  };

  const handleChange = (field: keyof CustomerData, value: string | number) => {
    const updatedData = { ...data, [field]: value };
    
    // Auto-calculate total immediately when any amount field changes
    if (field === 'principal' || field === 'interest' || field === 'managementFee' || 
        field === 'settlementFee' || field === 'overdueFee') {
      const total = (updatedData.principal || 0) + (updatedData.interest || 0) + 
                    (updatedData.managementFee || 0) + (updatedData.settlementFee || 0) + 
                    (updatedData.overdueFee || 0);
      updatedData.amount = total;
    }
    
    onChange(updatedData);
  };

  const handleTypeChange = (newType: SlipType) => {
    onChange({ ...data, type: newType });
  };

  // Auto-resize textarea
  const handleTextareaChange = (field: keyof CustomerData, value: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Auto-remove accents for transferContent
    let processedValue = value;
    if (field === 'transferContent') {
      processedValue = removeVietnameseAccents(value);
      // Limit to 95 characters
      if (processedValue.length > 95) {
        processedValue = processedValue.substring(0, 95);
      }
      isTransferContentManuallyEdited.current = true;
    }
    
    onChange({ ...data, [field]: processedValue });
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  // Auto-resize textareas when data changes externally (e.g., QR scan)
  useEffect(() => {
    const resizeTextarea = (textarea: HTMLTextAreaElement | null) => {
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    };

    resizeTextarea(addressTextareaRef.current);
    resizeTextarea(transferContentTextareaRef.current);
  }, [data.address, data.transferContent]);

  // Auto-calculate total amount when breakdown fields change (backup calculation)
  // Note: Main calculation is now in handleChange for immediate updates
  useEffect(() => {
    const total = (data.principal || 0) + (data.interest || 0) + (data.managementFee || 0) + (data.settlementFee || 0) + (data.overdueFee || 0);
    // Only update if the total is actually different to avoid loops/re-renders
    if (total !== data.amount) {
      onChange({ ...data, amount: total });
    }
  }, [data.principal, data.interest, data.managementFee, data.settlementFee, data.overdueFee]);

  // Auto-generate transfer content when relevant fields change
  useEffect(() => {
    // Only auto-generate if user hasn't manually edited
    if (!isTransferContentManuallyEdited.current) {
      const generatedContent = generateTransferContent();
      if (generatedContent !== data.transferContent) {
        onChange({ ...data, transferContent: generatedContent });
      }
    }
  }, [data.fullName, data.contractId, data.principal, data.interest, data.managementFee, data.overdueFee, data.settlementFee]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Họ tên khách hàng</label>
            <input
              type="text"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 min-w-0"
              value={data.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Mã khách hàng</label>
            <input
              type="text"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 min-w-0"
              value={data.customerId}
              onChange={(e) => handleChange('customerId', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Mã hợp đồng</label>
            <input
              type="text"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 min-w-0"
              value={data.contractId}
              onChange={(e) => handleChange('contractId', e.target.value)}
            />
          </div>

           <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">
                Tổng tiền (Tự động tính)
            </label>
            <input
              type="text"
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 bg-gray-50 font-bold text-blue-700"
              value={formatNumber(data.amount)}
              readOnly={true}
            />
          </div>

          {/* Breakdown Fields - For both STANDARD and SETTLEMENT */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="col-span-2 text-xs font-bold text-blue-800 uppercase tracking-wide">
                    {data.type === 'SETTLEMENT' ? 'Chi tiết tất toán' : 'Chi tiết thanh toán'}
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Gốc</label>
                    <input
                        type="number"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={data.principal || ''}
                        onChange={(e) => {
                          const val = parseNumberInput(e.target.value);
                          handleChange('principal', val);
                        }}
                        onPaste={(e) => handleNumberPaste(e, 'principal')}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Lãi</label>
                    <input
                        type="number"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={data.interest || ''}
                        onChange={(e) => {
                          const val = parseNumberInput(e.target.value);
                          handleChange('interest', val);
                        }}
                        onPaste={(e) => handleNumberPaste(e, 'interest')}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Phí QL</label>
                    <input
                        type="number"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={data.managementFee || ''}
                        onChange={(e) => {
                          const val = parseNumberInput(e.target.value);
                          handleChange('managementFee', val);
                        }}
                        onPaste={(e) => handleNumberPaste(e, 'managementFee')}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Phí tất toán</label>
                    <input
                        type="number"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={data.settlementFee || ''}
                        onChange={(e) => {
                          const val = parseNumberInput(e.target.value);
                          handleChange('settlementFee', val);
                        }}
                        onPaste={(e) => handleNumberPaste(e, 'settlementFee')}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Phí phạt quá hạn</label>
                    <input
                        type="number"
                        className="w-full p-2 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={data.overdueFee || ''}
                        onChange={(e) => {
                          const val = parseNumberInput(e.target.value);
                          handleChange('overdueFee', val);
                        }}
                        onPaste={(e) => handleNumberPaste(e, 'overdueFee')}
                    />
                </div>
            </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-gray-700">Địa chỉ</label>
            <textarea
              ref={addressTextareaRef}
              rows={2}
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 resize-y min-h-[42px]"
              value={data.address}
              onChange={(e) => handleTextareaChange('address', e.target.value, e)}
              style={{ minHeight: '42px' }}
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700">Nội dung chuyển khoản</label>
              <button
                type="button"
                onClick={() => {
                  const generatedContent = generateTransferContent();
                  onChange({ ...data, transferContent: generatedContent });
                  isTransferContentManuallyEdited.current = false;
                  // Auto-resize textarea after update
                  setTimeout(() => {
                    if (transferContentTextareaRef.current) {
                      transferContentTextareaRef.current.style.height = 'auto';
                      transferContentTextareaRef.current.style.height = `${transferContentTextareaRef.current.scrollHeight}px`;
                    }
                  }, 0);
                }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                title="Tự động tạo lại nội dung theo định dạng: Họ tên Mã HĐ Goc [số tiền] Lai [số tiền] PhiQL [số tiền] Phi Phat [số tiền] PhiTatToan [số tiền]"
              >
                <RefreshCw className="w-3 h-3" />
                Tự động tạo
              </button>
              <p className={`text-xs font-medium ${(data.transferContent?.length || 0) >= 95 ? 'text-red-600' : 'text-gray-600'}`}>
                {data.transferContent ? data.transferContent.length : 0} / 95 ký tự
              </p>
            </div>
            <textarea
              ref={transferContentTextareaRef}
              rows={3}
              maxLength={95}
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400 resize-y min-h-[42px] overflow-y-auto"
              value={data.transferContent}
              onChange={(e) => handleTextareaChange('transferContent', e.target.value, e)}
              placeholder="Họ tên KH Mã HĐ Goc [số tiền] Lai [số tiền] PhiQL [số tiền] Phi Phat [số tiền] PhiTatToan [số tiền] (Tự động tạo khi nhập thông tin)"
              style={{ minHeight: '42px' }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 italic">
                Định dạng: Họ tên KH Mã HĐ Goc [số tiền] Lai [số tiền] PhiQL [số tiền] Phi Phat [số tiền] PhiTatToan [số tiền]
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};