import { CustomerData } from '../types';

const LOAN_DUE_SOON_PATH = '/api/loans/due-soon';

export interface LoanRecord {
  id: number;
  code?: string;
  application__code?: string;
  application__address?: string;
  customer__code?: string;
  customer__fullname?: string;
  customer__phone?: string;
  due_date?: string;
  due_days?: number | string;
  due_amount?: number | string;
  prin_next_amount?: number | string;
  itr_next_amount?: number | string;
  fee_next_amount?: number | string;
  fee_penalty?: number | string;
  prin_penalty?: number | string;
  itr_penalty?: number | string;
  branch__code?: string;
  branch__name?: string;
  status__code?: string;
  status__name?: string;
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
  // Accept ISO datetime or date-only
  const datePart = value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

export function normalizeLoanResults(payload: unknown): LoanRecord[] {
  if (Array.isArray(payload)) {
    return payload as LoanRecord[];
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidates = [record.data, record.results, record.items, record.rows];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as LoanRecord[];
      }
    }
  }

  return [];
}

export async function fetchDueSoonLoans(): Promise<LoanRecord[]> {
  const response = await fetch(LOAN_DUE_SOON_PATH);

  if (!response.ok) {
    let message = `Lấy danh sách khoản vay thất bại (${response.status})`;
    try {
      const errorPayload = await response.json();
      if (
        errorPayload &&
        typeof errorPayload === 'object' &&
        'error' in errorPayload
      ) {
        message = String(errorPayload.error);
      }
    } catch {
      // Keep default message when error body is not JSON.
    }
    throw new Error(message);
  }

  const payload = await response.json();
  return normalizeLoanResults(payload);
}

export function getLoanCashBreakdown(loan: LoanRecord) {
  const principal = toNumber(loan.prin_next_amount);
  const interest = toNumber(loan.itr_next_amount);
  const managementFee = toNumber(loan.fee_next_amount);
  return {
    principal,
    interest,
    managementFee,
    amount: principal + interest + managementFee,
  };
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

export function mapLoanToStandardSlip(loan: LoanRecord): CustomerData {
  const { principal, interest, managementFee, amount } = getLoanCashBreakdown(loan);
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
    receiptNumber: '',
    principal,
    interest,
    managementFee,
    settlementFee: 0,
    overdueFee: 0,
    periods: [],
    remainingPrincipal: 0,
  };
}

/** @deprecated Use mapLoanToStandardSlip */
export const mapLoanToCashSlip = mapLoanToStandardSlip;

export function formatLoanAmount(value: unknown): string {
  const num = toNumber(value);
  if (!num) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
}
