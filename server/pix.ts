/**
 * Geração de QR Code Pix (EMVCo)
 * Implementa o padrão do Banco Central do Brasil
 */

interface PixData {
  pixKey: string; // Chave Pix (CPF, CNPJ, email, telefone, chave aleatória)
  description: string; // Descrição do pagamento
  merchantName: string; // Nome do recebedor
  merchantCity: string; // Cidade do recebedor
  amount: number; // Valor em reais (opcional)
  transactionId?: string; // ID único da transação
}

/**
 * Gera o payload Pix no formato EMVCo
 * @param pixKey - Chave PIX do recebedor
 * @param customerName - Nome do cliente (para descrição)
 * @param merchantName - Nome do estabelecimento
 * @param amount - Valor do pagamento (string ou number)
 * @param merchantCity - Cidade do estabelecimento (padrão: "SAO PAULO")
 */
export async function generatePixPayload(
  pixKey: string,
  customerName: string,
  merchantName: string,
  amount: string | number,
  merchantCity: string = "SAO PAULO"
): Promise<string> {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  const data: PixData = {
    pixKey,
    description: `Pedido - ${customerName}`,
    merchantName: merchantName.substring(0, 25), // Limite de 25 caracteres
    merchantCity: merchantCity.substring(0, 15), // Limite de 15 caracteres
    amount: numericAmount,
  };

  return generatePixPayloadInternal(data);
}

/**
 * Gera o payload Pix no formato EMVCo (implementação interna)
 */
function generatePixPayloadInternal(data: PixData): string {
  const {
    pixKey,
    merchantName,
    merchantCity,
    amount,
    transactionId,
  } = data;

  // ID do Payload Format Indicator (00) - sempre "01"
  const payloadFormatIndicator = "000201";

  // Merchant Account Information (26)
  // ID do GUI (00) - sempre "br.gov.bcb.pix"
  const gui = "0014br.gov.bcb.pix";
  // ID da chave Pix (01)
  const keyLength = pixKey.length.toString().padStart(2, "0");
  const pixKeyData = `01${keyLength}${pixKey}`;
  const merchantAccountInfo = `26${(gui + pixKeyData).length.toString().padStart(2, "0")}${gui}${pixKeyData}`;

  // Merchant Category Code (52) - "0000" para genérico
  const merchantCategoryCode = "52040000";

  // Transaction Currency (53) - "986" para BRL
  const transactionCurrency = "5303986";

  // Transaction Amount (54) - opcional, só inclui se houver valor
  const transactionAmount = amount
    ? `54${amount.toFixed(2).length.toString().padStart(2, "0")}${amount.toFixed(2)}`
    : "";

  // Country Code (58) - "BR"
  const countryCode = "5802BR";

  // Merchant Name (59)
  const cleanMerchantName = merchantName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const merchantNameLength = cleanMerchantName.length.toString().padStart(2, "0");
  const merchantNameData = `59${merchantNameLength}${cleanMerchantName}`;

  // Merchant City (60)
  const cleanMerchantCity = merchantCity.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const merchantCityLength = cleanMerchantCity.length.toString().padStart(2, "0");
  const merchantCityData = `60${merchantCityLength}${cleanMerchantCity}`;

  // Additional Data Field Template (62)
  // Transaction ID (05) - ID único da transação
  const txId = transactionId || generateTransactionId();
  const txIdLength = txId.length.toString().padStart(2, "0");
  const additionalDataContent = `05${txIdLength}${txId}`;
  const additionalDataLength = additionalDataContent.length.toString().padStart(2, "0");
  const additionalData = `62${additionalDataLength}${additionalDataContent}`;

  // CRC16 (63) - será calculado depois
  const crcPlaceholder = "6304";

  // Monta o payload sem CRC
  const payloadWithoutCrc =
    payloadFormatIndicator +
    merchantAccountInfo +
    merchantCategoryCode +
    transactionCurrency +
    transactionAmount +
    countryCode +
    merchantNameData +
    merchantCityData +
    additionalData +
    crcPlaceholder;

  // Calcula o CRC16
  const crc = calculateCRC16(payloadWithoutCrc);
  const crcHex = crc.toString(16).toUpperCase().padStart(4, "0");

  // Retorna o payload completo
  return payloadWithoutCrc + crcHex;
}

/**
 * Gera um ID único para a transação
 */
function generateTransactionId(): string {
  return `CANT${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

/**
 * Calcula o CRC16-CCITT (polinômio 0x1021)
 */
function calculateCRC16(data: string): number {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      const bit = (byte >> (7 - j) & 1) === 1;
      const c15 = (crc >> 15 & 1) === 1;
      crc <<= 1;
      if (c15 !== bit) {
        crc ^= polynomial;
      }
    }
  }

  crc &= 0xffff;
  return crc;
}

/**
 * Valida se uma chave Pix é válida
 */
export function validatePixKey(key: string): boolean {
  // Remove espaços e caracteres especiais
  const cleanKey = key.replace(/\s+/g, "");

  // Email
  if (cleanKey.includes("@")) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(cleanKey);
  }

  // CPF (11 dígitos)
  if (/^\d{11}$/.test(cleanKey)) {
    return validateCPF(cleanKey);
  }

  // CNPJ (14 dígitos)
  if (/^\d{14}$/.test(cleanKey)) {
    return validateCNPJ(cleanKey);
  }

  // Telefone (10 ou 11 dígitos, começando com área)
  if (/^\d{10,11}$/.test(cleanKey)) {
    return true;
  }

  // Chave aleatória (UUID format)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanKey)) {
    return true;
  }

  return false;
}

function validateCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, "");
  if (numbers.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(numbers)) return false;

  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers[10])) return false;

  return true;
}

function validateCNPJ(cnpj: string): boolean {
  const numbers = cnpj.replace(/\D/g, "");
  if (numbers.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(numbers)) return false;

  // Validação dos dígitos verificadores
  let length = numbers.length - 2;
  let numbersOnly = numbers.substring(0, length);
  const digits = numbers.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbersOnly.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  length = length + 1;
  numbersOnly = numbers.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbersOnly.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}
