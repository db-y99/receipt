/**
 * Keep this handler self-contained (no relative ESM imports).
 * Vercel Node ESM cannot resolve extensionless imports like ../lib/foo —
 * that crash is FUNCTION_INVOCATION_FAILED (HTTP 500).
 * Same pattern as api/loans/due-soon.ts.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsPDF } from 'jspdf';

export const config = {
  maxDuration: 60,
};

const MAX_CODES = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20;

const SLIP_COMPANY = {
  name: ' CÔNG TY CỔ PHẦN CẦM ĐỒ Y99',
  address: '99B Nguyễn Trãi, phường Ninh Kiều, Cần Thơ',
  bankName: 'Vietcombank',
  bankAccountName: 'CONG TY CO PHAN CAM DO Y99',
  bankAccountNumber: '1058526128',
  bankId: 'VCB',
  hotline: '1900575792 | +84 292 38 999 33 (Nước ngoài)',
} as const;

type SlipCustomerData = {
  type: 'STANDARD';
  fullName: string;
  customerId: string;
  contractId: string;
  transferContent: string;
  address: string;
  amount: number;
  deadline: string;
  principal: number;
  interest: number;
  managementFee: number;
};

type SlipLoanRecord = {
  id?: number;
  code?: string;
  application__code?: string;
  application__address?: string;
  customer__code?: string;
  customer__fullname?: string;
  due_date?: string;
  due_amount?: number | string;
  prin_next_amount?: number | string;
  itr_next_amount?: number | string;
  fee_next_amount?: number | string;
};

let fontCache: { regular?: string; bold?: string } = {};

function getApiKey(req: VercelRequest): string {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string') return header.trim();
  if (Array.isArray(header) && header[0]) return header[0].trim();
  return '';
}

function parseLoanCodes(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const record = body as Record<string, unknown>;
  let list: string[] = [];
  if (typeof record.loanCode === 'string' && record.loanCode.trim()) {
    list = [record.loanCode.trim()];
  } else if (Array.isArray(record.loanCodes)) {
    list = record.loanCodes.map((c) => String(c || '').trim()).filter(Boolean);
  } else if (typeof record.loanCodes === 'string') {
    list = record.loanCodes
      .split(/[\s,;]+/)
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return [...new Set(list)].slice(0, MAX_CODES);
}

function parseCustomerData(body: unknown): SlipCustomerData | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const data = record.customerData;
  if (!data || typeof data !== 'object') return null;
  const c = data as Record<string, unknown>;
  return {
    type: 'STANDARD',
    fullName: String(c.fullName || ''),
    customerId: String(c.customerId || ''),
    contractId: String(c.contractId || ''),
    transferContent: String(c.transferContent || ''),
    address: String(c.address || ''),
    amount: Number(c.amount) || 0,
    deadline: String(c.deadline || new Date().toISOString().split('T')[0]),
    principal: Number(c.principal) || 0,
    interest: Number(c.interest) || 0,
    managementFee: Number(c.managementFee) || 0,
  };
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function normalizeDueDate(value?: string): string {
  if (!value) return new Date().toISOString().split('T')[0];
  const datePart = value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function buildTransferContent(parts: {
  fullName: string;
  contractId: string;
  principal: number;
  interest: number;
  managementFee: number;
}): string {
  const chunks: string[] = [];
  if (parts.fullName) chunks.push(removeVietnameseAccents(parts.fullName));
  if (parts.contractId) chunks.push(removeVietnameseAccents(parts.contractId));
  if (parts.principal > 0) chunks.push(`Goc ${parts.principal}`);
  if (parts.interest > 0) chunks.push(`Lai ${parts.interest}`);
  if (parts.managementFee > 0) chunks.push(`Phi QL ${parts.managementFee}`);
  const content = chunks.join(' ');
  return content.length > 95 ? content.substring(0, 95) : content;
}

function mapLoanToStandardSlip(loan: SlipLoanRecord): SlipCustomerData {
  const principal = toNumber(loan.prin_next_amount);
  const interest = toNumber(loan.itr_next_amount);
  const managementFee = toNumber(loan.fee_next_amount);
  const amount = principal + interest + managementFee;
  const contractId = loan.application__code || loan.code || '';
  const fullName = loan.customer__fullname || '';

  return {
    type: 'STANDARD',
    fullName,
    customerId: loan.customer__code || '',
    contractId,
    transferContent: buildTransferContent({
      fullName,
      contractId,
      principal,
      interest,
      managementFee,
    }),
    address: loan.application__address?.trim() || '',
    amount,
    deadline: normalizeDueDate(loan.due_date),
    principal,
    interest,
    managementFee,
  };
}

function normalizeLoanResults(payload: unknown): SlipLoanRecord[] {
  if (Array.isArray(payload)) return payload as SlipLoanRecord[];
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['data', 'results', 'items', 'rows']) {
      const candidate = record[key];
      if (Array.isArray(candidate)) return candidate as SlipLoanRecord[];
    }
  }
  return [];
}

const LOAN_FIELDS = [
  'id',
  'code',
  'application__code',
  'application__address',
  'customer__code',
  'customer__fullname',
  'due_date',
  'due_days',
  'due_amount',
  'prin_next_amount',
  'itr_next_amount',
  'fee_next_amount',
].join(',');

function buildLoanLookupUrl(
  apiBaseUrl: string,
  code: string,
  login?: string
): { primary: string; secondary: string } {
  const base = apiBaseUrl.replace(/\/$/, '');
  const isAp = /^AP/i.test(code.trim());
  const trimmed = code.trim();

  const make = (filter: Record<string, unknown>) => {
    const params = new URLSearchParams({
      values: LOAN_FIELDS,
      filter: JSON.stringify(filter),
      sort: '-id',
      limit: '1',
    });
    if (login) params.set('login', login);
    return `${base}/data/Loan/?${params.toString()}`;
  };

  if (isAp) {
    return {
      primary: make({ application__code: trimmed, deleted: 0 }),
      secondary: make({ code: trimmed, deleted: 0 }),
    };
  }
  return {
    primary: make({ code: trimmed, deleted: 0 }),
    secondary: make({ application__code: trimmed, deleted: 0 }),
  };
}

async function fetchLoanByCode(
  apiBaseUrl: string,
  code: string,
  login?: string
): Promise<SlipLoanRecord | null> {
  const { primary, secondary } = buildLoanLookupUrl(apiBaseUrl, code, login);
  for (const url of [primary, secondary]) {
    const response = await fetch(url);
    if (!response.ok) continue;
    const payload = await response.json();
    const rows = normalizeLoanResults(payload);
    if (rows[0]) return rows[0];
  }
  return null;
}

function buildPdfBaseName(data: SlipCustomerData): string {
  if (!data.fullName?.trim()) return 'Phieu thu tien';
  const deadline = data.deadline || '';
  const parts = deadline.split('-');
  const dd = parts[2] || '01';
  const mm = parts[1] || '01';
  return `Phieu thu tien - ${data.fullName.trim()} (${dd}/${mm})`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'phieu-thu';
}

function uniquePdfFileName(baseName: string, used: Set<string>): string {
  let candidate = sanitizeFileName(baseName);
  if (!candidate.toLowerCase().endsWith('.pdf')) candidate += '.pdf';
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

function isPng(buf: Buffer): boolean {
  return (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

function buildVietQrImageUrl(customer: SlipCustomerData): string {
  const bank = encodeURIComponent(SLIP_COMPANY.bankId);
  const account = encodeURIComponent(SLIP_COMPANY.bankAccountNumber);
  const params = new URLSearchParams();
  if (customer.amount > 0) params.set('amount', String(Math.round(customer.amount)));
  if (customer.transferContent) params.set('addInfo', customer.transferContent);
  params.set('accountName', SLIP_COMPANY.bankAccountName);
  return `https://img.vietqr.io/image/${bank}-${account}-compact2.png?${params.toString()}`;
}

async function fetchVietQrPng(customer: SlipCustomerData): Promise<Buffer | null> {
  try {
    const res = await fetch(buildVietQrImageUrl(customer));
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return isPng(buf) ? buf : null;
  } catch {
    return null;
  }
}

async function loadFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được font (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
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

function formatSlipDate(dateString: string): string {
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

async function drawStandardSlipPdf(customer: SlipCustomerData): Promise<Buffer> {
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
  pdf.text(formatSlipDate(customer.deadline), PAGE_W / 2, y, { align: 'center' });
  y += 10;

  const labelW = 48;
  const drawRow = (label: string, value: string) => {
    setFont(pdf, useUnicode, 'bold', 10);
    pdf.text(label, MARGIN, y);
    setFont(pdf, useUnicode, 'normal', 10);
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

  const qrSize = 48;
  const qrX = (PAGE_W - qrSize) / 2;
  const qrPng = await fetchVietQrPng(customer);
  let qrDrawn = false;
  if (qrPng) {
    try {
      pdf.addImage(
        `data:image/png;base64,${qrPng.toString('base64')}`,
        'PNG',
        qrX,
        y,
        qrSize,
        qrSize
      );
      qrDrawn = true;
    } catch {
      qrDrawn = false;
    }
  }
  if (!qrDrawn) {
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

  return Buffer.from(pdf.output('arraybuffer'));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedKey = process.env.SLIP_API_KEY || '';
  if (!expectedKey || getApiKey(req) !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiBaseUrl = process.env.API_BASE_URL || '';
  const apiLogin = process.env.API_LOGIN || '';
  if (!apiBaseUrl) {
    return res.status(503).json({ error: 'Chưa cấu hình API_BASE_URL' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const direct = parseCustomerData(body);
    const codes = parseLoanCodes(body);

    if (!direct && codes.length === 0) {
      return res.status(400).json({
        error: 'Cần loanCodes (mảng mã AP/LN) hoặc customerData',
      });
    }

    const slips: { fileName: string; pdf: Buffer }[] = [];
    const missingCodes: string[] = [];
    const usedNames = new Set<string>();

    if (direct) {
      const pdf = await drawStandardSlipPdf(direct);
      slips.push({
        fileName: uniquePdfFileName(buildPdfBaseName(direct), usedNames),
        pdf,
      });
    } else {
      for (const code of codes) {
        const loan = await fetchLoanByCode(apiBaseUrl, code, apiLogin);
        if (!loan) {
          missingCodes.push(code);
          continue;
        }
        const slip = mapLoanToStandardSlip(loan);
        const pdf = await drawStandardSlipPdf(slip);
        const base =
          codes.length > 1 && slip.contractId
            ? `${buildPdfBaseName(slip)} - ${slip.contractId}`
            : buildPdfBaseName(slip);
        slips.push({
          fileName: uniquePdfFileName(base, usedNames),
          pdf,
        });
      }
    }

    if (slips.length === 0) {
      return res.status(404).json({
        error: 'Không tìm thấy khoản vay nào để tạo phiếu',
        missingCodes,
      });
    }

    if (missingCodes.length > 0) {
      res.setHeader('X-Missing-Codes', missingCodes.join(','));
    }
    res.setHeader('X-Generated-Count', String(slips.length));

    if (slips.length === 1) {
      const file = slips[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', contentDisposition(file.fileName));
      return res.status(200).send(file.pdf);
    }

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const file of slips) {
      zip.file(file.fileName, file.pdf);
    }
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
    const zipName = `Phieu-thu-${slips.length}-files.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', contentDisposition(zipName));
    return res.status(200).send(zipBuf);
  } catch (err) {
    console.error('[api/slips/generate]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Tạo phiếu thất bại',
    });
  }
}
