import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook para receber atualizações de pedidos em tempo real via SSE
 */
export function useRealtimeOrders() {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    // Cria conexão SSE
    const eventSource = new EventSource("/api/events");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log("[SSE] Conectado ao servidor de eventos");
    };

    eventSource.onerror = (error) => {
      console.error("[SSE] Erro na conexão:", error);
      setIsConnected(false);
      
      // Tenta reconectar após 3 segundos
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = new EventSource("/api/events");
        }
      }, 3000);
    };

    // Escuta eventos de pedido criado
    eventSource.addEventListener("order_created", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Novo pedido criado:", data);
        // Invalida cache para buscar novos dados
        utils.order.list.invalidate();
      } catch (error) {
        console.error("[SSE] Erro ao processar order_created:", error);
      }
    });

    // Escuta eventos de pedido atualizado
    eventSource.addEventListener("order_updated", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Pedido atualizado:", data);
        // Invalida cache para buscar dados atualizados
        utils.order.list.invalidate();
      } catch (error) {
        console.error("[SSE] Erro ao processar order_updated:", error);
      }
    });

    // Escuta eventos de mudança de status
    eventSource.addEventListener("order_status_changed", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Status do pedido mudou:", data);
        // Invalida cache
        utils.order.list.invalidate();
      } catch (error) {
        console.error("[SSE] Erro ao processar order_status_changed:", error);
      }
    });

    // Escuta eventos de mudança de pagamento
    eventSource.addEventListener("payment_status_changed", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Status de pagamento mudou:", data);
        // Invalida cache
        utils.order.list.invalidate();
      } catch (error) {
        console.error("[SSE] Erro ao processar payment_status_changed:", error);
      }
    });

    // Limpa conexão ao desmontar
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [utils]);

  return { isConnected };
}
