import { CompanyInfo, CustomerData } from './types';

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: " CÔNG TY CỔ PHẦN CẦM ĐỒ Y99",
  address: "99B Nguyễn Trãi, phường Ninh Kiều, Cần Thơ",
  bankName: "Vietcombank",
  bankAccountName: "DOANH NGHIEP TU NHAN Y99",
  bankAccountNumber: "1058526128",
  bankId: "VCB",
  hotline: "1900575792 | +84 292 38 999 33 (Nước ngoài)"
};

export const DEFAULT_CUSTOMER_DATA: CustomerData = {
  type: 'STANDARD',
  fullName: "",
  customerId: "",
  contractId: "",
  transferContent: "",
  address: "",
  amount: 0,
  deadline: new Date().toISOString().split('T')[0],
  
  // Default zeroes for breakdown
  principal: 0,
  interest: 0,
  managementFee: 0,
  settlementFee: 0,
  overdueFee: 0
};