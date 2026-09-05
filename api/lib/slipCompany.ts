/** Company defaults for server-side slip PDF (mirrors constants.ts). */
export const SLIP_COMPANY = {
  name: ' CÔNG TY CỔ PHẦN CẦM ĐỒ Y99',
  address: '99B Nguyễn Trãi, phường Ninh Kiều, Cần Thơ',
  bankName: 'Vietcombank',
  bankAccountName: 'CONG TY CO PHAN CAM DO Y99',
  bankAccountNumber: '1058526128',
  bankId: 'VCB',
  hotline: '1900575792 | +84 292 38 999 33 (Nước ngoài)',
} as const;

export type SlipCustomerData = {
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

export type SlipLoanRecord = {
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
