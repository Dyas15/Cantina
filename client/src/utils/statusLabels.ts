/**
 * Mapeamento de status técnicos para linguagem simples e acessível
 * Projetado para idosos e pessoas leigas
 */

export const orderStatusLabels: Record<string, string> = {
  aguardando_pagamento: "Aguardando Pagamento",
  em_preparo: "Estamos Preparando",
  pronto: "Pode Retirar",
  entregue: "Pedido Entregue",
  cancelado: "Pedido Cancelado",
};

export const paymentStatusLabels: Record<string, string> = {
  pendente: "Pagamento Pendente",
  pago: "Pagamento Confirmado",
  cancelado: "Pagamento Cancelado",
};

export const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão de Crédito/Débito",
  fiado: "Pagar Depois",
};

/**
 * Retorna mensagem amigável para o status do pedido
 */
export function getOrderStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    aguardando_pagamento: "Seu pedido foi recebido! Aguardando confirmação do pagamento.",
    em_preparo: "Seu pedido está sendo preparado com carinho!",
    pronto: "Seu pedido está pronto! Você já pode retirar.",
    entregue: "Pedido entregue com sucesso! Obrigado pela preferência.",
    cancelado: "Este pedido foi cancelado.",
  };
  
  return messages[status] || "Acompanhe o status do seu pedido aqui.";
}

/**
 * Retorna mensagem amigável para o status do pagamento
 */
export function getPaymentStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    pendente: "Aguardando confirmação do pagamento.",
    pago: "Pagamento confirmado! Seu pedido será preparado.",
    cancelado: "Pagamento cancelado.",
  };
  
  return messages[status] || "";
}
