export type SlipType = 'STANDARD' | 'SETTLEMENT';

export interface CustomerData {
  type: SlipType;
  fullName: string;
  customerId: string;
  contractId: string;
  transferContent: string;
  address: string;
  amount: number;
  deadline: string; // YYYY-MM-DD
  
  // Settlement breakdown fields
  principal: number;       // Gốc
  interest: number;        // Lãi
  managementFee: number;   // Phí QL
  settlementFee: number;   // Phí tất toán
}

export interface CompanyInfo {
  name: string;
  address: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankId: string; // e.g., 'VCB' for Vietcombank used in VietQR
  hotline: string;
}