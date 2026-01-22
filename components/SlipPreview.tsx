import React, { useEffect, useRef } from 'react';
import { CustomerData, CompanyInfo } from '../types';
import logoImage from '../logo.png';
import { generateVietQRString, removeVietnameseTones } from '../utils/vietqr';

interface SlipPreviewProps {
  customer: CustomerData;
  company: CompanyInfo;
  id?: string;
}

export const SlipPreview: React.FC<SlipPreviewProps> = ({ customer, company, id }) => {
  const qrRef = useRef<HTMLCanvasElement>(null);

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

  // Generate VietQR String
  const qrString = generateVietQRString({
    accountNo: company.bankAccountNumber,
    amount: customer.amount > 0 ? customer.amount : undefined,
    content: customer.transferContent || undefined,
    bankId: company.bankId
  });

  // Load QRious library and render QR code
  useEffect(() => {
    if (!qrString || !qrRef.current) return;

    const renderQR = (value: string) => {
      if (!qrRef.current || !(window as any).QRious) return;
      
      // Clear previous QR code
      const ctx = qrRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, qrRef.current.width, qrRef.current.height);
      }

      // @ts-ignore - QRious is loaded dynamically
      new (window as any).QRious({
        element: qrRef.current,
        value: value,
        size: 280,
        level: 'M',
        background: 'white',
        foreground: 'black'
      });
    };

    // Check if QRious is already loaded
    if ((window as any).QRious) {
      renderQR(qrString);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="qrious"]');
    if (existingScript) {
      // Script is loading, wait for it
      existingScript.addEventListener('load', () => {
        renderQR(qrString);
      });
      return;
    }

    // Load QRious from CDN
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
    script.async = true;
    script.onload = () => {
      renderQR(qrString);
    };
    document.body.appendChild(script);

    // Cleanup function
    return () => {
      const existingScript = document.querySelector('script[src*="qrious"]');
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, [qrString]);

  const isSettlement = customer.type === 'SETTLEMENT';
  // Check if transfer content is long (more than 50 characters)
  const isLongContent = customer.transferContent && customer.transferContent.length > 50;
  
  // Calculate clean content length for display
  const cleanContentLength = customer.transferContent ? removeVietnameseTones(customer.transferContent).length : 0;

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
            <div className={isLongContent ? "mb-1.5" : (isSettlement ? "mb-2" : "mb-3")}>
                <h1 className={`font-bold uppercase text-lg leading-tight ${isLongContent ? "mb-0.5" : "mb-0.5"}`}>{company.name}</h1>
                <p className={`italic text-gray-700 text-sm ${isLongContent ? "leading-tight" : ""}`}>{company.address}</p>
            </div>

            {/* Title */}
            <div className={`text-center ${isLongContent ? "mb-1.5" : (isSettlement ? "mb-2" : "mb-3")}`}>
                <h2 className={`font-bold text-2xl uppercase tracking-wide ${isLongContent ? "mb-0.5 leading-tight" : "mb-1"}`}>
                    {isSettlement ? 'PHIẾU THU TIỀN TẤT TOÁN' : 'PHIẾU THU TIỀN'}
                </h2>
                <p className={`italic font-medium text-base ${isLongContent ? "leading-tight" : ""}`}>Thời hạn: {formatDate(customer.deadline)}.</p>
            </div>

            {/* Body Info */}
            <div className={`${isLongContent ? (isSettlement ? "space-y-0.5 mb-1.5" : "space-y-1 mb-2") : (isSettlement ? "space-y-1 mb-2" : "space-y-1.5 mb-3")} text-base`}>
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
                
                <div className={`flex flex-col ${isLongContent ? "mt-1" : "mt-2"}`}>
                    <div className={`flex items-baseline text-red-700 ${isLongContent ? "leading-tight" : ""}`}>
                        <span className="font-bold w-[200px] shrink-0 text-black">Tổng tiền thanh toán:</span>
                        <span className="font-bold text-lg">{formatMoney(customer.amount)}</span>
                    </div>
                    
                    {/* Breakdown for both STANDARD and SETTLEMENT */}
                    {((customer.principal || 0) > 0 || (customer.interest || 0) > 0 || (customer.managementFee || 0) > 0 || (customer.settlementFee || 0) > 0 || (customer.overdueFee || 0) > 0) && (
                        <div className={`ml-[200px] text-black ${isLongContent ? "mt-0.5" : "mt-1"} ${isLongContent ? "space-y-0" : "space-y-0.5"} text-base`}>
                            <div className={`grid grid-cols-2 gap-x-8 ${isLongContent ? "gap-y-0 leading-tight" : "gap-y-0.5"}`}>
                                {(customer.principal || 0) > 0 && (
                                    <p className={isLongContent ? "leading-tight" : ""}>- Gốc: {formatMoney(customer.principal || 0, 'VNĐ')}</p>
                                )}
                                {(customer.interest || 0) > 0 && (
                                    <p className={isLongContent ? "leading-tight" : ""}>- Lãi: {formatMoney(customer.interest || 0, 'VNĐ')}</p>
                                )}
                                {(customer.managementFee || 0) > 0 && (
                                    <p className={isLongContent ? "leading-tight" : ""}>- Phí QL: {formatMoney(customer.managementFee || 0, 'VNĐ')}</p>
                                )}
                                {(customer.settlementFee || 0) > 0 && (
                                    <p className={isLongContent ? "leading-tight" : ""}>- Phí tất toán: {formatMoney(customer.settlementFee || 0, 'VNĐ')}</p>
                                )}
                                {(customer.overdueFee || 0) > 0 && (
                                    <p className={isLongContent ? "leading-tight" : ""}>- Phí quá hạn: {formatMoney(customer.overdueFee || 0, 'VNĐ')}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bank Info Box */}
            <div className={`border-2 border-black ${isLongContent ? "p-1.5" : "p-3"} ${isLongContent ? (isSettlement ? "mb-1" : "mb-1") : (isSettlement ? "mb-1.5" : "mb-2")} text-sm`}>
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

        {/* Bottom Group: QR & Footer */}
        <div className={`relative z-10 ${isLongContent ? "mt-0.5" : (isSettlement ? "mt-1" : "mt-1")}`}>
             {/* QR Section */}
            <p className={`text-center italic ${isLongContent ? "mb-1" : (isSettlement ? "mb-1.5" : "mb-2")} text-xs max-w-lg mx-auto leading-tight whitespace-nowrap`}>
                Quý khách hàng khi chuyển khoản vui lòng quét mã QR bên dưới để hệ thống tự động điền thông tin chính xác!
            </p>
            {/* QR Code Container with blue border */}
            <div className={`flex flex-col items-center mx-auto ${isLongContent ? "mb-1.5" : (isSettlement ? "mb-2" : "mb-3")}`}>
                {/* QR Code with blue border */}
                <div className="w-[280px] h-[280px] bg-white border-2 border-blue-500 shadow-sm overflow-hidden flex items-center justify-center">
                    {qrString ? (
                        <canvas ref={qrRef} className="w-full h-full" />
                    ) : (
                        <div className="text-gray-400 text-sm text-center p-4">
                            Chờ nhập thông tin...
                        </div>
                    )}
                </div>
                
                {/* Payment Details below QR - Compact */}
                <div className={`mt-1.5 text-center space-y-0.5 text-xs max-w-md leading-tight`}>
                    <p className="leading-tight">
                        <span className="font-bold text-red-700">Số tiền:</span> <span className="font-semibold">{formatMoney(customer.amount)}</span>
                    </p>
                    <p className="leading-tight break-words">
                        <span className="font-bold text-red-700">Nội dung:</span> <span className="font-semibold">{customer.transferContent || "(Chưa có nội dung)"}</span>
                    </p>
                    <p className="leading-tight">
                        <span className="font-bold text-red-700">Tên chủ TK:</span> <span className="font-semibold">{company.bankAccountName}</span>
                    </p>
                    <p className="leading-tight">
                        <span className="font-bold text-red-700">Số TK:</span> <span className="font-bold">{company.bankAccountNumber}</span>
                    </p>
                    <p className="leading-tight">
                        <span className="font-bold text-red-700">{company.bankName}</span>
                    </p>
                </div>
            </div>

            {/* Footer - Compact */}
            <div className={`border-t-2 border-black ${isLongContent ? "pt-1.5" : (isSettlement ? "pt-2" : "pt-2.5")} text-xs text-justify`}>
                <p className={`leading-tight font-bold text-red-700 ${isLongContent ? "mb-1" : "mb-1.5"}`}>
                    <span className="font-bold">Lưu ý: </span>
                    {company.name} sẽ không hoàn lại khoản tiền đã đóng với bất kỳ lý do gì. Quý khách vui lòng kiểm tra đầy đủ thông tin số tiền và nội dung chuyển khoản. Mọi chi tiết xin liên hệ Bộ phận Chăm sóc khách hàng giải đáp thắc mắc.
                </p>
                <p className={`font-bold text-center text-sm leading-tight ${isLongContent ? "mt-1" : "mt-1.5"}`}>
                    Hotline: {company.hotline}
                </p>
            </div>
        </div>
    </div>
  );
};