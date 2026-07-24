import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  CalendarClock,
  Check,
  Search,
  Eye,
} from 'lucide-react';
import {
  LoanRecord,
  fetchDueSoonLoans,
  formatLoanAmount,
  getLoanCashBreakdown,
  mapLoanToStandardSlip,
} from '../services/loanService';
import { CustomerData } from '../types';
import { SlipPreview } from './SlipPreview';
import { DEFAULT_COMPANY_INFO } from '../constants';

interface DueSoonLoanPickerProps {
  onConfirm: (slips: CustomerData[]) => void;
}

function contractCode(loan: LoanRecord): string {
  return loan.application__code || loan.code || `#${loan.id}`;
}

/** API: 0 = hôm nay, -1/-2/-3 = còn 1/2/3 ngày, >0 = quá hạn */
function parseDueDays(dueDays: number | string | undefined): number | null {
  if (dueDays === undefined || dueDays === null || dueDays === '') return null;
  const n = typeof dueDays === 'string' ? Number(dueDays) : dueDays;
  return Number.isNaN(n) ? null : n;
}

function dueDaysLabel(dueDays: number | string | undefined): string {
  const n = parseDueDays(dueDays);
  if (n === null) return '—';
  if (n === 0) return 'Hôm nay';
  if (n === -1) return 'Còn 1 ngày';
  if (n < 0) return `Còn ${Math.abs(n)} ngày`;
  return `Quá ${n} ngày`;
}

/** Filter buckets: remaining days (3/2/1) or today (0). */
type DueDayFilter = 'all' | 3 | 2 | 1 | 0;

const DUE_DAY_FILTERS: { value: DueDayFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 3, label: 'Còn 3 ngày' },
  { value: 2, label: 'Còn 2 ngày' },
  { value: 1, label: 'Còn 1 ngày' },
  { value: 0, label: 'Hôm nay' },
];

/** Sort: còn 3 → 2 → 1 → hôm nay → quá hạn → không xác định */
function compareDueDaysAsc(a: LoanRecord, b: LoanRecord): number {
  const da = parseDueDays(a.due_days);
  const db = parseDueDays(b.due_days);
  if (da === null && db === null) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  // Upcoming/today: more negative first (-3 before 0)
  const aUpcoming = da <= 0;
  const bUpcoming = db <= 0;
  if (aUpcoming && bUpcoming) return da - db;
  if (aUpcoming) return -1;
  if (bUpcoming) return 1;
  // Overdue: sooner overdue first
  return da - db;
}

function matchesDueDayFilter(loan: LoanRecord, filter: DueDayFilter): boolean {
  if (filter === 'all') return true;
  const n = parseDueDays(loan.due_days);
  if (n === null) return false;
  if (filter === 0) return n === 0;
  return n === -filter;
}

/** Select loans + live standard-slip preview (page content, not a modal). */
export const DueSoonLoanPicker: React.FC<DueSoonLoanPickerProps> = ({
  onConfirm,
}) => {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [dueDayFilter, setDueDayFilter] = useState<DueDayFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(0.72);
  const previewPaneRef = useRef<HTMLDivElement>(null);

  const loadLoans = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await fetchDueSoonLoans();
      setLoans(results);
      setSelectedIds(new Set());
      setFocusedId(results[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách');
      setLoans([]);
      setFocusedId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLoans();
  }, []);

  useEffect(() => {
    const updateScale = () => {
      const pane = previewPaneRef.current;
      if (!pane) return;
      const slipWidthPx = 794; // ~210mm
      const slipHeightPx = 1123; // ~297mm
      const pad = 24;
      const byWidth = (pane.clientWidth - pad) / slipWidthPx;
      const byHeight = (pane.clientHeight - pad) / slipHeightPx;
      // Prefer filling the pane; keep readable but never exceed 1
      setPreviewScale(Math.min(1, Math.max(0.55, Math.min(byWidth, byHeight))));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateScale)
        : null;
    if (previewPaneRef.current && ro) ro.observe(previewPaneRef.current);
    return () => {
      window.removeEventListener('resize', updateScale);
      ro?.disconnect();
    };
  }, []);

  const dueDayCounts = useMemo(() => {
    const counts: Record<DueDayFilter, number> = {
      all: loans.length,
      3: 0,
      2: 0,
      1: 0,
      0: 0,
    };
    for (const loan of loans) {
      const n = parseDueDays(loan.due_days);
      if (n === 0) counts[0] += 1;
      else if (n === -1) counts[1] += 1;
      else if (n === -2) counts[2] += 1;
      else if (n === -3) counts[3] += 1;
    }
    return counts;
  }, [loans]);

  const filteredLoans = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = loans.filter((loan) => {
      if (!matchesDueDayFilter(loan, dueDayFilter)) return false;
      if (!q) return true;
      const haystack = [
        contractCode(loan),
        loan.customer__fullname,
        loan.customer__code,
        loan.branch__name,
        loan.branch__code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    return [...matched].sort(compareDueDaysAsc);
  }, [loans, query, dueDayFilter]);

  const focusedLoan = useMemo(
    () => loans.find((loan) => loan.id === focusedId) ?? filteredLoans[0] ?? null,
    [loans, filteredLoans, focusedId],
  );

  // Keep focus inside the visible (filtered) list
  useEffect(() => {
    if (filteredLoans.length === 0) return;
    if (!filteredLoans.some((loan) => loan.id === focusedId)) {
      setFocusedId(filteredLoans[0].id);
    }
  }, [filteredLoans, focusedId]);

  const previewSlip = useMemo(
    () => (focusedLoan ? mapLoanToStandardSlip(focusedLoan) : null),
    [focusedLoan],
  );

  const allFilteredSelected =
    filteredLoans.length > 0 &&
    filteredLoans.every((loan) => selectedIds.has(loan.id));

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredLoans.forEach((loan) => next.delete(loan.id));
      } else {
        filteredLoans.forEach((loan) => next.add(loan.id));
      }
      return next;
    });
  };

  const focusAndSelect = (loan: LoanRecord) => {
    setFocusedId(loan.id);
    setSelectedIds((prev) => {
      if (prev.has(loan.id)) return prev;
      const next = new Set(prev);
      next.add(loan.id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = loans.filter((loan) => selectedIds.has(loan.id));
    if (selected.length === 0) return;
    onConfirm(selected.map(mapLoanToStandardSlip));
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">
              Chọn khoản vay đến hạn
            </h2>
            <p className="text-xs text-gray-500 truncate">
              List có scroll bên trái · preview lớn bên phải · tick rồi xác nhận
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadLoans()}
          disabled={loading}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          title="Tải lại"
          aria-label="Tải lại"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Compact list with fixed max height + scroll */}
        <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-gray-200 h-[42vh] lg:h-auto lg:max-h-full">
          <div className="p-2.5 space-y-1.5 shrink-0 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên / mã HĐ..."
                className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Tìm khoản vay"
              />
            </div>
            {!loading && !error && loans.length > 0 && (
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Lọc theo số ngày còn lại"
              >
                {DUE_DAY_FILTERS.map(({ value, label }) => {
                  const active = dueDayFilter === value;
                  const count = dueDayCounts[value];
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setDueDayFilter(value)}
                      className={`text-[11px] px-2 py-1 rounded-md border font-medium transition-colors ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                      <span className={active ? 'opacity-90' : 'text-gray-400'}>
                        {' '}
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {!loading && !error && filteredLoans.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-gray-500 px-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    className="rounded border-gray-300"
                  />
                  Chọn hết ({filteredLoans.length})
                </label>
                <span>
                  Chọn <strong className="text-gray-800">{selectedIds.size}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {loading && (
              <div className="py-10 text-center text-gray-500 text-sm">
                Đang tải...
              </div>
            )}

            {!loading && error && (
              <div className="py-8 text-center px-3">
                <p className="text-red-600 text-sm mb-2">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadLoans()}
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Thử lại
                </button>
              </div>
            )}

            {!loading && !error && filteredLoans.length === 0 && (
              <div className="py-10 text-center text-gray-500 text-sm px-3">
                {loans.length === 0
                  ? 'Không có khoản vay đến hạn.'
                  : dueDayFilter !== 'all' && !query.trim()
                    ? 'Không có khoản vay trong khoảng này.'
                    : 'Không khớp từ khóa.'}
              </div>
            )}

            {!loading &&
              !error &&
              filteredLoans.map((loan) => {
                const selected = selectedIds.has(loan.id);
                const focused = focusedLoan?.id === loan.id;
                const breakdown = getLoanCashBreakdown(loan);
                const dueDate = loan.due_date
                  ? String(loan.due_date).slice(0, 10)
                  : '—';
                const branch = loan.branch__name || loan.branch__code || '';

                return (
                  <div
                    key={loan.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setFocusedId(loan.id)}
                    onDoubleClick={() => focusAndSelect(loan)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFocusedId(loan.id);
                      }
                    }}
                    className={`flex items-start gap-2 px-2.5 py-2.5 border-b border-gray-100 cursor-pointer ${
                      focused
                        ? 'bg-emerald-50 border-l-2 border-l-emerald-500'
                        : selected
                          ? 'bg-emerald-50/50 border-l-2 border-l-emerald-200'
                          : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOne(loan.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 rounded border-gray-300 shrink-0"
                      aria-label={`Chọn ${contractCode(loan)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 leading-snug break-words">
                          {loan.customer__fullname || '—'}
                        </p>
                        <span
                          className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                            Number(loan.due_days) === 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {dueDaysLabel(loan.due_days)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5 break-all">
                        {contractCode(loan)}
                        {loan.customer__code ? ` · ${loan.customer__code}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {dueDate}
                        {branch ? ` · ${branch}` : ''}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500 tabular-nums">
                        <span>Gốc {formatLoanAmount(breakdown.principal)}</span>
                        <span>Lãi {formatLoanAmount(breakdown.interest)}</span>
                        <span>Phí {formatLoanAmount(breakdown.managementFee)}</span>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums text-emerald-800">
                        Tổng {formatLoanAmount(breakdown.amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Large preview */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-100 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center gap-2 shrink-0">
            <Eye className="w-4 h-4 text-gray-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">
                Preview phiếu
                {previewSlip
                  ? ` — ${previewSlip.fullName || '—'} · ${previewSlip.contractId || '—'}`
                  : ''}
              </p>
              {previewSlip && (
                <p className="text-xs text-gray-500 tabular-nums truncate">
                  Gốc {formatLoanAmount(previewSlip.principal)} · Lãi{' '}
                  {formatLoanAmount(previewSlip.interest)} · Phí{' '}
                  {formatLoanAmount(previewSlip.managementFee)} · Tổng{' '}
                  <span className="font-semibold text-emerald-800">
                    {formatLoanAmount(previewSlip.amount)}
                  </span>
                </p>
              )}
            </div>
            {focusedLoan && (
              <button
                type="button"
                onClick={() => toggleOne(focusedLoan.id)}
                className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border font-medium ${
                  selectedIds.has(focusedLoan.id)
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {selectedIds.has(focusedLoan.id) ? 'Đã chọn' : 'Chọn'}
              </button>
            )}
          </div>

          <div
            ref={previewPaneRef}
            className="flex-1 min-h-0 overflow-auto p-3 flex justify-center items-start"
          >
            {previewSlip ? (
              <div
                className="origin-top shadow-xl bg-white"
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                  width: '210mm',
                  marginBottom: `calc(297mm * ${previewScale - 1})`,
                }}
              >
                <SlipPreview customer={previewSlip} company={DEFAULT_COMPANY_INFO} />
              </div>
            ) : (
              <div className="py-20 text-sm text-gray-500 text-center">
                Chưa có khoản vay để preview
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-200 bg-gray-50 shrink-0">
        <p className="text-sm text-gray-600">
          Sẽ tạo{' '}
          <span className="font-semibold text-gray-900">{selectedIds.size}</span> phiếu
        </p>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selectedIds.size === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          Tạo {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}phiếu đã chọn
        </button>
      </div>
    </div>
  );
};

export { DueSoonLoanPicker as DueSoonLoansPanel };
