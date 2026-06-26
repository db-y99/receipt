import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { CustomerData } from '../types';
import {
  ApplicationRecord,
  mapApplicationToCustomerFields,
  searchApplications,
} from '../services/applicationService';

interface CustomerSearchProps {
  data: CustomerData;
  onChange: (data: CustomerData) => void;
  onFieldChange: (field: keyof CustomerData, value: string | number) => void;
}

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

export const CustomerSearch: React.FC<CustomerSearchProps> = ({
  data,
  onChange,
  onFieldChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ApplicationRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (query: string) => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearchError('');
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setSearchError('');

    try {
      const items = await searchApplications(query);
      setResults(items);
      setShowDropdown(true);
    } catch (error) {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : 'Không thể tìm kiếm');
      setShowDropdown(true);
    } finally {
      setIsSearching(false);
    }
  };

  const scheduleSearch = (query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    scheduleSearch(value);
  };

  const handleSelect = (application: ApplicationRecord) => {
    const mapped = mapApplicationToCustomerFields(application);
    onChange({
      ...data,
      ...mapped,
    });
    setSearchQuery('');
    setResults([]);
    setSearchError('');
    setShowDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <>
      <div ref={containerRef} className="relative space-y-1 md:col-span-2">
        <label className="flex items-center gap-1 text-xs font-medium text-gray-700">
          Tìm khách hàng / mã hợp đồng
          <Search className="h-3 w-3 text-blue-500" />
        </label>
        <input
          type="text"
          className="w-full min-w-0 rounded border border-gray-300 bg-white p-2 text-gray-900 outline-none placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => {
            if (searchQuery.trim().length >= MIN_QUERY_LENGTH) {
              scheduleSearch(searchQuery);
            }
          }}
          placeholder="Nhập họ tên hoặc mã hợp đồng..."
        />

        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {isSearching && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tìm kiếm...
              </div>
            )}

            {!isSearching && searchError && (
              <div className="px-3 py-2 text-sm text-red-600">{searchError}</div>
            )}

            {!isSearching && !searchError && results.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Không tìm thấy kết quả</div>
            )}

            {!isSearching && !searchError && results.length > 0 && (
              <ul className="max-h-60 overflow-y-auto">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full border-b border-gray-100 px-3 py-2.5 text-left hover:bg-blue-50"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelect(item)}
                    >
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                        <span className="text-gray-500">Họ tên:</span>
                        <span className="font-medium text-gray-900">{item.fullname || '—'}</span>
                        <span className="text-gray-500">Mã HĐ:</span>
                        <span className="font-medium text-gray-900">{item.code || '—'}</span>
                        {item.phone && (
                          <>
                            <span className="text-gray-500">SĐT:</span>
                            <span className="text-gray-700">{item.phone}</span>
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">Họ tên khách hàng</label>
        <input
          type="text"
          className="w-full min-w-0 rounded border border-gray-300 bg-white p-2 text-gray-900 outline-none placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
          value={data.fullName}
          onChange={(e) => onFieldChange('fullName', e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-700">Mã hợp đồng</label>
        <input
          type="text"
          className="w-full min-w-0 rounded border border-gray-300 bg-white p-2 text-gray-900 outline-none placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
          value={data.contractId}
          onChange={(e) => onFieldChange('contractId', e.target.value)}
        />
      </div>
    </>
  );
};
