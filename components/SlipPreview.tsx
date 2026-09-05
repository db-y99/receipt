import React, { useEffect, useRef } from 'react';
import { CustomerData, CompanyInfo } from '../types';
import logoImage from '../logo.png';
import { generateVietQRString } from '../utils/vietqr';
import { amountToVietnameseWords } from '../utils/numberToWords';

interface SlipPreviewProps {
  customer: CustomerData;
  company: CompanyInfo;
  id?: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return '...';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return `Ngày ${date.getDate().toString().padStart(2, '0')} tháng ${(date.getMonth() + 1).toString().padStart(2, '0')} năm ${date.getFullYear()}`;
};

const formatMoney = (amount: number, suffix: string = 'VND') => {
  const formatted = new Intl.NumberFormat('vi-VN').format(amount);
  return suffix ? formatted + ' ' + suffix : formatted;
};

const formatNumber = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);

interface CashSlipPanelProps {
  customer: CustomerData;
  company: CompanyInfo;
}

const CashSlipPanel: React.FC<CashSlipPanelProps> = ({ customer, company }) => {
  const hasBreakdown =
    (customer.principal || 0) > 0 ||
    (customer.interest || 0) > 0 ||
    (customer.managementFee || 0) > 0 ||
    (customer.settlementFee || 0) > 0 ||
    (customer.overdueFee || 0) > 0 ||
    (customer.periods && customer.periods.length > 0);

  return (
    <div
      className="relative flex flex-col overflow-hidden shrink-0 h-full"
      style={{
        width: '210mm',
        height: '148.5mm',
        paddingTop: '14mm',
        paddingRight: '18mm',
        paddingBottom: '0',
        paddingLeft: '18mm',
      }}
    >
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute"
          style={{
            backgroundImage: `url(${logoImage})`,
            backgroundRepeat: 'repeat',
            backgroundSize: '90px auto',
            opacity: 0.05,
            width: '165%',
            height: '165%',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            transformOrigin: 'center center',
          }}
        />
      </div>

      <img
        src={logoImage}
        alt="Y99 Logo"
        className="absolute w-16 h-auto object-contain z-10"
        style={{ top: '14mm', right: '18mm' }}
      />

      <div className="relative z-10 flex flex-col pb-[11mm]">
        <div>
          <div className="mb-3">
            <h1 className="font-bold uppercase text-base leading-normal mb-1 pr-16">{company.name}</h1>
            <p className="italic text-gray-700 text-sm leading-snug break-words">{company.address}</p>
          </div>
          <div className="text-center mb-3">
            <h2 className="font-bold text-2xl uppercase tracking-wide mb-1.5 leading-normal">PHIẾU THU TIỀN MẶT</h2>
            <div className="flex justify-between items-baseline italic font-medium text-sm leading-normal">
              <span>Số phiếu: {customer.receiptNumber || '...'}</span>
              <span>{formatDate(customer.deadline)}</span>
            </div>
          </div>

          <div className="space-y-1 text-[17px]">
            <div className="flex items-start leading-snug">
              <span className="font-bold w-[150px] shrink-0">Họ tên khách hàng:</span>
              <span className="font-medium break-words flex-1">{customer.fullName}</span>
            </div>
            <div className="flex items-start leading-snug">
              <span className="font-bold w-[150px] shrink-0">Mã số hợp đồng:</span>
              <span className="font-medium break-words flex-1">{customer.contractId}</span>
            </div>
            <div className="flex items-start leading-snug">
              <span className="font-bold w-[150px] shrink-0">Nội dung:</span>
              <span className="font-medium break-words flex-1">{customer.address}</span>
            </div>

            <div className="pt-1 space-y-1">
              <div className="flex flex-nowrap items-baseline gap-1.5 leading-snug">
                <span className="font-bold shrink-0 whitespace-nowrap">Tổng tiền thanh toán:</span>
                <span className="font-bold text-xl text-red-700 whitespace-nowrap">{formatMoney(customer.amount)}</span>
              </div>

              {hasBreakdown && (
                <div className="text-black space-y-0.5 text-[15px] w-full">
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                    {!(customer.periods && customer.periods.length > 0) && (
                      <>
                        {(customer.principal || 0) > 0 && (
                          <p className="leading-snug break-words">- Gốc: {formatMoney(customer.principal || 0, 'VNĐ')}</p>
                        )}
                        {(customer.interest || 0) > 0 && (
                          <p className="leading-snug break-words">- Lãi: {formatMoney(customer.interest || 0, 'VNĐ')}</p>
                        )}
                        {(customer.managementFee || 0) > 0 && (
                          <p className="leading-snug break-words">- Phí quản lý: {formatMoney(customer.managementFee || 0, 'VNĐ')}</p>
                        )}
                        {(customer.settlementFee || 0) > 0 && (
                          <p className="leading-snug break-words">- Phí tất toán: {formatMoney(customer.settlementFee || 0, 'VNĐ')}</p>
                        )}
                        {(customer.overdueFee || 0) > 0 && (
                          <p className="leading-snug break-words">- Phí quá hạn: {formatMoney(customer.overdueFee || 0, 'VNĐ')}</p>
                        )}
                      </>
                    )}
                    {customer.periods?.map((period, index) => (
                      <p key={index} className="leading-snug break-words col-span-3">
                        - Kỳ {period.periodNumber} (trễ {period.daysOverdue} ngày): {formatNumber(period.periodAmount)}; phạt{' '}
                        {period.daysOverdue} ngày: {formatNumber(period.penaltyAmount)}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 text-center text-base mt-2">
          <div className="flex flex-col items-center">
            <p className="font-bold leading-normal">Thủ quỹ</p>
            <p className="text-sm italic text-gray-700 leading-normal mt-1 mb-2">(Ký, ghi rõ họ tên)</p>
            <div className="w-full h-12" aria-hidden="true" />
          </div>
          <div className="flex flex-col items-center">
            <p className="font-bold leading-normal">Khách hàng</p>
            <p className="text-sm italic text-gray-700 leading-normal mt-1 mb-2">(Ký, ghi rõ họ tên)</p>
            <div className="w-full h-12" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div
        className="absolute text-xs leading-snug z-10"
        style={{ left: '18mm', right: '18mm', bottom: '8mm' }}
      >
        <p>
          <span className="font-bold">Đã nhận đủ số tiền (bằng số):</span>{' '}
          <span className="font-semibold">{formatMoney(customer.amount, 'VNĐ')}</span>
        </p>
        <p className="mt-1 italic break-words">
          <span className="font-bold not-italic">(Bằng chữ):</span> {amountToVietnameseWords(customer.amount)}
        </p>
      </div>
    </div>
  );
};

export const SlipPreview: React.FC<SlipPreviewProps> = ({ customer, company, id }) => {
  const qrRef = useRef<HTMLCanvasElement>(null);

  const qrString = customer.type === 'CASH' ? '' : generateVietQRString({
    accountNo: company.bankAccountNumber,
    amount: customer.amount > 0 ? customer.amount : undefined,
    content: customer.transferContent || undefined,
    bankId: company.bankId,
  });

  useEffect(() => {
    if (customer.type === 'CASH' || !qrString || !qrRef.current) return;

    const renderQR = (value: string) => {
      if (!qrRef.current || !(window as any).QRious) return;

      const ctx = qrRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, qrRef.current.width, qrRef.current.height);
      }

      // @ts-ignore - QRious is loaded dynamically
      new (window as any).QRious({
        element: qrRef.current,
        value: value,
        size: 200,
        level: 'M',
        background: 'white',
        foreground: 'black',
      });
    };

    if ((window as any).QRious) {
      renderQR(qrString);
      return;
    }

    const existingScript = document.querySelector('script[src*="qrious"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => renderQR(qrString));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
    script.async = true;
    script.onload = () => renderQR(qrString);
    document.body.appendChild(script);

    return () => {
      const scriptEl = document.querySelector('script[src*="qrious"]');
      if (scriptEl?.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
    };
  }, [qrString, customer.type]);

  const isSettlement = customer.type === 'SETTLEMENT';
  const isCash = customer.type === 'CASH';

  if (isCash) {
    return (
      <div
        id={id}
        className="bg-white text-black font-serif-print mx-auto print:shadow-none relative flex flex-col"
        style={{ width: '210mm', height: '297mm' }}
      >
        <CashSlipPanel customer={customer} company={company} />
        <div className="h-0 shrink-0 border-t border-dashed border-gray-400" aria-hidden="true" />
        <CashSlipPanel customer={customer} company={company} />
      </div>
    );
  }

  return (
    <div
      id={id}
      className="bg-white text-black font-serif-print mx-auto print:shadow-none relative flex flex-col justify-between"
      style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}
    >
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
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
            transformOrigin: 'center center',
          }}
        />
      </div>

      <img
        src={logoImage}
        alt="Y99 Logo"
        className="absolute top-0 right-0 w-20 h-auto object-contain z-10"
        style={{ top: '20mm', right: '20mm' }}
      />

      <div className="relative z-10 flex-1 flex flex-col">
        <div className="mb-4">
          <h1 className="font-bold uppercase text-lg leading-tight mb-1">{company.name}</h1>
          <p className="italic text-gray-700 text-sm leading-tight break-words">{company.address}</p>
        </div>

        <div className="text-center mb-4">
          <h2 className="font-bold text-2xl uppercase tracking-wide mb-1 leading-tight">
            {isSettlement ? 'PHIẾU THU TIỀN TẤT TOÁN' : 'PHIẾU THU TIỀN'}
          </h2>
          <p className="italic font-medium text-base leading-tight">{formatDate(customer.deadline)}</p>
        </div>

        <div className="space-y-2 mb-4 text-base">
          <div className="flex items-start leading-tight">
            <span className="font-bold w-[180px] shrink-0">Họ tên khách hàng:</span>
            <span className="font-medium break-words flex-1">{customer.fullName}</span>
          </div>
          <div className="flex items-start leading-tight">
            <span className="font-bold w-[180px] shrink-0">Mã số hợp đồng:</span>
            <span className="font-medium break-words flex-1">{customer.contractId}</span>
          </div>
          <div className="flex items-start leading-tight">
            <span className="font-bold w-[180px] shrink-0">Địa chỉ:</span>
            <span className="font-medium break-words flex-1">{customer.address}</span>
          </div>

          <div className="flex flex-col mt-2">
            <div className="flex items-baseline text-red-700 leading-tight">
              <span className="font-bold w-[180px] shrink-0 text-black">Tổng tiền thanh toán:</span>
              <span className="font-bold text-lg break-words flex-1">{formatMoney(customer.amount)}</span>
            </div>

            {(((customer.principal || 0) > 0 ||
              (customer.interest || 0) > 0 ||
              (customer.managementFee || 0) > 0 ||
              (customer.settlementFee || 0) > 0 ||
              (customer.overdueFee || 0) > 0) ||
              (customer.periods && customer.periods.length > 0) ||
              (customer.remainingPrincipal || 0) > 0) && (
              <div className="mt-1 text-black space-y-0.5 text-sm w-full">
                <div className="grid grid-cols-3 gap-x-4 gap-y-0.5">
                  {!(customer.periods && customer.periods.length > 0) && (
                    <>
                      {(customer.principal || 0) > 0 && (
                        <p className="leading-tight break-words">- Gốc: {formatMoney(customer.principal || 0, 'VNĐ')}</p>
                      )}
                      {(customer.interest || 0) > 0 && (
                        <p className="leading-tight break-words">- Lãi: {formatMoney(customer.interest || 0, 'VNĐ')}</p>
                      )}
                      {(customer.managementFee || 0) > 0 && (
                        <p className="leading-tight break-words">- Phí QL: {formatMoney(customer.managementFee || 0, 'VNĐ')}</p>
                      )}
                      {(customer.settlementFee || 0) > 0 && (
                        <p className="leading-tight break-words">- Phí tất toán: {formatMoney(customer.settlementFee || 0, 'VNĐ')}</p>
                      )}
                      {(customer.overdueFee || 0) > 0 && (
                        <p className="leading-tight break-words">- Phí quá hạn: {formatMoney(customer.overdueFee || 0, 'VNĐ')}</p>
                      )}
                    </>
                  )}
                  {customer.periods?.map((period, index) => (
                    <p key={index} className="leading-tight break-words col-span-3">
                      - Kỳ {period.periodNumber} (trễ {period.daysOverdue} ngày): {formatNumber(period.periodAmount)}; phạt{' '}
                      {period.daysOverdue} ngày: {formatNumber(period.penaltyAmount)}
                    </p>
                  ))}
                  {(customer.remainingPrincipal || 0) > 0 && (
                    <p className="leading-tight break-words col-span-3">
                      - Gốc còn lại: {formatNumber(customer.remainingPrincipal || 0)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-2 border-black p-2.5 mb-4 text-sm">
          <p className="font-bold underline mb-2 leading-tight">Nộp tiền vào tài khoản sau:</p>
          <div className="grid grid-cols-1 gap-1">
            <p className="leading-tight break-words">
              <span className="font-bold w-[140px] inline-block">Tên ngân hàng:</span> {company.bankName}
            </p>
            <p className="leading-tight break-words">
              <span className="font-bold w-[140px] inline-block">Tên chủ tài khoản:</span> {company.bankAccountName}
            </p>
            <p className="leading-tight break-words">
              <span className="font-bold w-[140px] inline-block">Số tài khoản:</span> {company.bankAccountNumber}
            </p>
            <div className="mt-1 pt-1 border-t border-gray-300 border-dashed">
              <span className="font-bold text-red-600 leading-tight">Nội dung chuyển khoản (Bắt buộc):</span>
              <span className="font-bold ml-2 text-lg leading-tight break-words" style={{ lineHeight: '1.3' }}>
                {customer.transferContent}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-auto">
        <p className="text-center italic mb-1 text-sm max-w-lg mx-auto leading-tight break-words">
          Mọi khoản thanh toán chỉ được chuyển vào tài khoản chính thức của Y99.
          <br />
          Y99 không công nhận thanh toán vào bất kỳ tài khoản cá nhân nào.
        </p>
        <p className="text-center italic mb-2 text-sm max-w-lg mx-auto leading-tight break-words">
          Quý khách hàng khi chuyển khoản vui lòng quét mã QR bên dưới để hệ thống tự động điền thông tin chính xác!
        </p>
        <div className="flex flex-col items-center mx-auto mb-3">
          <div className="w-[200px] h-[200px] bg-white border-2 border-blue-500 shadow-sm overflow-hidden flex items-center justify-center">
            {qrString ? (
              <canvas ref={qrRef} className="w-full h-full" />
            ) : (
              <div className="text-gray-400 text-sm text-center p-4">Chờ nhập thông tin...</div>
            )}
          </div>
          <div className="mt-1.5 text-center space-y-0.5 text-sm max-w-md leading-tight">
            <p className="leading-tight break-words">
              <span className="font-bold text-red-700">Số tiền:</span>{' '}
              <span className="font-semibold">{formatMoney(customer.amount)}</span>
            </p>
            <p className="leading-tight break-words">
              <span className="font-bold text-red-700">Nội dung:</span>{' '}
              <span className="font-semibold">{customer.transferContent || '(Chưa có nội dung)'}</span>
            </p>
            <p className="leading-tight break-words">
              <span className="font-bold text-red-700">Tên chủ TK:</span>{' '}
              <span className="font-semibold">{company.bankAccountName}</span>
            </p>
            <p className="leading-tight break-words">
              <span className="font-bold text-red-700">Số TK:</span>{' '}
              <span className="font-bold">{company.bankAccountNumber}</span>
            </p>
            <p className="leading-tight break-words">
              <span className="font-bold text-red-700">{company.bankName}</span>
            </p>
          </div>
        </div>
        <div className="border-t-2 border-black pt-2 text-sm text-justify">
          <p className="leading-tight font-bold text-red-700 mb-1.5 break-words">
            <span className="font-bold">Lưu ý: </span>
            {company.name} sẽ không hoàn lại khoản tiền đã đóng với bất kỳ lý do gì. Quý khách vui lòng kiểm tra đầy đủ
            thông tin số tiền và nội dung chuyển khoản. Mọi chi tiết xin liên hệ Bộ phận Chăm sóc khách hàng giải đáp
            thắc mắc.
          </p>
          <p className="font-bold text-center text-sm leading-tight mt-1.5 break-words">Hotline: {company.hotline}</p>
        </div>
      </div>
    </div>
  );
};
