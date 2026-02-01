import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { notifyOrderReady, initAudioContext } from "@/lib/notifications";

/**
 * Hook para receber atualizações de um pedido específico em tempo real
 * Inclui notificação sonora e vibração quando o pedido fica pronto
 */
export function useRealtimeOrder(orderId: number) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasNotifiedRef = useRef(false);
  const utils = trpc.useUtils();

  // Função para lidar com a notificação de pedido pronto
  const handleOrderReady = useCallback(async (orderNumber?: number) => {
    if (!hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      await notifyOrderReady(orderNumber);
    }
  }, []);

  // Inicializa o contexto de áudio na primeira interação
  useEffect(() => {
    const handleInteraction = () => {
      initAudioContext();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  useEffect(() => {
    if (!orderId || orderId <= 0) return;

    // Cria conexão SSE
    const eventSource = new EventSource("/api/events");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      // Tenta reconectar
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = new EventSource("/api/events");
        }
      }, 3000);
    };

    // Escuta eventos relacionados a este pedido
    const handleOrderUpdate = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Verifica se é o pedido correto
        if (data.orderId === orderId || data.order?.id === orderId) {
          // Invalida cache para buscar dados atualizados
          utils.order.getById.invalidate({ id: orderId });
          
          // Verifica se o status mudou para "pronto"
          const newStatus = data.status || data.order?.orderStatus;
          if (newStatus === 'pronto' && lastStatus !== 'pronto') {
            const orderNumber = data.order?.orderNumber || data.orderNumber;
            await handleOrderReady(orderNumber);
          }
          
          if (newStatus) {
            setLastStatus(newStatus);
          }
        }
      } catch (error) {
        console.error("[SSE] Erro ao processar atualização:", error);
      }
    };

    eventSource.addEventListener("order_updated", handleOrderUpdate);
    eventSource.addEventListener("order_status_changed", handleOrderUpdate);
    eventSource.addEventListener("payment_status_changed", handleOrderUpdate);

    return () => {
      eventSource.removeEventListener("order_updated", handleOrderUpdate);
      eventSource.removeEventListener("order_status_changed", handleOrderUpdate);
      eventSource.removeEventListener("payment_status_changed", handleOrderUpdate);
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [orderId, utils, lastStatus, handleOrderReady]);

  // Reset da flag de notificação quando o pedido muda
  useEffect(() => {
    hasNotifiedRef.current = false;
    setLastStatus(null);
  }, [orderId]);

  return { isConnected, lastStatus };
}
