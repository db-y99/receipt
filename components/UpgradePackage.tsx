import React, { useState } from 'react';
import { UpgradePackage, PackageInfo } from '../types';
import { UPGRADE_PACKAGES, getStoredPackage, setStoredPackage } from '../upgradePackages';
import { Zap, Check, Crown, Star, X } from 'lucide-react';

interface UpgradePackageProps {
  currentPackage: UpgradePackage;
  onPackageChange: (pkg: UpgradePackage) => void;
  onClose?: () => void;
}

export const UpgradePackageSelector: React.FC<UpgradePackageProps> = ({ 
  currentPackage, 
  onPackageChange,
  onClose 
}) => {
  const [selectedPackage, setSelectedPackage] = useState<UpgradePackage>(currentPackage);

  const handleSelectPackage = (pkg: UpgradePackage) => {
    setSelectedPackage(pkg);
  };

  const handleConfirm = () => {
    setStoredPackage(selectedPackage);
    onPackageChange(selectedPackage);
    if (onClose) onClose();
  };

  const getPackageIcon = (pkg: UpgradePackage) => {
    switch (pkg) {
      case 'FREE':
        return null;
      case 'BASIC':
        return <Zap className="w-5 h-5" />;
      case 'PREMIUM':
        return <Star className="w-5 h-5" />;
      case 'PRO':
        return <Crown className="w-5 h-5" />;
    }
  };

  const getPackageColorClasses = (pkg: PackageInfo, isSelected: boolean) => {
    if (pkg.color === 'gray') {
      return isSelected ? 'border-gray-400 bg-gray-50' : 'border-gray-300';
    } else if (pkg.color === 'blue') {
      return isSelected ? 'border-blue-500 bg-blue-50' : 'border-blue-300';
    } else if (pkg.color === 'purple') {
      return isSelected ? 'border-purple-500 bg-purple-50' : 'border-purple-300';
    } else if (pkg.color === 'gold') {
      return isSelected ? 'border-yellow-500 bg-yellow-50' : 'border-yellow-300';
    }
    return isSelected ? 'border-gray-400 bg-gray-50' : 'border-gray-300';
  };

  const getButtonColorClasses = (pkg: PackageInfo) => {
    if (pkg.color === 'gray') {
      return 'bg-gray-600 hover:bg-gray-700';
    } else if (pkg.color === 'blue') {
      return 'bg-blue-600 hover:bg-blue-700';
    } else if (pkg.color === 'purple') {
      return 'bg-purple-600 hover:bg-purple-700';
    } else if (pkg.color === 'gold') {
      return 'bg-yellow-600 hover:bg-yellow-700';
    }
    return 'bg-gray-600 hover:bg-gray-700';
  };

  const getBadgeColorClasses = (pkg: PackageInfo) => {
    if (pkg.color === 'gold') {
      return 'bg-yellow-500';
    } else if (pkg.color === 'purple') {
      return 'bg-purple-500';
    } else if (pkg.color === 'blue') {
      return 'bg-blue-500';
    }
    return 'bg-gray-500';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gói Nâng Cấp</h2>
            <p className="text-sm text-gray-600 mt-1">Chọn gói phù hợp để xuất file nhanh hơn</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Packages Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(UPGRADE_PACKAGES).map((pkg) => {
            const isSelected = selectedPackage === pkg.id;
            const isCurrent = currentPackage === pkg.id;
            
            return (
              <div
                key={pkg.id}
                onClick={() => handleSelectPackage(pkg.id)}
                className={`
                  relative border-2 rounded-lg p-5 cursor-pointer transition-all
                  ${getPackageColorClasses(pkg, isSelected)}
                  ${isSelected ? 'ring-2 ring-offset-2' : ''}
                  hover:shadow-lg
                `}
                style={{
                  ringColor: isSelected 
                    ? pkg.color === 'gray' ? '#9ca3af' 
                      : pkg.color === 'blue' ? '#3b82f6'
                      : pkg.color === 'purple' ? '#9333ea'
                      : '#eab308'
                    : undefined
                }}
              >
                {/* Badge */}
                {pkg.badge && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className={`${getBadgeColorClasses(pkg)} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                      {pkg.badge}
                    </span>
                  </div>
                )}

                {/* Current Package Badge */}
                {isCurrent && (
                  <div className="absolute top-2 right-2">
                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                      Đang dùng
                    </span>
                  </div>
                )}

                {/* Package Header */}
                <div className="flex items-center gap-2 mb-3">
                  {getPackageIcon(pkg.id)}
                  <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                </div>

                {/* Price */}
                <div className="mb-3">
                  <div className="text-2xl font-bold text-gray-900">{pkg.price}</div>
                  <div className="text-xs text-gray-500">Thời gian xuất: ~{(pkg.exportTime / 1000).toFixed(1)}s</div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4">{pkg.description}</p>

                {/* Features */}
                <ul className="space-y-2 mb-4">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Select Indicator */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className={`
                      text-center py-2 rounded text-sm font-semibold text-white
                      ${getButtonColorClasses(pkg)}
                    `}>
                      {isCurrent ? 'Đang sử dụng' : 'Đã chọn'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Gói đã chọn:</span>{' '}
            <span className="font-bold text-gray-900">{UPGRADE_PACKAGES[selectedPackage].name}</span>
            {' '}• Thời gian xuất: ~{(UPGRADE_PACKAGES[selectedPackage].exportTime / 1000).toFixed(1)} giây
          </div>
          <div className="flex gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Hủy
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`
                px-6 py-2 rounded-lg text-white font-semibold transition-colors
                ${getButtonColorClasses(UPGRADE_PACKAGES[selectedPackage])}
              `}
            >
              {currentPackage === selectedPackage ? 'Đóng' : 'Áp dụng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
