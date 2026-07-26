import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Download,
  Printer,
  X,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { DEFAULT_COMPANY_INFO } from './constants';
import { CustomerData } from './types';
import { SlipPreview } from './components/SlipPreview';
import { DueSoonLoanPicker } from './components/DueSoonLoansPanel';
import { getPackageInfo, getStoredPackage } from './upgradePackages';
import { formatLoanAmount } from './services/loanService';

const loadingGif = new URL('./cat Mark loading.gif', import.meta.url).href;
const logo = new URL('./logo.png', import.meta.url).href;

type LoadingStage = 'idle' | 'spinning' | 'preparing' | 'aboutToExport' | 'success';
type PageStep = 'select' | 'queue';

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount || 0);
}

function formatDeadlineParts(data: CustomerData): { dd: string; mm: string } {
  const deadline = data.deadline ? new Date(data.deadline) : new Date();
  const valid = !Number.isNaN(deadline.getTime());
  const source = valid ? deadline : new Date();
  return {
    dd: String(source.getDate()).padStart(2, '0'),
    mm: String(source.getMonth() + 1).padStart(2, '0'),
  };
}

function buildPdfBaseName(data: CustomerData): string {
  if (!data.fullName?.trim()) return 'Phiếu thu tiền';
  const { dd, mm } = formatDeadlineParts(data);
  return `Phiếu thu tiền - ${data.fullName.trim()} (${dd}/${mm})`;
}

/** Tránh trùng tên khi nhiều phiếu cùng khách / cùng ngày. */
function uniquePdfFileName(baseName: string, used: Set<string>): string {
  let candidate = ensurePdfExtension(sanitizeFileName(baseName));
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  const stem = candidate.replace(/\.pdf$/i, '');
  let n = 2;
  while (used.has(`${stem} (${n}).pdf`)) n += 1;
  candidate = `${stem} (${n}).pdf`;
  used.add(candidate);
  return candidate;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\r\n\t]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .trim()
    .replace(/[.\s]+$/g, '');
}

function ensurePdfExtension(name: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
}

function buildZipFileName(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `Phieu-thu-tien-${yyyy}-${mm}-${dd}.zip`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke sau một nhịp để trình duyệt kịp bắt đầu tải
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const DueSoonPage: React.FC = () => {
  const [step, setStep] = useState<PageStep>('select');
  const [slipQueue, setSlipQueue] = useState<CustomerData[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
  const [scale, setScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const currentSlip = slipQueue[queueIndex] ?? null;

  useEffect(() => {
    const calculateScale = () => {
      if (!previewContainerRef.current) return;
      const containerWidth = previewContainerRef.current.offsetWidth;
      const slipWidthPx = 794;
      const padding = 32;
      setScale(Math.min(1, (containerWidth - padding) / slipWidthPx));
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [step]);

  const handleConfirm = (slips: CustomerData[]) => {
    setSlipQueue(slips);
    setQueueIndex(0);
    setStep('queue');
  };

  const updateCurrentSlip = (patch: Partial<CustomerData>) => {
    setSlipQueue((prev) => {
      if (!prev[queueIndex]) return prev;
      const next = [...prev];
      const updated = { ...next[queueIndex], ...patch };
      if (
        patch.principal !== undefined ||
        patch.interest !== undefined ||
        patch.managementFee !== undefined ||
        patch.overdueFee !== undefined ||
        patch.settlementFee !== undefined
      ) {
        updated.amount =
          (updated.principal || 0) +
          (updated.interest || 0) +
          (updated.managementFee || 0) +
          (updated.settlementFee || 0) +
          (updated.overdueFee || 0);
      }
      next[queueIndex] = updated;
      return next;
    });
  };

  const removeFromQueue = (index: number) => {
    setSlipQueue((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setStep('select');
        setQueueIndex(0);
        return [];
      }
      setQueueIndex((current) => {
        if (index < current) return current - 1;
        if (index === current) return Math.min(current, next.length - 1);
        return current;
      });
      return next;
    });
  };

  const handleDownloadPDF = async () => {
    if (slipQueue.length === 0) return;

    const savedIndex = queueIndex;
    setIsExporting(true);
    setLoadingStage('spinning');

    try {
      const packageInfo = getPackageInfo(getStoredPackage());
      const totalTime = packageInfo.exportTime;
      const imageRenderTime = 500;
      const availableDelayTime = Math.max(0, totalTime - imageRenderTime);

      let stage1Time = 0;
      let stage2Time = 0;
      let stage3Time = 0;

      if (totalTime >= 20000) {
        stage1Time = Math.floor(availableDelayTime * 0.3);
        stage2Time = Math.floor(availableDelayTime * 0.4);
        stage3Time = availableDelayTime - stage1Time - stage2Time;
      } else if (totalTime >= 8000) {
        stage1Time = Math.floor(availableDelayTime * 0.35);
        stage2Time = Math.floor(availableDelayTime * 0.4);
        stage3Time = availableDelayTime - stage1Time - stage2Time;
      } else if (totalTime >= 3000) {
        stage1Time = Math.floor(availableDelayTime * 0.4);
        stage2Time = Math.floor(availableDelayTime * 0.35);
        stage3Time = availableDelayTime - stage1Time - stage2Time;
      } else {
        stage1Time = Math.floor(availableDelayTime * 0.5);
        stage2Time = Math.floor(availableDelayTime * 0.3);
        stage3Time = availableDelayTime - stage1Time - stage2Time;
      }

      if (stage1Time > 0) await waitMs(stage1Time);
      if (stage2Time > 0) {
        setLoadingStage('preparing');
        await waitMs(stage2Time);
      }
      if (stage3Time > 0) {
        setLoadingStage('aboutToExport');
        await waitMs(stage3Time);
      }

      await document.fonts?.ready;

      const usedNames = new Set<string>();
      const generated: { fileName: string; blob: Blob }[] = [];

      for (let i = 0; i < slipQueue.length; i++) {
        flushSync(() => setQueueIndex(i));
        // Cho SlipPreview + QR kịp paint trước khi capture
        await waitMs(i === 0 ? imageRenderTime : 280);

        const input = document.getElementById('due-soon-print-area');
        if (!input) {
          throw new Error(`Không tìm thấy phiếu thứ ${i + 1} để xuất PDF`);
        }

        const canvas = await html2canvas(input, {
          scale: 3,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: input.scrollWidth,
          height: input.scrollHeight,
          scrollX: 0,
          scrollY: -window.scrollY,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'SLOW');

        const slip = slipQueue[i];
        const contractHint = slip.contractId?.trim()
          ? ` - ${slip.contractId.trim()}`
          : '';
        const base =
          slipQueue.length > 1 && contractHint
            ? `${buildPdfBaseName(slip)}${contractHint}`
            : buildPdfBaseName(slip);
        const fileName = uniquePdfFileName(base, usedNames);
        generated.push({ fileName, blob: pdf.output('blob') });
      }

      if (generated.length === 1) {
        downloadBlob(generated[0].blob, generated[0].fileName);
      } else {
        const zip = new JSZip();
        for (const file of generated) {
          zip.file(file.fileName, file.blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, buildZipFileName());
      }

      setLoadingStage('success');
      await waitMs(1200);
    } catch (error) {
      console.error('PDF Export failed', error);
      alert('Lỗi khi xuất PDF. Vui lòng thử lại.');
      setLoadingStage('idle');
    } finally {
      flushSync(() => setQueueIndex(savedIndex));
      setIsExporting(false);
      setLoadingStage('idle');
    }
  };

  const getLoadingMessage = () => {
    const count = slipQueue.length;
    const multi = count > 1 ? ` ${count} phiếu` : '';
    switch (loadingStage) {
      case 'spinning':
        return `Đang quay${multi}...`;
      case 'preparing':
        return `Sắp xuất${multi}...`;
      case 'aboutToExport':
        return count > 1 ? `Sắp đóng gói ZIP ${count} phiếu...` : 'Sắp ra...';
      case 'success':
        return count > 1 ? `Đã xuất ${count} phiếu (ZIP)` : 'Đã xuất ra';
      default:
        return '';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {isExporting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] print:hidden">
          <div className="bg-white rounded-xl p-8 shadow-2xl max-w-sm w-full mx-4 flex flex-col items-center gap-4">
            {(loadingStage === 'spinning' ||
              loadingStage === 'preparing' ||
              loadingStage === 'aboutToExport') && (
              <img
                src={loadingGif}
                alt="Loading..."
                className="w-32 h-32 object-contain"
              />
            )}
            {loadingStage === 'success' && (
              <CheckCircle2 className="w-16 h-16 text-green-600" />
            )}
            <p className="text-xl font-semibold text-gray-800 text-center">
              {getLoadingMessage()}
            </p>
          </div>
        </div>
      )}

      <header className="bg-white text-gray-900 py-2 px-3 shadow-sm border-b border-gray-200 shrink-0 z-50 print:hidden">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Phiếu thu
            </a>
            <img src={logo} alt="Y99 Logo" className="w-10 h-10 object-contain" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold flex items-center gap-1.5 truncate">
                <CalendarClock className="w-5 h-5 text-emerald-600 shrink-0" />
                Đến hạn 3 ngày
              </h1>
              <p className="text-xs text-gray-500 truncate">
                Tạo phiếu thu thường từ khoản vay đến hạn — tách riêng trang phiếu thu cũ
              </p>
            </div>
          </div>

          {step === 'queue' && currentSlip && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setStep('select');
                  setSlipQueue([]);
                  setQueueIndex(0);
                }}
                className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Chọn lại
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium border border-gray-300"
              >
                <Printer className="w-4 h-4" />
                In
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadPDF()}
                disabled={isExporting || slipQueue.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Xuất PDF
                {slipQueue.length > 1 ? ` (${slipQueue.length})` : ''}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 p-2 md:p-3 print:p-0 flex flex-col overflow-hidden">
        <div className="w-full max-w-[1600px] mx-auto flex-1 min-h-0 flex flex-col print:block">
          {step === 'select' && (
            <div className="flex-1 min-h-0 flex flex-col print:hidden">
              <DueSoonLoanPicker onConfirm={handleConfirm} />
            </div>
          )}

          {step === 'queue' && currentSlip && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 print:block">
              <div className="lg:col-span-3 print:hidden space-y-3">
                <div className="bg-white border border-emerald-200 rounded-lg shadow-sm p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-emerald-900">
                      Hàng đợi ({queueIndex + 1}/{slipQueue.length})
                    </p>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto space-y-1">
                    {slipQueue.map((slip, index) => {
                      const active = index === queueIndex;
                      return (
                        <div
                          key={`${slip.contractId}-${slip.deadline}-${slip.fullName}-${slip.amount}-${index}`}
                          className={`rounded-lg border transition-colors ${
                            active
                              ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setQueueIndex(index)}
                            className="w-full text-left px-2 py-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {index + 1}. {slip.fullName || 'Không tên'}
                                </p>
                                <p className="text-[11px] text-gray-500 truncate">
                                  {slip.contractId || '—'}
                                </p>
                              </div>
                              <span className="text-xs font-semibold tabular-nums text-emerald-800 shrink-0">
                                {formatMoney(slip.amount)}
                              </span>
                            </div>
                          </button>
                          <div className="px-2 pb-1.5 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeFromQueue(index)}
                              className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600"
                              aria-label={`Xóa phiếu ${slip.contractId || index + 1}`}
                            >
                              <X className="w-3 h-3" />
                              Bỏ
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-3">
                  <p className="text-sm font-semibold text-gray-800">
                    Chỉnh phiếu đang xem
                  </p>
                  <label className="block text-xs text-gray-600">
                    Địa chỉ
                    <input
                      type="text"
                      value={currentSlip.address}
                      onChange={(e) => updateCurrentSlip({ address: e.target.value })}
                      className="mt-1 w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Địa chỉ khách hàng (nếu cần)"
                    />
                  </label>
                  <label className="block text-xs text-gray-600">
                    Nội dung chuyển khoản
                    <textarea
                      value={currentSlip.transferContent}
                      onChange={(e) =>
                        updateCurrentSlip({ transferContent: e.target.value })
                      }
                      rows={2}
                      className="mt-1 w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
                    />
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                      <div className="text-gray-400">Gốc</div>
                      <div className="font-medium tabular-nums">
                        {formatLoanAmount(currentSlip.principal)}
                      </div>
                    </div>
                    <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                      <div className="text-gray-400">Lãi</div>
                      <div className="font-medium tabular-nums">
                        {formatLoanAmount(currentSlip.interest)}
                      </div>
                    </div>
                    <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                      <div className="text-gray-400">Phí</div>
                      <div className="font-medium tabular-nums">
                        {formatLoanAmount(currentSlip.managementFee)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-9 print:w-full" ref={previewContainerRef}>
                <div className="sticky top-20 print:static">
                  <div
                    className="flex justify-center origin-top print:block print:transform-none"
                    style={{
                      transform: `scale(${scale})`,
                      transformOrigin: 'top center',
                      height: `calc(297mm * ${scale})`,
                      marginBottom: '20px',
                    }}
                  >
                    <div className="shadow-2xl print:shadow-none">
                      <SlipPreview
                        id="due-soon-print-area"
                        customer={currentSlip}
                        company={DEFAULT_COMPANY_INFO}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DueSoonPage;
