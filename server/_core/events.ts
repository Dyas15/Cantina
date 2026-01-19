/**
 * Sistema de eventos para tempo real usando Server-Sent Events (SSE)
 * Permite notificar clientes sobre mudanças em pedidos, pagamentos, etc.
 */

import type { Response } from "express";

interface EventData {
  type: string;
  data: unknown;
  id?: string;
}

class EventEmitter {
  private clients: Map<string, Response> = new Map();
  private clientIdCounter = 0;

  /**
   * Registra um novo cliente SSE
   */
  registerClient(res: Response): string {
    const clientId = `client_${++this.clientIdCounter}_${Date.now()}`;
    
    // Configura headers SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Desabilita buffering do nginx
    
    // Envia mensagem inicial
    this.sendToClient(clientId, { type: "connected", data: { clientId } });
    
    this.clients.set(clientId, res);
    
    // Remove cliente quando desconecta
    res.on("close", () => {
      this.clients.delete(clientId);
    });
    
    return clientId;
  }

  /**
   * Envia evento para um cliente específico
   */
  private sendToClient(clientId: string, event: EventData): void {
    const res = this.clients.get(clientId);
    if (!res || res.closed) {
      this.clients.delete(clientId);
      return;
    }

    try {
      const eventId = event.id || Date.now().toString();
      const eventType = event.type || "message";
      const eventData = JSON.stringify(event.data);
      
      res.write(`id: ${eventId}\n`);
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${eventData}\n\n`);
    } catch (error) {
      console.error(`[SSE] Erro ao enviar evento para ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  /**
   * Envia evento para todos os clientes conectados
   */
  broadcast(event: EventData): void {
    const eventId = event.id || Date.now().toString();
    const eventType = event.type || "message";
    const eventData = JSON.stringify(event.data);
    
    const message = `id: ${eventId}\nevent: ${eventType}\ndata: ${eventData}\n\n`;
    
    // Envia para todos os clientes
    const disconnectedClients: string[] = [];
    
    this.clients.forEach((res, clientId) => {
      if (res.closed) {
        disconnectedClients.push(clientId);
        return;
      }
      
      try {
        res.write(message);
      } catch (error) {
        console.error(`[SSE] Erro ao enviar broadcast para ${clientId}:`, error);
        disconnectedClients.push(clientId);
      }
    });
    
    // Remove clientes desconectados
    disconnectedClients.forEach(id => this.clients.delete(id));
  }

  /**
   * Remove um cliente
   */
  removeClient(clientId: string): void {
    const res = this.clients.get(clientId);
    if (res && !res.closed) {
      try {
        res.end();
      } catch {
        // Ignora erros ao fechar
      }
    }
    this.clients.delete(clientId);
  }

  /**
   * Retorna número de clientes conectados
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Fecha todas as conexões
   */
  closeAll(): void {
    this.clients.forEach((res, clientId) => {
      try {
        res.end();
      } catch {
        // Ignora erros
      }
    });
    this.clients.clear();
  }
}

// Instância global do EventEmitter
export const eventEmitter = new EventEmitter();

/**
 * Funções helper para emitir eventos específicos
 */
export function emitOrderCreated(order: unknown): void {
  eventEmitter.broadcast({
    type: "order_created",
    data: { order },
    id: `order_created_${Date.now()}`,
  });
}

export function emitOrderUpdated(orderId: number, updates: unknown): void {
  eventEmitter.broadcast({
    type: "order_updated",
    data: { orderId, updates },
    id: `order_updated_${orderId}_${Date.now()}`,
  });
}

export function emitOrderStatusChanged(orderId: number, status: string): void {
  eventEmitter.broadcast({
    type: "order_status_changed",
    data: { orderId, status },
    id: `order_status_${orderId}_${Date.now()}`,
  });
}

export function emitPaymentStatusChanged(orderId: number, status: string): void {
  eventEmitter.broadcast({
    type: "payment_status_changed",
    data: { orderId, status },
    id: `payment_${orderId}_${Date.now()}`,
  });
}
