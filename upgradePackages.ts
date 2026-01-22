import { PackageInfo, UpgradePackage } from './types';

export const UPGRADE_PACKAGES: Record<UpgradePackage, PackageInfo> = {
  FREE: {
    id: 'FREE',
    name: 'Miễn phí',
    description: 'Gói cơ bản cho người dùng mới',
    exportTime: 30000, // 30 seconds
    price: 'Miễn phí',
    features: [
      'Xuất file PDF',
      'Thời gian xuất: ~30 giây',
      'Tất cả tính năng cơ bản'
    ],
    color: 'gray'
  },
  BASIC: {
    id: 'BASIC',
    name: 'Cơ bản',
    description: 'Xuất file nhanh hơn 3 lần',
    exportTime: 10000, // 10 seconds
    price: '99.000đ/tháng',
    features: [
      'Xuất file PDF nhanh hơn',
      'Thời gian xuất: ~10 giây',
      'Ưu tiên xử lý',
      'Hỗ trợ email'
    ],
    color: 'blue',
    badge: 'Phổ biến'
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: 'Nâng cao',
    description: 'Xuất file nhanh hơn 6 lần',
    exportTime: 5000, // 5 seconds
    price: '199.000đ/tháng',
    features: [
      'Xuất file PDF cực nhanh',
      'Thời gian xuất: ~5 giây',
      'Ưu tiên xử lý cao',
      'Hỗ trợ email & SMS',
      'Xuất hàng loạt'
    ],
    color: 'purple',
    badge: 'Được yêu thích'
  },
  PRO: {
    id: 'PRO',
    name: 'Chuyên nghiệp',
    description: 'Xuất file nhanh hơn 30 lần',
    exportTime: 1000, // 1 second
    price: '399.000đ/tháng',
    features: [
      'Xuất file PDF tức thì',
      'Thời gian xuất: ~1 giây',
      'Ưu tiên tối đa',
      'Hỗ trợ 24/7',
      'Xuất hàng loạt không giới hạn',
      'API tích hợp'
    ],
    color: 'gold',
    badge: 'Tốt nhất'
  }
};

export const getPackageInfo = (pkg: UpgradePackage): PackageInfo => {
  return UPGRADE_PACKAGES[pkg];
};

export const STORAGE_KEY = 'y99-upgrade-package';

export const getStoredPackage = (): UpgradePackage => {
  if (typeof window === 'undefined') return 'FREE';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && Object.keys(UPGRADE_PACKAGES).includes(stored)) {
    return stored as UpgradePackage;
  }
  return 'FREE';
};

export const setStoredPackage = (pkg: UpgradePackage): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, pkg);
};
