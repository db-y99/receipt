import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_COMPANY_INFO, DEFAULT_CUSTOMER_DATA } from './constants';
import { CustomerData } from './types';
import { InputForm } from './components/InputForm';
import { SlipPreview } from './components/SlipPreview';
import { Printer, Download, ReceiptText, CheckCircle2 } from 'lucide-react'; // TODO: Note - CheckCircle2 để sau này xóa
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const loadingGif = new URL('./cat Mark loading.gif', import.meta.url).href;

type LoadingStage = 'idle' | 'spinning' | 'preparing' | 'aboutToExport' | 'success'; // TODO: Note - 'success' để sau này xóa

const App: React.FC = () => {
  const [customerData, setCustomerData] = useState<CustomerData>(DEFAULT_CUSTOMER_DATA);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
  const [scale, setScale] = useState(1);
  const [pdfFileName, setPdfFileName] = useState('');
  const [isFileNameManuallyEdited, setIsFileNameManuallyEdited] = useState(false);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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
      if (customerData.fullName) {
        const autoFileName = `PHIẾU THU TIỀN - ${customerData.fullName}`;
        setPdfFileName(autoFileName);
      } else {
        setPdfFileName('');
      }
    }
  }, [customerData.fullName, isFileNameManuallyEdited]);

  const handleDownloadPDF = async () => {
    const input = document.getElementById('print-area');
    if (!input) return;

    setIsExporting(true);
    setLoadingStage('spinning');

    try {
        // Stage 1: Spinning (đang quay) - 0-3 seconds
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Stage 2: Preparing (sắp xuất) - 3-7 seconds
        setLoadingStage('preparing');
        await new Promise(resolve => setTimeout(resolve, 4000));

        // Stage 3: About to Export (sắp ra) - 7-10 seconds
        setLoadingStage('aboutToExport');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Wait for images to render
        await new Promise(resolve => setTimeout(resolve, 500));

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

        // Use custom filename if provided, otherwise use default
        const defaultFileName = customerData.fullName 
          ? `PHIẾU THU TIỀN - ${customerData.fullName}.pdf`
          : 'PHIẾU THU TIỀN.pdf';
        const fileName = pdfFileName.trim() 
          ? `${pdfFileName.trim()}.pdf` 
          : defaultFileName;
        pdf.save(fileName);

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
      <header className="bg-white text-gray-900 p-4 shadow-sm border-b border-gray-200 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
                <ReceiptText className="w-6 h-6" />
            </div>
            <div>
                <h1 className="text-xl font-bold">Y99 Generator</h1>
                <p className="text-xs text-gray-500">Hệ thống tạo phiếu thu tự động</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
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
                  const expectedAutoFileName = customerData.fullName 
                    ? `PHIẾU THU TIỀN - ${customerData.fullName}`
                    : '';
                  
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
                  const expectedAutoFileName = customerData.fullName 
                    ? `PHIẾU THU TIỀN - ${customerData.fullName}`
                    : '';
                  
                  if (pdfFileName === expectedAutoFileName || !pdfFileName.trim()) {
                    setIsFileNameManuallyEdited(false);
                    // Update to current format if empty
                    if (!pdfFileName.trim() && customerData.fullName) {
                      setPdfFileName(expectedAutoFileName);
                    }
                  }
                }}
                placeholder={customerData.fullName ? `PHIẾU THU TIỀN - ${customerData.fullName}` : 'PHIẾU THU TIỀN - TÊN KHÁCH HÀNG'}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
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
    </div>
  );
};

export default App;