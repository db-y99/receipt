# Hướng dẫn: Phiếu thu thường (STANDARD) — đơn đến hạn trong 3 ngày

Tài liệu port tính năng **phiếu thu thường** chỉ từ khoản vay **còn 0–3 ngày nữa tới hạn** (`due_days` từ `-3` đến `0`): thư viện, URL API, model, map loan → phiếu, và flow tạo PDF.

---

## 1. Tổng quan

| Mục                | Giá trị                                              |
| ------------------ | ---------------------------------------------------- |
| Loại phiếu         | `type: 'STANDARD'`                                   |
| Tiêu đề trên phiếu | `PHIẾU THU TIỀN`                                     |
| Tên file PDF       | `Phiếu thu tiền - {họ tên}.pdf`                      |
| VietQR             | Có (`qrious` + `utils/vietqr.ts`)                    |
| Số phiếu           | Không                                                |
| Nguồn dữ liệu      | Chỉ khoản vay **đến hạn trong 3 ngày** (`loan soon`) |

**Điều kiện đơn được tạo phiếu (loan soon = 3 ngày):**

```
due_days >= -3  và  due_days <= 0
```

→ Hôm nay đến hạn, hoặc còn 1–3 ngày nữa tới hạn. Đủ điều kiện này là tạo phiếu được.

**Flow:**

```
GET /api/loans/due-soon
  → proxy → ${url}/data/Loan/?...
  → mapLoanToStandardSlip
  → SlipPreview + VietQR
  → html2canvas + jsPDF → Xuất PDF / In
```

---

## 2. Thư viện sử dụng

```bash
npm i html2canvas jspdf qrious
# UI stack hiện tại
npm i react react-dom lucide-react
```

| Thư viện              | Vai trò                                 |
| --------------------- | --------------------------------------- |
| `html2canvas`         | Capture DOM `#print-area` thành ảnh     |
| `jspdf`               | Ghép ảnh thành PDF A4                   |
| `qrious`              | Vẽ QR VietQR trên canvas (CDN hoặc npm) |
| `react` / `react-dom` | UI form + preview                       |
| `lucide-react`        | Icon (optional)                         |

VietQR payload tự build (không cần lib ngoài) trong `utils/vietqr.ts` → `generateVietQRString(...)`.

---

## 3. URL API thực tế

### Env (server-only)

```env
API_BASE_URL=
API_LOGIN=<token-login>
```

### Endpoint

| Layer                  | Method | URL                   |
| ---------------------- | ------ | --------------------- |
| Frontend / local proxy | `GET`  | `/api/loans/due-soon` |
| Upstream (Y99)         | `GET`  | `/data/Loan/?...`     |

**URL upstream đầy đủ (pattern):**

```
/data/Loan/?values=...&distinct_values=...&filter=...&sort=-id&summary=annotate&login={API_LOGIN}
```

**Filter loan soon (3 ngày):**

```json
{
  "deleted": 0,
  "status__gte": "2",
  "status__lte": "7",
  "due_days__gte": "-3",
  "due_days__lte": "0",
  "create_time__date__gte": "1927-12-25"
}
```

Luồng proxy:

```
Browser  →  GET /api/loans/due-soon
         →  Vite plugin (dev) / Vercel function (prod)
         →  /data/Loan/?filter=...&login=...
```

Không gọi thẳng `api.y99.vn` từ browser (giữ `API_LOGIN` bí mật).

---

## 4. Code mẫu

### 4.1 Build URL upstream

```ts
// api/lib/loanDueSoonParams.ts
export const LOAN_DUE_SOON_FILTER = {
  deleted: 0,
  status__gte: "2",
  status__lte: "7",
  due_days__gte: "-3",
  due_days__lte: "0",
  create_time__date__gte: "1927-12-25",
};

export function buildLoanDueSoonUrl(
  apiBaseUrl: string,
  login?: string,
): string {
  const params = new URLSearchParams({
    values: LOAN_DUE_SOON_FIELDS.join(","), // xem file gốc
    distinct_values: JSON.stringify(LOAN_DUE_SOON_DISTINCT_VALUES),
    filter: JSON.stringify(LOAN_DUE_SOON_FILTER),
    sort: "-id",
    summary: "annotate",
  });
  if (login) params.set("login", login);
  return `${apiBaseUrl.replace(/\/$/, "")}/data/Loan/?${params.toString()}`;
}

// Ví dụ kết quả:
// /data/Loan/?values=id,due_date,...&filter={...}&login=xxx
```

### 4.2 Proxy / API handler (server)

```ts
// api/loans/due-soon.ts (Vercel) — tương tự plugins/loanDueSoonProxy.ts (Vite)
const apiBaseUrl = process.env.API_BASE_URL || ""; //
const apiLogin = process.env.API_LOGIN || "";

const targetUrl = buildLoanDueSoonUrl(apiBaseUrl, apiLogin);
const response = await fetch(targetUrl);
const payload = await response.json();
return res.status(200).json(payload);
```

### 4.3 Frontend gọi danh sách loan soon

```ts
// services/loanService.ts
const LOAN_DUE_SOON_PATH = "/api/loans/due-soon";

export async function fetchDueSoonLoans(): Promise<LoanRecord[]> {
  const response = await fetch(LOAN_DUE_SOON_PATH);
  if (!response.ok)
    throw new Error(`Lấy danh sách khoản vay thất bại (${response.status})`);
  const payload = await response.json();
  return normalizeLoanResults(payload); // data | results | items | rows | array
}
```

### 4.4 Map loan → phiếu STANDARD

```ts
export function mapLoanToStandardSlip(loan: LoanRecord): CustomerData {
  const principal = Number(loan.prin_next_amount) || 0;
  const interest = Number(loan.itr_next_amount) || 0;
  const managementFee = Number(loan.fee_next_amount) || 0;
  const contractId = loan.application__code || loan.code || "";
  const fullName = loan.customer__fullname || "";

  return {
    type: "STANDARD",
    fullName,
    customerId: loan.customer__code || "",
    contractId,
    transferContent: buildTransferContent({
      fullName,
      contractId,
      principal,
      interest,
      managementFee,
    }),
    address: loan.application__address?.trim() || "",
    amount: principal + interest + managementFee,
    deadline: normalizeDueDate(loan.due_date), // YYYY-MM-DD
    receiptNumber: "",
    principal,
    interest,
    managementFee,
    settlementFee: 0,
    overdueFee: 0,
    periods: [],
    remainingPrincipal: 0,
  };
}
```

### 4.5 VietQR + QRious

```ts
import { generateVietQRString } from "../utils/vietqr";

const qrString = generateVietQRString({
  accountNo: company.bankAccountNumber,
  amount: customer.amount,
  content: customer.transferContent,
  bankId: company.bankId, // 'VCB'
});

// Vẽ QR (CDN)
// https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js
new (window as any).QRious({
  element: canvasEl,
  value: qrString,
  size: 200,
  level: "M",
});
```

### 4.6 Xuất PDF

```ts
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const input = document.getElementById("print-area")!;
const canvas = await html2canvas(input, {
  scale: 3,
  useCORS: true,
  backgroundColor: "#ffffff",
});
const imgData = canvas.toDataURL("image/jpeg", 0.95);

const pdf = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
  compress: true,
});
pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "SLOW");
pdf.save(`Phiếu thu tiền - ${customer.fullName}.pdf`);
```

---

## 5. Model dữ liệu (`CustomerData`)

```ts
type SlipType = "STANDARD" | "SETTLEMENT" | "CASH";

interface PeriodBreakdown {
  periodNumber: number;
  daysOverdue: number;
  periodAmount: number;
  penaltyAmount: number;
}

interface CustomerData {
  type: SlipType; // luôn 'STANDARD'
  fullName: string;
  customerId: string;
  contractId: string;
  transferContent: string; // ≤ 95 ký tự, không dấu
  address: string;
  amount: number; // gốc + lãi + phí QL
  deadline: string; // YYYY-MM-DD (= due_date)
  receiptNumber: string; // để trống
  principal: number; // ← prin_next_amount
  interest: number; // ← itr_next_amount
  managementFee: number; // ← fee_next_amount
  settlementFee: number; // 0
  overdueFee: number; // 0
  periods: PeriodBreakdown[]; // []
  remainingPrincipal: number; // 0
}

interface CompanyInfo {
  name: string;
  address: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankId: string; // 'VCB'
  hotline: string;
}
```

Fields loan tối thiểu:

```
id, code, application__code, application__address,
customer__code, customer__fullname, customer__phone,
due_date, due_days,
prin_next_amount, itr_next_amount, fee_next_amount
```

---

## 6. Công thức & map

### Tổng tiền

```
amount = principal + interest + managementFee
```

### Nội dung CK (VietQR)

```
{fullName} {contractId} Goc {n} Lai {n} Phi QL {n}
```

Bỏ dấu, không ngăn nghìn, ≤ **95** ký tự.

### Bảng map

| Field phiếu       | Nguồn Loan                      |
| ----------------- | ------------------------------- |
| `type`            | `'STANDARD'`                    |
| `fullName`        | `customer__fullname`            |
| `customerId`      | `customer__code`                |
| `contractId`      | `application__code` \|\| `code` |
| `address`         | `application__address`          |
| `principal`       | `prin_next_amount`              |
| `interest`        | `itr_next_amount`               |
| `managementFee`   | `fee_next_amount`               |
| `amount`          | tổng 3 field trên               |
| `deadline`        | `due_date`                      |
| `transferContent` | auto                            |
| còn lại           | `0` / `''` / `[]`               |

---

## 7. Flow tạo phiếu

1. `GET /api/loans/due-soon` → proxy `/data/Loan/` (filter `due_days` ∈ `[-3, 0]`).
2. Chọn loan → `mapLoanToStandardSlip(loan)`.
3. (Optional) Sửa địa chỉ / nội dung CK.
4. Preview + VietQR → xuất PDF (`html2canvas` + `jspdf`) hoặc in.

### File tham chiếu

| Vai trò               | File                                                  |
| --------------------- | ----------------------------------------------------- |
| Types                 | `types.ts`                                            |
| Company default       | `constants.ts`                                        |
| Due-soon UI           | `DueSoonPage.tsx`, `components/DueSoonLoansPanel.tsx` |
| Fetch + map           | `services/loanService.ts`                             |
| Filter + URL upstream | `api/lib/loanDueSoonParams.ts`                        |
| API prod              | `api/loans/due-soon.ts`                               |
| Proxy dev             | `plugins/loanDueSoonProxy.ts`                         |
| Preview               | `components/SlipPreview.tsx`                          |
| VietQR string         | `utils/vietqr.ts`                                     |
| Export PDF            | `App.tsx`                                             |

### Checklist port

- [ ] Env: `API_BASE_URL=` + `API_LOGIN`
- [ ] Proxy `GET /api/loans/due-soon` → `/data/Loan/` với filter 3 ngày
- [ ] `mapLoanToStandardSlip` + nội dung CK
- [ ] `html2canvas` + `jspdf` + `qrious` / VietQR
- [ ] Layout preview A4

---

## 8. Payload mẫu

```json
{
  "type": "STANDARD",
  "fullName": "Nguyen Van A",
  "customerId": "KH001",
  "contractId": "HD-2026-001",
  "transferContent": "Nguyen Van A HD-2026-001 Goc 1000000 Lai 50000 Phi QL 20000",
  "address": "99B Nguyễn Trãi, Ninh Kiều, Cần Thơ",
  "amount": 1070000,
  "deadline": "2026-07-26",
  "receiptNumber": "",
  "principal": 1000000,
  "interest": 50000,
  "managementFee": 20000,
  "settlementFee": 0,
  "overdueFee": 0,
  "periods": [],
  "remainingPrincipal": 0
}
```

---

## 9. Lưu ý

1. **Loan soon = 3 ngày** (`due_days` từ `-3` đến `0`) → tạo phiếu được.
2. Upstream thực tế: `/data/Loan/` — gọi qua proxy `/api/loans/due-soon`.
3. Không lộ `API_LOGIN` ra client.
4. Nội dung CK ≤ 95 ký tự, không dấu.
5. PDF là artifact đầu ra (`html2canvas` + `jspdf`).
