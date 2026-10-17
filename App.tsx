import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_COMPANY_INFO, DEFAULT_CUSTOMER_DATA } from './constants';
import { CustomerData, UpgradePackage } from './types';
import { InputForm } from './components/InputForm';
import { SlipPreview } from './components/SlipPreview';
import { UpgradePackageSelector } from './components/UpgradePackage';
import { Printer, Download, CheckCircle2, Zap } from 'lucide-react'; // TODO: Note - CheckCircle2 để sau này xóa
import AppNavbar from './components/AppNavbar';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getStoredPackage, getPackageInfo } from './upgradePackages';

const loadingGif = new URL('./cat Mark loading.gif', import.meta.url).href;

type LoadingStage = 'idle' | 'spinning' | 'preparing' | 'aboutToExport' | 'success'; // TODO: Note - 'success' để sau này xóa

const App: React.FC = () => {
  const [customerData, setCustomerData] = useState<CustomerData>(DEFAULT_CUSTOMER_DATA);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
  const [scale, setScale] = useState(1);
  const [pdfFileName, setPdfFileName] = useState('');
  const [isFileNameManuallyEdited, setIsFileNameManuallyEdited] = useState(false);
  const [currentPackage, setCurrentPackage] = useState<UpgradePackage>(getStoredPackage());
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const getSlipPrefix = (type: CustomerData['type']) => {
    if (type === 'SETTLEMENT') return 'Phiếu tất toán';
    if (type === 'CASH') return 'Phiếu thu tiền mặt';
    return 'Phiếu thu tiền';
  };

  const formatDayMonthForFileName = (date: Date = new Date()) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    // Hiển thị đúng cú pháp ngày/tháng như yêu cầu.
    // Khi lưu file, ký tự "/" sẽ được sanitize thành "-" để hợp lệ trên Windows.
    return `(${dd}/${mm})`;
  };

  const getDateForFileName = (data: CustomerData) => {
    // Ưu tiên lấy theo "Thời hạn thanh toán" (deadline). Nếu thiếu/không hợp lệ thì dùng ngày hiện tại.
    if (data.deadline) {
      const d = new Date(data.deadline);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  };

  const buildAutoPdfBaseName = (data: CustomerData) => {
    if (!data.fullName?.trim()) return '';
    return `${getSlipPrefix(data.type)} - ${data.fullName.trim()} ${formatDayMonthForFileName(getDateForFileName(data))}`;
  };

  const sanitizeFileName = (name: string) => {
    const extMatch = name.match(/(\.[A-Za-z0-9]{1,8})$/);
    const ext = extMatch ? extMatch[1] : '';
    const stem = ext ? name.slice(0, -ext.length) : name;
    const safe =
      stem
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[\\/:*?"<>|\r\n\t]/g, '-')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*-\s*/g, ' - ')
        .trim()
        .replace(/[.\s]+$/g, '') || 'phieu-thu';
    return ext ? `${safe}${ext}` : safe;
  };

  const ensurePdfExtension = (name: string) => {
    const trimmed = name.trim();
    return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
  };

  // Calculate scale to fit A4 preview in the container
  useEffect(() => {
    const calculateScale = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.offsetWidth;
        const slipWidthPx = 794; // 210mm approx at 96dpi
        const padding = 32; // Safety margin
        
        // Scale down if container is smaller than slip (plus padding)
        // Ensure scale doesn't exceed 1 (no zooming in on large screens, just fit or actual size)
        const newScale = Math.min(1, (containerWidth - padding) / slipWidthPx);
        setScale(newScale);
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  // Auto-update filename when customer name changes
  useEffect(() => {
    // Only auto-update if user hasn't manually edited AND input is not focused
    const isInputFocused = document.activeElement === fileNameInputRef.current;
    
    if (!isFileNameManuallyEdited && !isInputFocused) {
      setPdfFileName(buildAutoPdfBaseName(customerData));
    }
  }, [customerData.fullName, customerData.type, customerData.deadline, isFileNameManuallyEdited]);

  const handleDownloadPDF = async () => {
    const input = document.getElementById('print-area');
    if (!input) return;

    setIsExporting(true);
    setLoadingStage('spinning');

    try {
        const packageInfo = getPackageInfo(currentPackage);
        const totalTime = packageInfo.exportTime;
        const imageRenderTime = 500; // Time needed for images to render
        
        // Calculate stage timings based on package
        // Total delay = stage1Time + stage2Time + stage3Time + imageRenderTime
        // We want total delay to match packageInfo.exportTime
        const availableDelayTime = Math.max(0, totalTime - imageRenderTime);
        
        let stage1Time = 0;
        let stage2Time = 0;
        let stage3Time = 0;

        if (totalTime >= 20000) {
          // Free package: Full stages (30s total)
          stage1Time = Math.floor(availableDelayTime * 0.3); // 30% - ~9s
          stage2Time = Math.floor(availableDelayTime * 0.4); // 40% - ~12s
          stage3Time = availableDelayTime - stage1Time - stage2Time; // 30% - ~9s
        } else if (totalTime >= 8000) {
          // Basic package: Reduced stages (10s total)
          stage1Time = Math.floor(availableDelayTime * 0.35); // 35% - ~3.3s
          stage2Time = Math.floor(availableDelayTime * 0.4); // 40% - ~3.8s
          stage3Time = availableDelayTime - stage1Time - stage2Time; // 25% - ~2.4s
        } else if (totalTime >= 3000) {
          // Premium package: Quick stages (5s total)
          stage1Time = Math.floor(availableDelayTime * 0.4); // 40% - ~1.8s
          stage2Time = Math.floor(availableDelayTime * 0.35); // 35% - ~1.6s
          stage3Time = availableDelayTime - stage1Time - stage2Time; // 25% - ~1.1s
        } else {
          // Pro package: Minimal delay (1s total)
          stage1Time = Math.floor(availableDelayTime * 0.5); // 50% - ~0.25s
          stage2Time = Math.floor(availableDelayTime * 0.3); // 30% - ~0.15s
          stage3Time = availableDelayTime - stage1Time - stage2Time; // 20% - ~0.1s
        }

        // Stage 1: Spinning (đang quay)
        if (stage1Time > 0) {
          await new Promise(resolve => setTimeout(resolve, stage1Time));
        }

        // Stage 2: Preparing (sắp xuất)
        if (stage2Time > 0) {
          setLoadingStage('preparing');
          await new Promise(resolve => setTimeout(resolve, stage2Time));
        }

        // Stage 3: About to Export (sắp ra)
        if (stage3Time > 0) {
          setLoadingStage('aboutToExport');
          await new Promise(resolve => setTimeout(resolve, stage3Time));
        }

        // Wait for fonts/images to render
        await document.fonts?.ready;
        await new Promise(resolve => setTimeout(resolve, imageRenderTime));

        const EXPORT_SCALE = 3;
        const JPEG_QUALITY = 0.95;

        // Capture print-area at true layout size (ignore preview scale wrapper)
        const canvas = await html2canvas(input, {
            scale: EXPORT_SCALE,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: input.scrollWidth,
            height: input.scrollHeight,
            scrollX: 0,
            scrollY: -window.scrollY,
        });

        const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        
        // A4 Dimensions in mm
        const pdfWidth = 210; 
        const pdfHeight = 297;

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        // Use higher-quality interpolation (slower, but sharper)
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');

        // Use custom filename if provided, otherwise use default (auto)
        const autoBase = buildAutoPdfBaseName(customerData) || getSlipPrefix(customerData.type);
        const base = pdfFileName.trim() ? pdfFileName.trim() : autoBase;
        const safeFileName = ensurePdfExtension(sanitizeFileName(base));
        pdf.save(safeFileName);

        // TODO: Note - Phần này để sau này xóa (Stage 4: Success - đã xuất khi thành công)
        setLoadingStage('success');
        await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
        console.error("PDF Export failed", error);
        alert("Lỗi khi xuất PDF. Vui lòng thử lại.");
        setLoadingStage('idle');
    } finally {
        setIsExporting(false);
        setLoadingStage('idle');
    }
  };

  const handlePrint = () => {
      window.print();
  };

  const getLoadingMessage = () => {
    switch (loadingStage) {
      case 'spinning':
        return 'Đang quay...';
      case 'preparing':
        return 'Sắp xuất...';
      case 'aboutToExport':
        return 'Sắp ra...';
      case 'success':
        // TODO: Note - Phần này để sau này xóa
        return 'Đã xuất ra';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Loading Overlay */}
      {isExporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] print:hidden">
          <div className="bg-white rounded-xl p-8 shadow-2xl max-w-sm w-full mx-4 flex flex-col items-center gap-4">
            {(loadingStage === 'spinning' || loadingStage === 'preparing' || loadingStage === 'aboutToExport') && (
              <img 
                src={loadingGif} 
                alt="Loading..." 
                className="w-32 h-32 object-contain" 
              />
            )}
            {/* TODO: Note - Phần này để sau này xóa */}
            {loadingStage === 'success' && (
              <CheckCircle2 className="w-16 h-16 text-green-600" />
            )}
            <p className="text-xl font-semibold text-gray-800 text-center">
              {getLoadingMessage()}
            </p>
            {(loadingStage === 'spinning' || loadingStage === 'preparing' || loadingStage === 'aboutToExport') && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div 
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    loadingStage === 'aboutToExport' ? 'bg-orange-600' : 'bg-blue-600'
                  }`}
                  style={{
                    width: loadingStage === 'spinning' ? '30%' : loadingStage === 'preparing' ? '70%' : '100%'
                  }}
                ></div>
              </div>
            )}
          </div>
        </div>
      )}

      <AppNavbar
        current="slip"
        toolbar={
          <>
            <label htmlFor="pdf-filename" className="sr-only">
              Tên file
            </label>
            <input
              ref={fileNameInputRef}
              id="pdf-filename"
              type="text"
              value={pdfFileName}
              onChange={(e) => {
                const newValue = e.target.value;
                setPdfFileName(newValue);
                const expectedAutoFileName = buildAutoPdfBaseName(customerData);
                setIsFileNameManuallyEdited(newValue !== expectedAutoFileName);
              }}
              onBlur={() => {
                const expectedAutoFileName = buildAutoPdfBaseName(customerData);
                if (pdfFileName === expectedAutoFileName || !pdfFileName.trim()) {
                  setIsFileNameManuallyEdited(false);
                  if (!pdfFileName.trim()) setPdfFileName(expectedAutoFileName);
                }
              }}
              placeholder={
                buildAutoPdfBaseName(customerData) ||
                `${getSlipPrefix(customerData.type)} - Tên khách hàng ${formatDayMonthForFileName(getDateForFileName(customerData))}`
              }
              className="h-7 w-52 rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 sm:w-72"
              disabled={isExporting}
            />
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-sm font-medium ${
                  currentPackage === 'FREE'
                    ? 'border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100'
                    : currentPackage === 'BASIC'
                    ? 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'
                    : currentPackage === 'PREMIUM'
                    ? 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100'
                    : 'border-yellow-400 bg-yellow-50 text-yellow-900 hover:bg-yellow-100'
                }`}
                title={`Gói hiện tại: ${getPackageInfo(currentPackage).name}`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>{currentPackage === 'FREE' ? 'Nâng cấp' : getPackageInfo(currentPackage).name}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 bg-gray-100 px-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>In ngay</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-blue-600 px-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExporting ? (
                  <span className="animate-pulse">Đang tạo...</span>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Xuất PDF</span>
                  </>
                )}
              </button>
            </div>
          </>
        }
      />

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 p-4 md:p-8 print:p-0 print:bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 print:block">
          
          {/* Left Column: Input (Hidden on Print) */}
          <div className="lg:col-span-4 print:hidden space-y-6">
            <InputForm data={customerData} onChange={setCustomerData} />
            
            <div className="bg-white border border-blue-100 p-4 rounded-lg text-sm text-blue-800 shadow-sm">
                <p className="font-semibold mb-1">Hướng dẫn:</p>
                <ul className="list-disc pl-4 space-y-1 opacity-90">
                    <li>Chọn loại phiếu (Thường / Tất toán).</li>
                    <li>Nhập đầy đủ thông tin khách hàng.</li>
                    <li>Mã QR tự động cập nhật số tiền và nội dung.</li>
                    <li>Nhấn "Xuất PDF" để tải về phiếu in khổ A4.</li>
                    <li>Phiếu từ khoản vay đến hạn: mở trang &quot;Đến hạn 3 ngày&quot; (phiếu thu thường).</li>
                </ul>
            </div>
          </div>

          {/* Right Column: Preview (Full width on Print) */}
          <div className="lg:col-span-8 print:w-full" ref={previewContainerRef}>
            <div className="sticky top-12 print:static">
                 <div className="mb-4 flex items-center justify-between lg:hidden print:hidden">
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Xem trước (Khổ A4)</span>
                 </div>
                 
                 {/* Scaled Wrapper for Preview */}
                 {/* This wrapper ensures the A4 slip fits within the container width without scrolling */}
                 <div 
                    className="flex justify-center origin-top print:block print:transform-none"
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: 'top center',
                        height: `calc(297mm * ${scale})`,
                        marginBottom: '20px'
                    }}
                 >
                     <div className="shadow-2xl print:shadow-none">
                     <SlipPreview 
                        id="print-area"
                        customer={customerData} 
                        company={DEFAULT_COMPANY_INFO} 
                     />
                     </div>
                 </div>
            </div>
          </div>

        </div>
      </main>

      {/* Upgrade Package Modal */}
      {showUpgradeModal && (
        <UpgradePackageSelector
          currentPackage={currentPackage}
          onPackageChange={(pkg) => {
            setCurrentPackage(pkg);
          }}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
};

export default App;