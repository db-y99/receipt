import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Keep this handler self-contained (no relative ESM imports).
 * Vercel Node ESM cannot resolve extensionless imports like ../lib/foo.
 * Shared builders for Vite live in api/lib/loanDueSoonParams.ts.
 */
const LOAN_DUE_SOON_FIELDS = [
  'id',
  'beneficiary_account',
  'beneficiary_bank',
  'customer__code',
  'fee_ovd_cycle',
  'fee_income',
  'fee_num_cycle',
  'fee_pay_cycle',
  'fee_ovd_days',
  'fee_penalty',
  'fee_ovd',
  'fee_next_date',
  'fee_next_amount',
  'fees',
  'fee_collected',
  'application__code',
  'application__address',
  'application',
  'amount_given',
  'penalty_ratio',
  'product__install_cycle_days',
  'product__type__code',
  'product__base__code',
  'penalty_amount',
  'revenue',
  'itr_next_amount',
  'status__code',
  'prin_ovd_days',
  'itr_ovd_days',
  'batch_date',
  'due_date',
  'due_days',
  'product__currency__code',
  'due_amount',
  'prin_next_amount',
  'itr_penalty',
  'prin_penalty',
  'itr_ovd_cycle',
  'prin_ovd',
  'itr_ovd',
  'prin_ovd_cycle',
  'prin_num_cycle',
  'itr_num_cycle',
  'prin_collected',
  'itr_last_date',
  'prin_last_date',
  'itr_last_amount',
  'prin_last_amount',
  'itr_collected',
  'itr_income',
  'itr_pay_cycle',
  'prin_pay_cycle',
  'itr_next_date',
  'prin_next_date',
  'branch',
  'branch__code',
  'branch__name',
  'product__type__name',
  'prin_first_date',
  'itr_first_date',
  'prin_cycle_days',
  'itr_cycle_days',
  'dbm_entry__account',
  'approver',
  'approve_time',
  'prin_pay_type',
  'prin_pay_type__code',
  'prin_pay_type__name',
  'itr_pay_type',
  'itr_pay_type__code',
  'itr_pay_type__name',
  'customer',
  'customer__phone',
  'customer__fullname',
  'code',
  'product',
  'product__code',
  'product__name',
  'valid_from',
  'valid_to',
  'rate_info',
  'disbursement',
  'disbursement_local',
  'outstanding',
  'outstanding_local',
  'principal',
  'rate',
  'status__name',
  'dbm_entry',
  'dbm_entry__code',
  'creator__fullname',
  'approver__fullname',
  'update_time',
  'create_time',
  'ratio',
  'status',
  'creator',
] as const;

const LOAN_DUE_SOON_FILTER = {
  deleted: 0,
  status__gte: '2',
  status__lte: '7',
  due_days__gte: '-3',
  due_days__lte: '0',
  create_time__date__gte: '1927-12-25',
};

const LOAN_DUE_SOON_DISTINCT_VALUES = {
  count_note: {
    type: 'Count',
    field: 'id',
    subquery: { model: 'Loan_Note', column: 'ref' },
  },
  sms_count: {
    type: 'Count',
    subquery: { model: 'Loan_Sms', column: 'ref' },
    field: 'id',
  },
  file_count: {
    type: 'Count',
    field: 'id',
    subquery: { model: 'Loan_File', column: 'ref' },
  },
  collat_count: {
    type: 'Count',
    field: 'id',
    subquery: { model: 'Loan_Collateral', column: 'loan' },
  },
};

function buildLoanDueSoonUrl(apiBaseUrl: string, login?: string): string {
  const params = new URLSearchParams({
    values: LOAN_DUE_SOON_FIELDS.join(','),
    distinct_values: JSON.stringify(LOAN_DUE_SOON_DISTINCT_VALUES),
    filter: JSON.stringify(LOAN_DUE_SOON_FILTER),
    sort: '-id',
    summary: 'annotate',
  });

  if (login) {
    params.set('login', login);
  }

  return `${apiBaseUrl.replace(/\/$/, '')}/data/Loan/?${params.toString()}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiBaseUrl = process.env.API_BASE_URL || '';
  const apiLogin = process.env.API_LOGIN || '';

  if (!apiBaseUrl) {
    return res.status(503).json({ error: 'Chưa cấu hình API tìm kiếm' });
  }

  try {
    const targetUrl = buildLoanDueSoonUrl(apiBaseUrl, apiLogin);
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Lấy danh sách khoản vay thất bại (${response.status})`,
      });
    }

    const payload = await response.json();
    return res.status(200).json(payload);
  } catch {
    return res.status(500).json({ error: 'Không thể kết nối API khoản vay' });
  }
}
