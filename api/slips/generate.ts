/**
 * Keep this handler self-contained (no relative ESM imports).
 * Vercel Node ESM cannot resolve extensionless imports like ../lib/foo —
 * that crash is FUNCTION_INVOCATION_FAILED (HTTP 500).
 * Same pattern as api/loans/due-soon.ts.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
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

let fontCache: { regular?: string; bold?: string; italic?: string } = {};
let italicReady = false;
let logoDataUrl: string | null | undefined;

const LOGO_ASPECT = 563 / 1000;
const COLOR = {
  black: [0, 0, 0] as const,
  gray700: [55, 65, 81] as const,
  gray300: [209, 213, 219] as const,
  red700: [185, 28, 28] as const,
  red600: [220, 38, 38] as const,
  blue500: [59, 130, 246] as const,
};

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

function tryReadLogo(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    const buf = readFileSync(filePath);
    if (!isPng(buf)) return null;
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function loadLogoDataUrl(): Promise<string | null> {
  if (logoDataUrl !== undefined) return logoDataUrl;
  const local = [
    join(process.cwd(), 'logo.png'),
    join(process.cwd(), 'public', 'logo.png'),
    join(process.cwd(), 'receipt', 'logo.png'),
  ];
  for (const filePath of local) {
    const data = tryReadLogo(filePath);
    if (data) {
      logoDataUrl = data;
      return data;
    }
  }
  try {
    const res = await fetch('https://payment.y99.info/logo.png');
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (isPng(buf)) {
        logoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
        return logoDataUrl;
      }
    }
  } catch {
    // keep going
  }
  logoDataUrl = null;
  return null;
}

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function formatTlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

function generateVietQrPayload(customer: SlipCustomerData): string {
  const accountNo = SLIP_COMPANY.bankAccountNumber;
  if (!accountNo) return '';
  const amount = customer.amount > 0 ? Math.round(customer.amount) : 0;
  const content = (customer.transferContent || '').trim();
  const pfi = formatTlv('00', '01');
  const method = formatTlv('01', amount || content ? '12' : '11');
  const guid = formatTlv('00', 'A000000727');
  const merchant = formatTlv(
    '38',
    guid +
      formatTlv('01', formatTlv('00', '970436') + formatTlv('01', accountNo)) +
      formatTlv('02', 'QRIBFTTA')
  );
  const currency = formatTlv('53', '704');
  const amountStr = amount ? formatTlv('54', String(amount)) : '';
  const country = formatTlv('58', 'VN');
  let additional = '';
  if (content) {
    additional = formatTlv('62', formatTlv('08', content.slice(0, 95)));
  }
  const raw = `${pfi}${method}${merchant}${currency}${amountStr}${country}${additional}6304`;
  return `${raw}${crc16(raw)}`;
}

async function fetchPlainQrPng(payload: string): Promise<Buffer | null> {
  if (!payload) return null;
  try {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=M&margin=8&format=png&data=${encodeURIComponent(payload)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return isPng(buf) ? buf : null;
  } catch {
    return null;
  }
}

function buildVietQrImageUrl(
  customer: SlipCustomerData,
  template: 'qr_only' | 'compact2'
): string {
  const bank = encodeURIComponent(SLIP_COMPANY.bankId);
  const account = encodeURIComponent(SLIP_COMPANY.bankAccountNumber);
  const params = new URLSearchParams();
  if (customer.amount > 0) params.set('amount', String(Math.round(customer.amount)));
  if (customer.transferContent) params.set('addInfo', customer.transferContent);
  params.set('accountName', SLIP_COMPANY.bankAccountName);
  return `https://img.vietqr.io/image/${bank}-${account}-${template}.png?${params.toString()}`;
}

async function fetchVietQrPng(customer: SlipCustomerData): Promise<Buffer | null> {
  const plain = await fetchPlainQrPng(generateVietQrPayload(customer));
  if (plain) return plain;
  for (const template of ['qr_only', 'compact2'] as const) {
    try {
      const res = await fetch(buildVietQrImageUrl(customer, template));
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (isPng(buf)) return buf;
    } catch {
      // try next template
    }
  }
  return null;
}

async function loadFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được font (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

async function ensureFonts(pdf: jsPDF): Promise<boolean> {
  const base = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf';
  try {
    if (!fontCache.regular) {
      fontCache.regular = await loadFontBase64(`${base}/DejaVuSerif.ttf`);
    }
    if (!fontCache.bold) {
      fontCache.bold = await loadFontBase64(`${base}/DejaVuSerif-Bold.ttf`);
    }
    pdf.addFileToVFS('DejaVuSerif.ttf', fontCache.regular);
    pdf.addFont('DejaVuSerif.ttf', 'DejaVu', 'normal');
    pdf.addFileToVFS('DejaVuSerif-Bold.ttf', fontCache.bold);
    pdf.addFont('DejaVuSerif-Bold.ttf', 'DejaVu', 'bold');
    try {
      if (!fontCache.italic) {
        fontCache.italic = await loadFontBase64(`${base}/DejaVuSerif-Italic.ttf`);
      }
      pdf.addFileToVFS('DejaVuSerif-Italic.ttf', fontCache.italic);
      pdf.addFont('DejaVuSerif-Italic.ttf', 'DejaVu', 'italic');
      italicReady = true;
    } catch {
      italicReady = false;
    }
    return true;
  } catch {
    italicReady = false;
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

type FontStyle = 'normal' | 'bold' | 'italic';

function setFont(
  pdf: jsPDF,
  useUnicode: boolean,
  style: FontStyle,
  size: number
) {
  if (useUnicode) {
    const resolved =
      style === 'italic' && !italicReady ? 'normal' : style;
    pdf.setFont('DejaVu', resolved);
  } else {
    pdf.setFont(
      'times',
      style === 'bold' ? 'bold' : style === 'italic' ? 'italic' : 'normal'
    );
  }
  pdf.setFontSize(size);
}

function rgb(pdf: jsPDF, color: readonly [number, number, number]) {
  pdf.setTextColor(color[0], color[1], color[2]);
}

function makeOpacityState(opacity: number) {
  const Ctor = (
    jsPDF as unknown as {
      GState?: new (params: { opacity: number }) => object;
    }
  ).GState;
  if (typeof Ctor === 'function') return new Ctor({ opacity });
  return { opacity };
}

function drawWatermark(pdf: jsPDF, logo: string) {
  try {
    pdf.saveGraphicsState();
    pdf.setGState(makeOpacityState(0.04) as never);
    const wmW = 32;
    const wmH = wmW * LOGO_ASPECT;
    for (let x = -18; x < PAGE_W + 10; x += 40) {
      for (let yWm = -8; yWm < PAGE_H + 10; yWm += 30) {
        pdf.addImage(logo, 'PNG', x, yWm, wmW, wmH, 'y99logo', 'FAST', -45);
      }
    }
    pdf.restoreGraphicsState();
  } catch {
    pdf.restoreGraphicsState();
  }
}

function drawCenteredLabelValue(
  pdf: jsPDF,
  useUnicode: boolean,
  label: string,
  value: string,
  y: number,
  maxWidth: number
): number {
  const labelStr = `${label} `;
  setFont(pdf, useUnicode, 'bold', 10);
  const labelW = pdf.getTextWidth(labelStr);
  setFont(pdf, useUnicode, 'bold', 10);
  const valueLines = pdf.splitTextToSize(value, Math.max(40, maxWidth - labelW)) as string[];
  const first = valueLines[0] || '';
  const firstW = pdf.getTextWidth(first);
  const startX = (PAGE_W - labelW - firstW) / 2;
  rgb(pdf, COLOR.red700);
  setFont(pdf, useUnicode, 'bold', 10);
  pdf.text(labelStr, startX, y);
  rgb(pdf, COLOR.black);
  pdf.text(first, startX + labelW, y);
  let nextY = y + 4.3;
  for (let i = 1; i < valueLines.length; i += 1) {
    const line = valueLines[i];
    const lineW = pdf.getTextWidth(line);
    pdf.text(line, (PAGE_W - lineW) / 2, nextY);
    nextY += 4.3;
  }
  return nextY;
}

/** Match SlipPreview STANDARD layout used by receipt web download. */
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
  const logo = await loadLogoDataUrl();
  const company = SLIP_COMPANY;
  const innerW = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  if (logo) {
    drawWatermark(pdf, logo);
    const logoW = 21;
    const logoH = logoW * LOGO_ASPECT;
    pdf.addImage(
      logo,
      'PNG',
      PAGE_W - MARGIN - logoW,
      MARGIN - 1,
      logoW,
      logoH,
      'y99logo-header',
      'FAST'
    );
  }

  rgb(pdf, COLOR.black);
  setFont(pdf, useUnicode, 'bold', 14);
  const nameLines = pdf.splitTextToSize(
    company.name.trim(),
    innerW - 24
  ) as string[];
  pdf.text(nameLines, MARGIN, y);
  y += nameLines.length * 5.5 + 1;

  rgb(pdf, COLOR.gray700);
  setFont(pdf, useUnicode, 'italic', 10);
  const addrLines = pdf.splitTextToSize(company.address, innerW - 24) as string[];
  pdf.text(addrLines, MARGIN, y);
  y += addrLines.length * 4.5 + 7;

  rgb(pdf, COLOR.black);
  setFont(pdf, useUnicode, 'bold', 18);
  pdf.text('PHIẾU THU TIỀN', PAGE_W / 2, y, { align: 'center' });
  y += 7;
  setFont(pdf, useUnicode, 'italic', 12);
  pdf.text(formatSlipDate(customer.deadline), PAGE_W / 2, y, { align: 'center' });
  y += 10;

  const rowLabels = [
    'Họ tên khách hàng:',
    'Mã số hợp đồng:',
    'Địa chỉ:',
    'Tổng tiền thanh toán:',
  ];
  setFont(pdf, useUnicode, 'bold', 12);
  const labelW =
    Math.max(...rowLabels.map((label) => pdf.getTextWidth(label))) + 3;

  const drawRow = (label: string, value: string) => {
    rgb(pdf, COLOR.black);
    setFont(pdf, useUnicode, 'bold', 12);
    pdf.text(label, MARGIN, y);
    setFont(pdf, useUnicode, 'normal', 12);
    const lines = pdf.splitTextToSize(
      value || '—',
      innerW - labelW
    ) as string[];
    pdf.text(lines, MARGIN + labelW, y);
    y += Math.max(6.5, lines.length * 5.2);
  };

  drawRow('Họ tên khách hàng:', customer.fullName);
  drawRow('Mã số hợp đồng:', customer.contractId);
  drawRow('Địa chỉ:', customer.address);
  y += 1;

  setFont(pdf, useUnicode, 'bold', 12);
  pdf.text('Tổng tiền thanh toán:', MARGIN, y);
  rgb(pdf, COLOR.red700);
  setFont(pdf, useUnicode, 'bold', 14);
  pdf.text(formatMoney(customer.amount), MARGIN + labelW, y);
  rgb(pdf, COLOR.black);
  y += 7;

  const breakdown: string[] = [];
  if (customer.principal > 0) {
    breakdown.push(`- Gốc: ${formatMoney(customer.principal, 'VNĐ')}`);
  }
  if (customer.interest > 0) {
    breakdown.push(`- Lãi: ${formatMoney(customer.interest, 'VNĐ')}`);
  }
  if (customer.managementFee > 0) {
    breakdown.push(`- Phí QL: ${formatMoney(customer.managementFee, 'VNĐ')}`);
  }
  if (breakdown.length > 0) {
    setFont(pdf, useUnicode, 'normal', 10);
    const colW = innerW / 3;
    breakdown.forEach((line, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      pdf.text(line, MARGIN + col * colW, y + row * 4.6);
    });
    y += Math.ceil(breakdown.length / 3) * 4.6 + 4;
  } else {
    y += 3;
  }

  const boxPad = 3.5;
  const boxTop = y;
  y += boxPad + 3;
  setFont(pdf, useUnicode, 'bold', 11);
  const boxTitle = 'Nộp tiền vào tài khoản sau:';
  pdf.text(boxTitle, MARGIN + boxPad, y);
  const titleW = pdf.getTextWidth(boxTitle);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.25);
  pdf.line(MARGIN + boxPad, y + 1.2, MARGIN + boxPad + titleW, y + 1.2);
  y += 6;

  const bankLabelW = 38;
  const drawBankRow = (label: string, value: string) => {
    rgb(pdf, COLOR.black);
    setFont(pdf, useUnicode, 'bold', 10);
    pdf.text(label, MARGIN + boxPad, y);
    setFont(pdf, useUnicode, 'normal', 10);
    const lines = pdf.splitTextToSize(
      value,
      innerW - boxPad * 2 - bankLabelW
    ) as string[];
    pdf.text(lines, MARGIN + boxPad + bankLabelW, y);
    y += Math.max(5, lines.length * 4.5);
  };
  drawBankRow('Tên ngân hàng:', company.bankName);
  drawBankRow('Tên chủ tài khoản:', company.bankAccountName);
  drawBankRow('Số tài khoản:', company.bankAccountNumber);
  y += 1.5;

  pdf.setDrawColor(COLOR.gray300[0], COLOR.gray300[1], COLOR.gray300[2]);
  pdf.setLineWidth(0.3);
  pdf.setLineDashPattern([1.2, 1.2], 0);
  pdf.line(MARGIN + boxPad, y, PAGE_W - MARGIN - boxPad, y);
  pdf.setLineDashPattern([], 0);
  y += 5;

  rgb(pdf, COLOR.red600);
  setFont(pdf, useUnicode, 'bold', 10);
  pdf.text('Nội dung chuyển khoản (Bắt buộc):', MARGIN + boxPad, y);
  y += 5.5;
  setFont(pdf, useUnicode, 'bold', 13);
  const transferLines = pdf.splitTextToSize(
    customer.transferContent || '(Chưa có)',
    innerW - boxPad * 2
  ) as string[];
  pdf.text(transferLines, MARGIN + boxPad, y);
  y += transferLines.length * 5.2 + boxPad;
  rgb(pdf, COLOR.black);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.rect(MARGIN, boxTop, innerW, y - boxTop);

  y += 7;
  setFont(pdf, useUnicode, 'italic', 10);
  rgb(pdf, COLOR.gray700);
  const official1 =
    'Mọi khoản thanh toán chỉ được chuyển vào tài khoản chính thức của Y99.';
  const official2 = 'Y99 không công nhận thanh toán vào bất kỳ tài khoản cá nhân nào.';
  pdf.text(official1, PAGE_W / 2, y, { align: 'center', maxWidth: 120 });
  y += 4.5;
  pdf.text(official2, PAGE_W / 2, y, { align: 'center', maxWidth: 120 });
  y += 5.5;
  const tip =
    'Quý khách hàng khi chuyển khoản vui lòng quét mã QR bên dưới để hệ thống tự động điền thông tin chính xác!';
  const tipLines = pdf.splitTextToSize(tip, 120) as string[];
  pdf.text(tipLines, PAGE_W / 2, y, { align: 'center' });
  y += tipLines.length * 4.3 + 3;

  const qrSize = 53;
  const qrX = (PAGE_W - qrSize) / 2;
  pdf.setDrawColor(COLOR.blue500[0], COLOR.blue500[1], COLOR.blue500[2]);
  pdf.setLineWidth(0.55);
  pdf.rect(qrX - 0.8, y - 0.8, qrSize + 1.6, qrSize + 1.6);
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
    rgb(pdf, COLOR.gray700);
    setFont(pdf, useUnicode, 'normal', 8);
    pdf.text('QR không tải được', PAGE_W / 2, y + qrSize / 2, { align: 'center' });
  }
  y += qrSize + 5;

  y = drawCenteredLabelValue(
    pdf,
    useUnicode,
    'Số tiền:',
    formatMoney(customer.amount),
    y,
    innerW
  );
  y = drawCenteredLabelValue(
    pdf,
    useUnicode,
    'Nội dung:',
    customer.transferContent || '(Chưa có nội dung)',
    y,
    innerW
  );
  y = drawCenteredLabelValue(
    pdf,
    useUnicode,
    'Tên chủ TK:',
    company.bankAccountName,
    y,
    innerW
  );
  y = drawCenteredLabelValue(
    pdf,
    useUnicode,
    'Số TK:',
    company.bankAccountNumber,
    y,
    innerW
  );
  rgb(pdf, COLOR.red700);
  setFont(pdf, useUnicode, 'bold', 10);
  pdf.text(company.bankName, PAGE_W / 2, y, { align: 'center' });
  y += 8;

  y = Math.max(y, PAGE_H - 38);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;
  rgb(pdf, COLOR.red700);
  setFont(pdf, useUnicode, 'bold', 9);
  const note = `Lưu ý: ${company.name.trim()} sẽ không hoàn lại khoản tiền đã đóng với bất kỳ lý do gì. Quý khách vui lòng kiểm tra đầy đủ thông tin số tiền và nội dung chuyển khoản. Mọi chi tiết xin liên hệ Bộ phận Chăm sóc khách hàng giải đáp thắc mắc.`;
  const noteLines = pdf.splitTextToSize(note, innerW) as string[];
  pdf.text(noteLines, MARGIN, y);
  y += noteLines.length * 3.9 + 4;
  rgb(pdf, COLOR.black);
  setFont(pdf, useUnicode, 'bold', 10);
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
