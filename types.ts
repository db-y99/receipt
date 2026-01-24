export type SlipType = 'STANDARD' | 'SETTLEMENT';

export interface PeriodBreakdown {
  periodNumber: number;    // Số kỳ (Kỳ 2, Kỳ 3, ...)
  daysOverdue: number;    // Số ngày trễ
  periodAmount: number;    // Số tiền kỳ
  penaltyAmount: number;   // Số tiền phạt
}

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
  overdueFee: number;      // Phí quá hạn
  
  // Period breakdown fields
  periods: PeriodBreakdown[];  // Chi tiết các kỳ
  remainingPrincipal: number;  // Gốc còn lại
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

export type UpgradePackage = 'FREE' | 'BASIC' | 'PREMIUM' | 'PRO';

export interface PackageInfo {
  id: UpgradePackage;
  name: string;
  description: string;
  exportTime: number; // Total time in milliseconds
  price: string;
  features: string[];
  color: string;
  badge?: string;
}