const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

const readPair = (n: number): string => {
  if (n === 0) return '';
  if (n < 10) return DIGITS[n];
  if (n === 10) return 'mười';

  const tens = Math.floor(n / 10);
  const ones = n % 10;
  let result = tens === 1 ? 'mười' : `${DIGITS[tens]} mươi`;

  if (ones === 0) return result;
  if (ones === 1) return `${result} mốt`;
  if (ones === 5) return `${result} lăm`;
  return `${result} ${DIGITS[ones]}`;
};

const readTriple = (n: number, full: boolean): string => {
  if (n === 0) return full ? 'không' : '';

  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];

  if (hundred > 0) {
    parts.push(`${DIGITS[hundred]} trăm`);
    if (rest > 0 && rest < 10) parts.push('lẻ');
  } else if (full && rest > 0) {
    parts.push('không trăm');
  }

  if (rest > 0) parts.push(readPair(rest));

  return parts.join(' ').trim();
};

/** Chuyển số tiền (VNĐ) sang chữ tiếng Việt, ví dụ: "Ba triệu không trăm năm mươi ba nghìn ba trăm ba mươi mốt đồng" */
export const amountToVietnameseWords = (amount: number): string => {
  if (!amount || amount <= 0) return '...';

  const n = Math.floor(amount);
  if (n === 0) return 'Không đồng';

  const scales = ['', ' nghìn', ' triệu', ' tỷ'];
  const groups: number[] = [];
  let temp = n;

  while (temp > 0) {
    groups.unshift(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const parts: string[] = [];
  groups.forEach((group, index) => {
    if (group === 0) return;
    const text = readTriple(group, index > 0);
    if (text) parts.push(`${text}${scales[groups.length - 1 - index] ?? ''}`);
  });

  const words = parts.join(' ').replace(/\s+/g, ' ').trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} đồng`;
};
