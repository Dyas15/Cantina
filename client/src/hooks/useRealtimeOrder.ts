import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook para receber atualizações de um pedido específico em tempo real
 */
export function useRealtimeOrder(orderId: number) {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const utils = trpc.useUtils();

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
    const handleOrderUpdate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.orderId === orderId || data.order?.id === orderId) {
          // Invalida cache para buscar dados atualizados
          utils.order.getById.invalidate({ id: orderId });
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
  }, [orderId, utils]);

  return { isConnected };
}
