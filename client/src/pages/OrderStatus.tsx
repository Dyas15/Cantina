import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Clock, ChefHat, CheckCircle, Package, XCircle, RefreshCw, Home } from "lucide-react";
import { useRealtimeOrder } from "@/hooks/useRealtimeOrder";
import { orderStatusLabels, paymentStatusLabels, paymentMethodLabels, getOrderStatusMessage, getPaymentStatusMessage } from "@/utils/statusLabels";

const statusConfig = {
  aguardando_pagamento: {
    label: "Pedido Recebido",
    icon: Clock,
    color: "status-aguardando",
    step: 1,
  },
  em_preparo: {
    label: "Estamos Preparando",
    icon: ChefHat,
    color: "status-preparo",
    step: 2,
  },
  pronto: {
    label: "Pode Retirar",
    icon: CheckCircle,
    color: "status-pronto",
    step: 3,
  },
  entregue: {
    label: "Pedido Entregue",
    icon: Package,
    color: "status-entregue",
    step: 4,
  },
  cancelado: {
    label: "Pedido Cancelado",
    icon: XCircle,
    color: "status-cancelado",
    step: 0,
  },
};

export default function OrderStatus() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const orderId = parseInt(params.id || "0");

  // Conecta ao sistema de tempo real para este pedido
  const { isConnected } = useRealtimeOrder(orderId);

  const { data: order, isLoading, refetch } = trpc.order.getById.useQuery(
    { id: orderId },
    { 
      enabled: orderId > 0,
      // Não usa mais polling - tempo real via SSE
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    }
  );

  const [lastStatus, setLastStatus] = useState<string | null>(null);

  useEffect(() => {
    if (order && order.orderStatus !== lastStatus) {
      setLastStatus(order.orderStatus);
      // Poderia tocar um som ou vibrar quando o status mudar
    }
  }, [order?.orderStatus, lastStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-16 w-16 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-6 text-xl text-foreground">Carregando informações do pedido...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center card-accessible">
          <CardContent className="pt-8 pb-8">
            <XCircle className="h-20 w-20 mx-auto text-destructive" />
            <h2 className="text-3xl font-bold mt-6 text-foreground">Pedido não encontrado</h2>
            <p className="text-xl text-foreground/80 mt-4">
              Não encontramos o pedido #{orderId}.
            </p>
            <p className="text-lg text-foreground/70 mt-2">
              Verifique o número do pedido e tente novamente.
            </p>
            <Button
              className="mt-8 btn-accessible"
              onClick={() => navigate("/")}
            >
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[order.orderStatus as keyof typeof statusConfig];
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4">
        <div className="container">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate("/cardapio")}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-2xl font-bold">Pedido #{order.orderNumber}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Status Card */}
        <Card className="overflow-hidden card-accessible">
          <div className={`${status.color} p-8 text-center`}>
            <StatusIcon className="h-20 w-20 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">{status.label}</h2>
            <p className="text-xl opacity-90">{getOrderStatusMessage(order.orderStatus)}</p>
          </div>
          <CardContent className="pt-8">
            {/* Progress Steps */}
            {order.orderStatus !== "cancelado" && (
              <div className="flex justify-between mb-8">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex flex-col items-center">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${
                        step <= status.step
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step}
                    </div>
                    <span className="text-base mt-2 text-center max-w-20 font-medium">
                      {step === 1 && "Pagamento"}
                      {step === 2 && "Preparando"}
                      {step === 3 && "Pronto"}
                      {step === 4 && "Entregue"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-lg text-foreground/80">Cliente:</span>
                <span className="text-lg font-semibold">{order.customer.name}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-lg text-foreground/80">Forma de Pagamento:</span>
                <span className="text-lg font-semibold">
                  {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-lg text-foreground/80">Pagamento:</span>
                <Badge 
                  variant={order.paymentStatus === "pago" ? "default" : "secondary"}
                  className="text-base px-4 py-2"
                >
                  {paymentStatusLabels[order.paymentStatus] || order.paymentStatus}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-lg text-foreground/80">Data do Pedido:</span>
                <span className="text-lg font-semibold">
                  {new Date(order.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="card-accessible">
          <CardHeader>
            <CardTitle className="text-2xl">Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-4 bg-muted/50 rounded-xl border-2">
                  <div>
                    <p className="text-lg font-semibold">{item.productName}</p>
                    {item.flavor && (
                      <p className="text-base text-foreground/70 mt-1">Sabor: {item.flavor}</p>
                    )}
                    <p className="text-base text-foreground/70 mt-1">
                      {item.quantity} unidade{item.quantity > 1 ? "s" : ""} × R$ {parseFloat(item.unitPrice).toFixed(2)}
                    </p>
                  </div>
                  <span className="text-xl font-bold text-primary">
                    R$ {parseFloat(item.subtotal).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t-2 mt-6 pt-6">
              <div className="flex justify-between text-2xl font-bold">
                <span>Total:</span>
                <span className="text-primary">
                  R$ {parseFloat(order.totalAmount).toFixed(2)}
                </span>
              </div>
            </div>

            {order.notes && (
              <div className="mt-6 p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                <p className="text-lg font-semibold text-yellow-900 mb-2">Observações do Pedido:</p>
                <p className="text-base text-yellow-800">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-4">
          <Button
            variant="outline"
            className="w-full btn-accessible text-lg"
            onClick={() => navigate("/historico")}
          >
            Ver Todos os Meus Pedidos
          </Button>
          <Button
            className="w-full btn-accessible bg-primary hover:bg-primary/90 text-lg"
            onClick={() => navigate("/cardapio")}
          >
            <Home className="mr-2 h-6 w-6" />
            Fazer Novo Pedido
          </Button>
        </div>
      </main>
    </div>
  );
}
