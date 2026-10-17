import { SLIP_COMPANY, type SlipCustomerData } from './slipCompany';

/** Public VietQR image API — same display source banks use for QR PNGs. */
export function buildVietQrImageUrl(customer: SlipCustomerData): string {
  const bank = encodeURIComponent(SLIP_COMPANY.bankId);
  const account = encodeURIComponent(SLIP_COMPANY.bankAccountNumber);
  const params = new URLSearchParams();
  if (customer.amount > 0) params.set('amount', String(Math.round(customer.amount)));
  if (customer.transferContent) params.set('addInfo', customer.transferContent);
  params.set('accountName', SLIP_COMPANY.bankAccountName);
  return `https://img.vietqr.io/image/${bank}-${account}-compact2.png?${params.toString()}`;
}

export async function fetchVietQrPng(
  customer: SlipCustomerData
): Promise<Buffer | null> {
  const url = buildVietQrImageUrl(customer);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}
