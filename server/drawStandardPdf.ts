import { jsPDF } from 'jspdf';
import { SLIP_COMPANY, type SlipCustomerData } from './slipCompany';
import { fetchVietQrPng } from './vietQrImage';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;

let fontCache: { regular?: string; bold?: string } = {};

async function loadFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được font (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('base64');
}

async function ensureFonts(pdf: jsPDF): Promise<boolean> {
  try {
    if (!fontCache.regular) {
      fontCache.regular = await loadFontBase64(
        'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf'
      );
    }
    if (!fontCache.bold) {
      fontCache.bold = await loadFontBase64(
        'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf'
      );
    }
    pdf.addFileToVFS('DejaVuSans.ttf', fontCache.regular);
    pdf.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
    pdf.addFileToVFS('DejaVuSans-Bold.ttf', fontCache.bold);
    pdf.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
    return true;
  } catch {
    return false;
  }
}

function formatMoney(amount: number, suffix = 'VND'): string {
  const formatted = new Intl.NumberFormat('vi-VN').format(amount || 0);
  return suffix ? `${formatted} ${suffix}` : formatted;
}

function formatDate(dateString: string): string {
  if (!dateString) return '...';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  return `Ngày ${dd} tháng ${mm} năm ${date.getFullYear()}`;
}

function setFont(
  pdf: jsPDF,
  useUnicode: boolean,
  style: 'normal' | 'bold',
  size: number
) {
  if (useUnicode) {
    pdf.setFont('DejaVu', style);
  } else {
    pdf.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
  }
  pdf.setFontSize(size);
}

/**
 * Draw STANDARD payment slip to PDF buffer (A4).
 * QR via img.vietqr.io — no extra QR npm package.
 */
export async function drawStandardSlipPdf(
  customer: SlipCustomerData
): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const useUnicode = await ensureFonts(pdf);
  const company = SLIP_COMPANY;
  let y = MARGIN;

  pdf.setTextColor(0, 0, 0);
  setFont(pdf, useUnicode, 'bold', 12);
  pdf.text(company.name.trim(), MARGIN, y);
  y += 6;
  setFont(pdf, useUnicode, 'normal', 9);
  pdf.setTextColor(60, 60, 60);
  const addrLines = pdf.splitTextToSize(company.address, PAGE_W - MARGIN * 2 - 30);
  pdf.text(addrLines, MARGIN, y);
  y += addrLines.length * 4.5 + 8;

  pdf.setTextColor(0, 0, 0);
  setFont(pdf, useUnicode, 'bold', 16);
  pdf.text('PHIẾU THU TIỀN', PAGE_W / 2, y, { align: 'center' });
  y += 7;
  setFont(pdf, useUnicode, 'normal', 11);
  pdf.text(formatDate(customer.deadline), PAGE_W / 2, y, { align: 'center' });
  y += 10;

  const labelW = 48;
  const drawRow = (label: string, value: string, boldValue = false) => {
    setFont(pdf, useUnicode, 'bold', 10);
    pdf.text(label, MARGIN, y);
    setFont(pdf, useUnicode, boldValue ? 'bold' : 'normal', 10);
    const lines = pdf.splitTextToSize(value || '—', PAGE_W - MARGIN * 2 - labelW);
    pdf.text(lines, MARGIN + labelW, y);
    y += Math.max(6, lines.length * 5);
  };

  drawRow('Họ tên khách hàng:', customer.fullName);
  drawRow('Mã số hợp đồng:', customer.contractId);
  drawRow('Địa chỉ:', customer.address);

  setFont(pdf, useUnicode, 'bold', 10);
  pdf.text('Tổng tiền thanh toán:', MARGIN, y);
  pdf.setTextColor(153, 0, 0);
  setFont(pdf, useUnicode, 'bold', 12);
  pdf.text(formatMoney(customer.amount), MARGIN + labelW, y);
  pdf.setTextColor(0, 0, 0);
  y += 7;

  setFont(pdf, useUnicode, 'normal', 9);
  const breakdown: string[] = [];
  if (customer.principal > 0) breakdown.push(`- Gốc: ${formatMoney(customer.principal, 'VNĐ')}`);
  if (customer.interest > 0) breakdown.push(`- Lãi: ${formatMoney(customer.interest, 'VNĐ')}`);
  if (customer.managementFee > 0) {
    breakdown.push(`- Phí QL: ${formatMoney(customer.managementFee, 'VNĐ')}`);
  }
  for (const line of breakdown) {
    pdf.text(line, MARGIN + 4, y);
    y += 4.5;
  }
  y += 4;

  // Bank box
  const boxTop = y;
  const boxPad = 4;
  y += boxPad + 2;
  setFont(pdf, useUnicode, 'bold', 10);
  pdf.text('Nộp tiền vào tài khoản sau:', MARGIN + boxPad, y);
  y += 6;
  setFont(pdf, useUnicode, 'normal', 9);
  pdf.text(`Tên ngân hàng: ${company.bankName}`, MARGIN + boxPad, y);
  y += 5;
  pdf.text(`Tên chủ tài khoản: ${company.bankAccountName}`, MARGIN + boxPad, y);
  y += 5;
  pdf.text(`Số tài khoản: ${company.bankAccountNumber}`, MARGIN + boxPad, y);
  y += 6;
  pdf.setTextColor(180, 0, 0);
  setFont(pdf, useUnicode, 'bold', 9);
  pdf.text('Nội dung chuyển khoản (Bắt buộc):', MARGIN + boxPad, y);
  y += 5;
  setFont(pdf, useUnicode, 'bold', 11);
  const transferLines = pdf.splitTextToSize(
    customer.transferContent || '(Chưa có)',
    PAGE_W - MARGIN * 2 - boxPad * 2
  );
  pdf.text(transferLines, MARGIN + boxPad, y);
  y += transferLines.length * 5 + boxPad;
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.6);
  pdf.rect(MARGIN, boxTop, PAGE_W - MARGIN * 2, y - boxTop);

  y += 8;
  setFont(pdf, useUnicode, 'normal', 9);
  pdf.setTextColor(40, 40, 40);
  const tip =
    'Quý khách hàng khi chuyển khoản vui lòng quét mã QR bên dưới để hệ thống tự động điền thông tin chính xác!';
  const tipLines = pdf.splitTextToSize(tip, PAGE_W - MARGIN * 2 - 10);
  pdf.text(tipLines, PAGE_W / 2, y, { align: 'center' });
  y += tipLines.length * 4.5 + 4;

  const qrPng = await fetchVietQrPng(customer);
  const qrSize = 48;
  const qrX = (PAGE_W - qrSize) / 2;
  if (qrPng) {
    pdf.addImage(
      `data:image/png;base64,${qrPng.toString('base64')}`,
      'PNG',
      qrX,
      y,
      qrSize,
      qrSize
    );
  } else {
    pdf.setDrawColor(0, 100, 200);
    pdf.rect(qrX, y, qrSize, qrSize);
    setFont(pdf, useUnicode, 'normal', 8);
    pdf.text('QR không tải được', PAGE_W / 2, y + qrSize / 2, { align: 'center' });
  }
  y += qrSize + 6;

  pdf.setTextColor(180, 0, 0);
  setFont(pdf, useUnicode, 'bold', 9);
  const meta = [
    `Số tiền: ${formatMoney(customer.amount)}`,
    `Nội dung: ${customer.transferContent || '(Chưa có)'}`,
    `Tên chủ TK: ${company.bankAccountName}`,
    `Số TK: ${company.bankAccountNumber}`,
    company.bankName,
  ];
  for (const line of meta) {
    const lines = pdf.splitTextToSize(line, PAGE_W - MARGIN * 2);
    pdf.text(lines, PAGE_W / 2, y, { align: 'center' });
    y += lines.length * 4.2;
  }

  y = Math.max(y + 6, PAGE_H - 40);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;
  pdf.setTextColor(180, 0, 0);
  setFont(pdf, useUnicode, 'bold', 8);
  const note = `Lưu ý: ${company.name.trim()} sẽ không hoàn lại khoản tiền đã đóng với bất kỳ lý do gì. Quý khách vui lòng kiểm tra đầy đủ thông tin số tiền và nội dung chuyển khoản. Mọi chi tiết xin liên hệ Bộ phận Chăm sóc khách hàng.`;
  const noteLines = pdf.splitTextToSize(note, PAGE_W - MARGIN * 2);
  pdf.text(noteLines, MARGIN, y);
  y += noteLines.length * 3.8 + 4;
  pdf.setTextColor(0, 0, 0);
  setFont(pdf, useUnicode, 'bold', 9);
  pdf.text(`Hotline: ${company.hotline}`, PAGE_W / 2, y, { align: 'center' });

  const arrayBuf = pdf.output('arraybuffer');
  return Buffer.from(arrayBuf);
}
