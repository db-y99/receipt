import React from 'react';
import { CustomerData, CompanyInfo } from '../types';
import logoImage from '../logo.png';

interface SlipPreviewProps {
  customer: CustomerData;
  company: CompanyInfo;
  id?: string;
}

export const SlipPreview: React.FC<SlipPreviewProps> = ({ customer, company, id }) => {
  // Format Date
  const formatDate = (dateString: string) => {
    if (!dateString) return "...";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return `Ngày ${date.getDate().toString().padStart(2, '0')} tháng ${(date.getMonth() + 1).toString().padStart(2, '0')} năm ${date.getFullYear()}`;
  };

  // Format Money
  const formatMoney = (amount: number, suffix: string = "VND") => {
    return new Intl.NumberFormat('vi-VN').format(amount) + " " + suffix;
  };

  // Generate VietQR Link
  const qrUrl = `https://img.vietqr.io/image/${company.bankId}-${company.bankAccountNumber}-compact.png?amount=${customer.amount}&addInfo=${encodeURIComponent(customer.transferContent)}&accountName=${encodeURIComponent(company.bankAccountName)}`;

  const isSettlement = customer.type === 'SETTLEMENT';
  // Check if transfer content is long (more than 50 characters)
  const isLongContent = customer.transferContent && customer.transferContent.length > 50;

  return (
    // A4 Dimensions: 210mm x 297mm. 
    // We fix the width and min-height to ensure it renders exactly like the printed page.
    <div 
        id={id} 
        className="bg-white text-black font-serif-print mx-auto shadow-2xl relative flex flex-col justify-between"
        style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}
    >
        {/* Watermark background pattern with logos */}
        <div
            className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
        >
            <div
                className="absolute"
                style={{
                    backgroundImage: `url(${logoImage})`,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '120px auto',
                    opacity: 0.025,
                    width: '165%',
                    height: '165%',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%) rotate(-45deg)',
                    transformOrigin: 'center center'
                }}
            />
        </div>

        {/* Logo in top right corner */}
        <img 
            src={logoImage} 
            alt="Y99 Logo" 
            className="absolute top-0 right-0 w-24 h-auto object-contain z-10"
            style={{ top: '74px', right: '20mm', left: '622px' }}
        />

        {/* Top Content Group */}
        <div className="relative z-10">
            {/* Header */}
            <div className={isLongContent ? "mb-2" : (isSettlement ? "mb-3" : "mb-6")}>
                <h1 className={`font-bold uppercase text-xl leading-tight ${isLongContent ? "mb-0.5" : "mb-1"}`}>{company.name}</h1>
                <p className={`italic text-gray-700 text-base ${isLongContent ? "leading-tight" : ""}`}>{company.address}</p>
            </div>

            {/* Title */}
            <div className={`text-center ${isLongContent ? "mb-2" : (isSettlement ? "mb-3" : "mb-6")}`}>
                <h2 className={`font-bold text-3xl uppercase tracking-wide ${isLongContent ? "mb-1 leading-tight" : "mb-2"}`}>
                    {isSettlement ? 'PHIẾU THU TIỀN TẤT TOÁN' : 'PHIẾU THU TIỀN'}
                </h2>
                <p className={`italic font-medium text-lg ${isLongContent ? "leading-tight" : ""}`}>Thời hạn: {formatDate(customer.deadline)}.</p>
            </div>

            {/* Body Info */}
            <div className={`${isLongContent ? (isSettlement ? "space-y-1 mb-2" : "space-y-1.5 mb-3") : (isSettlement ? "space-y-2 mb-3" : "space-y-3 mb-6")} text-lg`}>
                <div className={`flex items-baseline ${isLongContent ? "leading-tight" : ""}`}>
                    <span className="font-bold w-[200px] shrink-0">Họ tên khách hàng:</span>
                    <span className="font-medium">{customer.fullName}</span>
                </div>
                <div className={`flex items-baseline ${isLongContent ? "leading-tight" : ""}`}>
                    <span className="font-bold w-[200px] shrink-0">Mã khách hàng:</span>
                    <span className="font-medium">{customer.customerId}</span>
                </div>
                <div className={`flex items-baseline ${isLongContent ? "leading-tight" : ""}`}>
                    <span className="font-bold w-[200px] shrink-0">Mã số hợp đồng:</span>
                    <span className="font-medium">{customer.contractId}</span>
                </div>
                <div className={`flex items-baseline ${isLongContent ? "leading-tight" : ""}`}>
                    <span className="font-bold w-[200px] shrink-0">Địa chỉ:</span>
                    <span className="font-medium">{customer.address}</span>
                </div>
                
                <div className={`flex flex-col ${isLongContent ? "mt-2" : "mt-4"}`}>
                    <div className={`flex items-baseline text-red-700 ${isLongContent ? "leading-tight" : ""}`}>
                        <span className="font-bold w-[200px] shrink-0 text-black">Tổng tiền thanh toán:</span>
                        <span className="font-bold text-xl">{formatMoney(customer.amount)}</span>
                    </div>
                    
                    {/* Breakdown for Settlement */}
                    {isSettlement && (
                        <div className={`ml-[200px] text-black ${isLongContent ? "mt-0.5" : "mt-1"} ${isLongContent ? "space-y-0" : "space-y-0.5"} text-base`}>
                            <div className={`grid grid-cols-2 gap-x-8 ${isLongContent ? "gap-y-0 leading-tight" : "gap-y-0.5"}`}>
                                <p className={isLongContent ? "leading-tight" : ""}>- Gốc: {formatMoney(customer.principal || 0, 'VNĐ')}</p>
                                <p className={isLongContent ? "leading-tight" : ""}>- Lãi: {formatMoney(customer.interest || 0, 'VNĐ')}</p>
                                <p className={isLongContent ? "leading-tight" : ""}>- Phí QL: {formatMoney(customer.managementFee || 0, 'VNĐ')}</p>
                                <p className={isLongContent ? "leading-tight" : ""}>- Phí tất toán: {formatMoney(customer.settlementFee || 0, 'VNĐ')}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bank Info Box */}
            <div className={`border-2 border-black ${isLongContent ? "p-2" : "p-4"} ${isLongContent ? (isSettlement ? "mb-2" : "mb-2") : (isSettlement ? "mb-3" : "mb-4")} text-base`}>
                <p className={`font-bold underline ${isLongContent ? "mb-1 leading-tight" : "mb-2"}`}>Nộp tiền vào tài khoản sau:</p>
                <div className={`grid grid-cols-1 ${isLongContent ? "gap-0.5" : "gap-1"}`}>
                    <p className={isLongContent ? "leading-tight" : ""}><span className="font-bold w-[160px] inline-block">Tên ngân hàng:</span> {company.bankName}</p>
                    <p className={isLongContent ? "leading-tight" : ""}><span className="font-bold w-[160px] inline-block">Tên chủ tài khoản:</span> {company.bankAccountName}</p>
                    <p className={isLongContent ? "leading-tight" : ""}><span className="font-bold w-[160px] inline-block">Số tài khoản:</span> {company.bankAccountNumber}</p>
                    {/* Force Transfer Content to be visible clearly */}
                    <div className={`${isLongContent ? "mt-0.5 pt-0.5" : "mt-1 pt-1"} border-t border-gray-300 border-dashed`}>
                         <span className={`font-bold text-red-600 ${isLongContent ? "leading-tight" : ""}`}>Nội dung chuyển khoản (Bắt buộc):</span> 
                         <span className={`font-bold ml-2 text-lg ${isLongContent ? "leading-tight break-words" : ""}`} style={isLongContent ? { lineHeight: '1.2' } : {}}>{customer.transferContent}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Bottom Group: QR & Footer - Pushed to bottom via flex justify-between if needed, but structure here is flow */}
        <div className="mt-auto relative z-10">
             {/* QR Section */}
            <p className={`text-center italic ${isLongContent ? (isSettlement ? "mb-1" : "mb-1.5") : (isSettlement ? "mb-2" : "mb-3")} text-sm max-w-lg mx-auto ${isLongContent ? "leading-tight" : ""}`}>
                Quý khách hàng khi chuyển khoản vui lòng quét mã QR bên dưới để hệ thống tự động điền thông tin chính xác!
            </p>
            {/* Fixed QR size to ensure fit */}
            <div className={`w-[250px] h-[250px] bg-white p-2 border border-gray-300 shadow-sm mx-auto ${isLongContent ? (isSettlement ? "mb-2" : "mb-3") : (isSettlement ? "mb-4" : "mb-6")}`}>
                <img src={qrUrl} alt="Mã QR Chuyển khoản" className="w-full h-full object-contain" crossOrigin="anonymous" />
            </div>

            {/* Footer */}
            <div className={`border-t-2 border-black ${isLongContent ? (isSettlement ? "pt-2" : "pt-2") : (isSettlement ? "pt-3" : "pt-4")} text-sm text-justify`}>
                <p className={`${isLongContent ? "mb-1 leading-tight" : "mb-2 leading-snug"} font-bold text-red-700`}>
                    <span className="font-bold">Lưu ý: </span>
                    {company.name} sẽ không hoàn lại khoản tiền đã đóng với bất kỳ lý do gì. Quý khách vui lòng kiểm tra đầy đủ thông tin số tiền và nội dung chuyển khoản. Mọi chi tiết xin liên hệ Bộ phận Chăm sóc khách hàng giải đáp thắc mắc.
                </p>
                <p className={`font-bold text-center ${isLongContent ? "mt-1" : "mt-2"} text-base ${isLongContent ? "leading-tight" : ""}`}>
                    Hotline: {company.hotline}
                </p>
            </div>
        </div>
    </div>
  );
};