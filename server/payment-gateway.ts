/**
 * Serviço de Gateway de Pagamento
 * 
 * Este arquivo prepara a integração com gateways de pagamento como:
 * - Mercado Pago
 * - PagSeguro
 * - Stripe
 * - Pagar.me
 * - Asaas
 * 
 * Para ativar, configure as variáveis de ambiente:
 * - PAYMENT_GATEWAY_PROVIDER: "mercadopago" | "pagseguro" | "stripe" | "pagarme" | "asaas"
 * - PAYMENT_GATEWAY_API_KEY: Chave de API do gateway
 * - PAYMENT_GATEWAY_SECRET_KEY: Chave secreta (se necessário)
 * - PAYMENT_GATEWAY_WEBHOOK_SECRET: Segredo para validar webhooks
 */

import { createLogger } from "./_core/logger";

const logger = createLogger('PaymentGateway');

// Tipos
export interface PaymentConfig {
  provider: string;
  apiKey: string;
  secretKey?: string;
  webhookSecret?: string;
  sandbox: boolean;
}

export interface PixPaymentRequest {
  orderId: number;
  amount: number;
  customerName: string;
  customerEmail?: string;
  customerDocument?: string; // CPF/CNPJ
  expirationMinutes?: number;
  description?: string;
}

export interface PixPaymentResponse {
  transactionId: string;
  pixCode: string; // Código copia e cola
  qrCodeBase64?: string; // QR Code em base64
  expiresAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

export interface CardPaymentRequest {
  orderId: number;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerDocument: string;
  // Se usar cartão salvo
  savedCardToken?: string;
  // Se usar cartão novo
  cardNumber?: string;
  cardHolderName?: string;
  cardExpirationMonth?: string;
  cardExpirationYear?: string;
  cardCvv?: string;
  saveCard?: boolean;
  installments?: number;
}

export interface CardPaymentResponse {
  transactionId: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_analysis';
  authorizationCode?: string;
  // Se o cartão foi salvo
  savedCardToken?: string;
  savedCardLastFour?: string;
  savedCardBrand?: string;
}

export interface SavedCardInfo {
  token: string;
  lastFourDigits: string;
  brand: string;
  expirationMonth: number;
  expirationYear: number;
  holderName: string;
}

export interface WebhookPayload {
  transactionId: string;
  status: string;
  type: 'pix' | 'card';
  metadata?: Record<string, unknown>;
}

// Verifica se o gateway está configurado
export function isGatewayConfigured(): boolean {
  return !!(
    process.env.PAYMENT_GATEWAY_PROVIDER &&
    process.env.PAYMENT_GATEWAY_API_KEY
  );
}

// Obtém a configuração do gateway
export function getGatewayConfig(): PaymentConfig | null {
  if (!isGatewayConfigured()) {
    return null;
  }

  return {
    provider: process.env.PAYMENT_GATEWAY_PROVIDER!,
    apiKey: process.env.PAYMENT_GATEWAY_API_KEY!,
    secretKey: process.env.PAYMENT_GATEWAY_SECRET_KEY,
    webhookSecret: process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET,
    sandbox: process.env.NODE_ENV !== 'production',
  };
}

/**
 * Classe abstrata para implementação de gateways
 */
abstract class PaymentGatewayProvider {
  protected config: PaymentConfig;

  constructor(config: PaymentConfig) {
    this.config = config;
  }

  abstract createPixPayment(request: PixPaymentRequest): Promise<PixPaymentResponse>;
  abstract createCardPayment(request: CardPaymentRequest): Promise<CardPaymentResponse>;
  abstract getPaymentStatus(transactionId: string): Promise<{ status: string; metadata?: Record<string, unknown> }>;
  abstract validateWebhook(payload: unknown, signature: string): Promise<WebhookPayload | null>;
  abstract tokenizeCard(cardData: Omit<CardPaymentRequest, 'orderId' | 'amount' | 'savedCardToken'>): Promise<SavedCardInfo>;
  abstract deleteCard(token: string): Promise<boolean>;
}

/**
 * Implementação placeholder - será substituída pela implementação real
 */
class PlaceholderGateway extends PaymentGatewayProvider {
  async createPixPayment(request: PixPaymentRequest): Promise<PixPaymentResponse> {
    logger.warn('Gateway não configurado - usando placeholder para PIX');
    
    // Gera um código PIX fake para desenvolvimento
    const transactionId = `pix_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const expiresAt = new Date(Date.now() + (request.expirationMinutes || 30) * 60 * 1000);
    
    return {
      transactionId,
      pixCode: `00020126580014br.gov.bcb.pix0136${transactionId}520400005303986540${request.amount.toFixed(2)}5802BR5913CANTINA TESTE6009SAO PAULO62070503***6304XXXX`,
      expiresAt,
      status: 'pending',
    };
  }

  async createCardPayment(request: CardPaymentRequest): Promise<CardPaymentResponse> {
    logger.warn('Gateway não configurado - usando placeholder para cartão');
    
    const transactionId = `card_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    return {
      transactionId,
      status: 'pending',
      authorizationCode: 'PLACEHOLDER',
    };
  }

  async getPaymentStatus(transactionId: string): Promise<{ status: string; metadata?: Record<string, unknown> }> {
    logger.warn('Gateway não configurado - retornando status pendente');
    return { status: 'pending' };
  }

  async validateWebhook(payload: unknown, signature: string): Promise<WebhookPayload | null> {
    logger.warn('Gateway não configurado - webhook não validado');
    return null;
  }

  async tokenizeCard(cardData: Omit<CardPaymentRequest, 'orderId' | 'amount' | 'savedCardToken'>): Promise<SavedCardInfo> {
    logger.warn('Gateway não configurado - tokenização não disponível');
    throw new Error('Gateway de pagamento não configurado');
  }

  async deleteCard(token: string): Promise<boolean> {
    logger.warn('Gateway não configurado - exclusão não disponível');
    return false;
  }
}

/**
 * Implementação para Mercado Pago
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs
 */
class MercadoPagoGateway extends PaymentGatewayProvider {
  private baseUrl: string;

  constructor(config: PaymentConfig) {
    super(config);
    this.baseUrl = config.sandbox 
      ? 'https://api.mercadopago.com'
      : 'https://api.mercadopago.com';
  }

  async createPixPayment(request: PixPaymentRequest): Promise<PixPaymentResponse> {
    // TODO: Implementar chamada real à API do Mercado Pago
    // POST /v1/payments
    // {
    //   transaction_amount: request.amount,
    //   payment_method_id: 'pix',
    //   payer: {
    //     email: request.customerEmail,
    //     identification: { type: 'CPF', number: request.customerDocument }
    //   }
    // }
    
    logger.info('MercadoPago PIX - implementação pendente', { orderId: request.orderId });
    throw new Error('Implementação do Mercado Pago pendente - configure PAYMENT_GATEWAY_API_KEY');
  }

  async createCardPayment(request: CardPaymentRequest): Promise<CardPaymentResponse> {
    // TODO: Implementar chamada real à API do Mercado Pago
    logger.info('MercadoPago Card - implementação pendente', { orderId: request.orderId });
    throw new Error('Implementação do Mercado Pago pendente');
  }

  async getPaymentStatus(transactionId: string): Promise<{ status: string }> {
    // TODO: GET /v1/payments/{id}
    throw new Error('Implementação pendente');
  }

  async validateWebhook(payload: unknown, signature: string): Promise<WebhookPayload | null> {
    // TODO: Validar assinatura do webhook
    throw new Error('Implementação pendente');
  }

  async tokenizeCard(cardData: Omit<CardPaymentRequest, 'orderId' | 'amount' | 'savedCardToken'>): Promise<SavedCardInfo> {
    // TODO: POST /v1/customers/{customer_id}/cards
    throw new Error('Implementação pendente');
  }

  async deleteCard(token: string): Promise<boolean> {
    // TODO: DELETE /v1/customers/{customer_id}/cards/{card_id}
    throw new Error('Implementação pendente');
  }
}

/**
 * Implementação para Asaas
 * Documentação: https://docs.asaas.com/
 */
class AsaasGateway extends PaymentGatewayProvider {
  private baseUrl: string;

  constructor(config: PaymentConfig) {
    super(config);
    this.baseUrl = config.sandbox 
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';
  }

  async createPixPayment(request: PixPaymentRequest): Promise<PixPaymentResponse> {
    // TODO: Implementar chamada real à API do Asaas
    // POST /payments
    // {
    //   customer: customerId,
    //   billingType: 'PIX',
    //   value: request.amount,
    //   dueDate: expirationDate
    // }
    // GET /payments/{id}/pixQrCode
    
    logger.info('Asaas PIX - implementação pendente', { orderId: request.orderId });
    throw new Error('Implementação do Asaas pendente - configure PAYMENT_GATEWAY_API_KEY');
  }

  async createCardPayment(request: CardPaymentRequest): Promise<CardPaymentResponse> {
    // TODO: Implementar chamada real à API do Asaas
    logger.info('Asaas Card - implementação pendente', { orderId: request.orderId });
    throw new Error('Implementação do Asaas pendente');
  }

  async getPaymentStatus(transactionId: string): Promise<{ status: string }> {
    // TODO: GET /payments/{id}
    throw new Error('Implementação pendente');
  }

  async validateWebhook(payload: unknown, signature: string): Promise<WebhookPayload | null> {
    // TODO: Validar token do webhook
    throw new Error('Implementação pendente');
  }

  async tokenizeCard(cardData: Omit<CardPaymentRequest, 'orderId' | 'amount' | 'savedCardToken'>): Promise<SavedCardInfo> {
    // TODO: POST /creditCard/tokenize
    throw new Error('Implementação pendente');
  }

  async deleteCard(token: string): Promise<boolean> {
    // Asaas não suporta exclusão de token diretamente
    return true;
  }
}

// Factory para criar o gateway correto
function createGateway(): PaymentGatewayProvider {
  const config = getGatewayConfig();
  
  if (!config) {
    return new PlaceholderGateway({
      provider: 'placeholder',
      apiKey: '',
      sandbox: true,
    });
  }

  switch (config.provider.toLowerCase()) {
    case 'mercadopago':
      return new MercadoPagoGateway(config);
    case 'asaas':
      return new AsaasGateway(config);
    // Adicione outros gateways aqui
    default:
      logger.warn(`Gateway ${config.provider} não suportado, usando placeholder`);
      return new PlaceholderGateway(config);
  }
}

// Instância singleton do gateway
let gatewayInstance: PaymentGatewayProvider | null = null;

export function getGateway(): PaymentGatewayProvider {
  if (!gatewayInstance) {
    gatewayInstance = createGateway();
  }
  return gatewayInstance;
}

// Funções de conveniência
export async function createPixPayment(request: PixPaymentRequest): Promise<PixPaymentResponse> {
  return getGateway().createPixPayment(request);
}

export async function createCardPayment(request: CardPaymentRequest): Promise<CardPaymentResponse> {
  return getGateway().createCardPayment(request);
}

export async function getPaymentStatus(transactionId: string) {
  return getGateway().getPaymentStatus(transactionId);
}

export async function validateWebhook(payload: unknown, signature: string) {
  return getGateway().validateWebhook(payload, signature);
}

export async function tokenizeCard(cardData: Omit<CardPaymentRequest, 'orderId' | 'amount' | 'savedCardToken'>) {
  return getGateway().tokenizeCard(cardData);
}

export async function deleteCard(token: string) {
  return getGateway().deleteCard(token);
}
