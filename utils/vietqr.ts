// --- PHẦN 1: LOGIC TẠO CHUỖI VIETQR (EMVCo Standard) ---

// Hàm tính CRC16-CCITT (0xFFFF, poly 0x1021)
export const crc16 = (data: string): string => {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

export const formatTLV = (id: string, value: string): string => {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
};

export const removeVietnameseTones = (str: string): string => {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, " ").trim();
};

// Mapping bankId to bankBin (BIN code for VietQR)
const getBankBin = (bankId: string): string => {
  const bankBinMap: Record<string, string> = {
    'VCB': '970436', // Vietcombank
    'TCB': '970407', // Techcombank
    'BIDV': '970415', // BIDV
    'ACB': '970416', // ACB
    'VIB': '970441', // VIB
    'VPB': '970432', // VPBank
    'TPB': '970423', // TPBank
    'HDB': '970437', // HDBank
    'MSB': '970426', // MSB
    'VAB': '970427', // VietABank
    'NAB': '970428', // NamABank
    'OCB': '970448', // OCB
    'MBB': '970422', // MBBank
    'STB': '970403', // Sacombank
    'VCCB': '970436', // Vietcombank (alternative)
  };
  return bankBinMap[bankId.toUpperCase()] || '970436'; // Default to Vietcombank
};

interface GenerateVietQROptions {
  accountNo: string;
  amount?: number;
  content?: string;
  bankId?: string;
}

export const generateVietQRString = ({ 
  accountNo, 
  amount, 
  content,
  bankId = 'VCB'
}: GenerateVietQROptions): string => {
  if (!accountNo) return "";

  const pfi = formatTLV("00", "01");
  const method = formatTLV("01", amount || content ? "12" : "11");
  const guid = formatTLV("00", "A000000727");
  const bankBin = getBankBin(bankId);
  const serviceCode = formatTLV("02", "QRIBFTTA");
  
  const merchantInfoContent = guid + formatTLV("01", formatTLV("00", bankBin) + formatTLV("01", accountNo)) + serviceCode;
  const merchantInfo = formatTLV("38", merchantInfoContent);
  const currency = formatTLV("53", "704");
  const amountStr = amount ? formatTLV("54", amount.toString()) : "";
  const country = formatTLV("58", "VN");

  let additionalData = "";
  if (content) {
    let cleanContent = removeVietnameseTones(content);
    
    // --- QUAN TRỌNG: GIỚI HẠN ĐỘ DÀI ---
    // Tag 62 chứa Tag 08. Tổng độ dài Tag 62 phải <= 99.
    // Tag 08 header tốn 4 ký tự ("08" + Length).
    // => Nội dung tối đa an toàn là 95 ký tự.
    if (cleanContent.length > 95) {
        cleanContent = cleanContent.substring(0, 95);
    }
    
    const referenceLabel = formatTLV("08", cleanContent);
    additionalData = formatTLV("62", referenceLabel);
  }

  const rawData = `${pfi}${method}${merchantInfo}${currency}${amountStr}${country}${additionalData}6304`;
  const checksum = crc16(rawData);

  return `${rawData}${checksum}`;
};
