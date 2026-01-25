import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_COMPANY_INFO, DEFAULT_CUSTOMER_DATA } from './constants';
import { CustomerData, UpgradePackage } from './types';
import { InputForm } from './components/InputForm';
import { SlipPreview } from './components/SlipPreview';
import { UpgradePackageSelector } from './components/UpgradePackage';
import { Printer, Download, CheckCircle2, Zap } from 'lucide-react'; // TODO: Note - CheckCircle2 để sau này xóa
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getStoredPackage, getPackageInfo } from './upgradePackages';

const loadingGif = new URL('./cat Mark loading.gif', import.meta.url).href;
const logo = new URL('./logo.png', import.meta.url).href;

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

  const getSlipPrefix = (type: CustomerData['type']) =>
    type === 'SETTLEMENT' ? 'Phiếu tất toán' : 'Phiếu thu tiền';

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
    // Remove characters that are invalid for Windows/macOS filenames
    // \ / : * ? " < > | plus newlines/tabs.
    let safe = name.replace(/[\\/:*?"<>|\r\n\t]/g, '-');
    // Collapse whitespace and dashes a bit
    safe = safe.replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' - ').trim();
    // Windows also dislikes trailing dots/spaces
    safe = safe.replace(/[.\s]+$/g, '');
    return safe;
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

        // Wait for images to render
        await new Promise(resolve => setTimeout(resolve, imageRenderTime));

        // When capturing, we want high resolution.
        // If the element is visually scaled down by CSS transform on parent, 
        // html2canvas might need windowWidth/windowHeight or explicit scale adjustment.
        // However, since the transform is on the parent wrapper and we capture the child,
        // we mainly need to ensure high scale in options.
        const canvas = await html2canvas(input, {
            scale: 3, // Higher scale for better quality
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        
        // A4 Dimensions in mm
        const pdfWidth = 210; 
        const pdfHeight = 297;

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

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

      {/* Header Bar */}
      <header className="bg-white text-gray-900 py-1 px-2 shadow-sm border-b border-gray-200 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <img src={logo} alt="Y99 Logo" className="w-16 h-16 object-contain" />
            <div>
                <h1 className="text-xl font-bold">Y99 Generator</h1>
                <p className="text-xs text-gray-500">Hệ thống tạo phiếu thu tự động</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium border
                ${currentPackage === 'FREE' 
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100' 
                  : currentPackage === 'BASIC'
                  ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                  : currentPackage === 'PREMIUM'
                  ? 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
                  : 'bg-yellow-50 border-yellow-400 text-yellow-800 hover:bg-yellow-100'
                }
              `}
              title={`Gói hiện tại: ${getPackageInfo(currentPackage).name}`}
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">
                {currentPackage === 'FREE' ? 'Nâng cấp' : getPackageInfo(currentPackage).name}
              </span>
            </button>
            <div className="flex items-center gap-2">
              <label htmlFor="pdf-filename" className="text-sm text-gray-600 whitespace-nowrap">
                Tên file:
              </label>
              <input
                ref={fileNameInputRef}
                id="pdf-filename"
                type="text"
                value={pdfFileName}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setPdfFileName(newValue);
                  
                  // Check if the new value matches the current auto-generated format
                  const expectedAutoFileName = buildAutoPdfBaseName(customerData);
                  
                  // Mark as manually edited if it's different from auto format
                  if (newValue !== expectedAutoFileName) {
                    setIsFileNameManuallyEdited(true);
                  } else {
                    // If user types back to match auto format, reset flag to allow auto-update
                    setIsFileNameManuallyEdited(false);
                  }
                }}
                onBlur={() => {
                  // When user leaves the input, check if it matches auto format
                  const expectedAutoFileName = buildAutoPdfBaseName(customerData);
                  
                  if (pdfFileName === expectedAutoFileName || !pdfFileName.trim()) {
                    setIsFileNameManuallyEdited(false);
                    // Update to current format if empty
                    if (!pdfFileName.trim()) setPdfFileName(expectedAutoFileName);
                  }
                }}
                placeholder={
                  buildAutoPdfBaseName(customerData) ||
                  `${getSlipPrefix(customerData.type)} - Tên khách hàng ${formatDayMonthForFileName(getDateForFileName(customerData))}`
                }
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80 sm:w-96 md:w-[420px]"
                disabled={isExporting}
              />
            </div>
            <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors text-sm font-medium border border-gray-300"
            >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">In ngay</span>
            </button>
            <button 
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
                {isExporting ? (
                    <span className="animate-pulse">Đang tạo...</span>
                ) : (
                    <>
                        <Download className="w-4 h-4" />
                        <span>Xuất PDF</span>
                    </>
                )}
            </button>
          </div>
        </div>
      </header>

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
                </ul>
            </div>
          </div>

          {/* Right Column: Preview (Full width on Print) */}
          <div className="lg:col-span-8 print:w-full" ref={previewContainerRef}>
            <div className="sticky top-24 print:static">
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
                        // Reserve physical space for the scaled element to prevent overlap
                        // 297mm height scaled down
                        height: `calc(297mm * ${scale})`,
                        marginBottom: '20px'
                    }}
                 >
                     <SlipPreview 
                        id="print-area"
                        customer={customerData} 
                        company={DEFAULT_COMPANY_INFO} 
                     />
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