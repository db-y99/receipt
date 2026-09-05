import type { SlipCustomerData, SlipLoanRecord } from './slipCompany';

export function toNumber(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function normalizeDueDate(value?: string): string {
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

export function buildTransferContent(parts: {
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

export function mapLoanToStandardSlip(loan: SlipLoanRecord): SlipCustomerData {
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

export function normalizeLoanResults(payload: unknown): SlipLoanRecord[] {
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

export function buildLoanLookupUrl(
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

export async function fetchLoanByCode(
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

export function buildPdfBaseName(data: SlipCustomerData): string {
  if (!data.fullName?.trim()) return 'Phieu thu tien';
  const deadline = data.deadline || '';
  const parts = deadline.split('-');
  const dd = parts[2] || '01';
  const mm = parts[1] || '01';
  return `Phieu thu tien - ${data.fullName.trim()} (${dd}/${mm})`;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'phieu-thu';
}

export function uniquePdfFileName(baseName: string, used: Set<string>): string {
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
