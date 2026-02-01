import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Package, AlertCircle, Clock, CheckCircle, DollarSign, ChefHat, Bell, RefreshCw } from "lucide-react";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";

interface Customer {
  id: number;
  name: string;
  phone: string;
  totalSpent: string;
  totalDebt: string;
}

const statusLabels: Record<string, string> = {
  aguardando_pagamento: "Aguardando",
  em_preparo: "Em Preparo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const statusColors: Record<string, string> = {
  aguardando_pagamento: "status-aguardando",
  em_preparo: "status-preparo",
  pronto: "status-pronto",
  entregue: "status-entregue",
  cancelado: "status-cancelado",
};

const paymentStatusLabels: Record<string, string> = {
  pendente: "Pagamento Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  fiado: "Fiado",
};

export default function CustomerHistory() {
  const [, navigate] = useLocation();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState("pending");

  // Conecta ao sistema de tempo real
  useRealtimeOrders();

  useEffect(() => {
    const saved = localStorage.getItem("cantina_customer");
    if (!saved) {
      navigate("/");
      return;
    }
    setCustomer(JSON.parse(saved));
  }, [navigate]);

  // Busca pedidos pendentes (não entregues)
  const { data: pendingOrders, isLoading: pendingLoading, refetch: refetchPending } = trpc.customer.getPendingOrders.useQuery(
    { customerId: customer?.id || 0 },
    { 
      enabled: !!customer?.id,
      refetchInterval: 30000, // Atualiza a cada 30 segundos
    }
  );

  // Busca histórico completo
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = trpc.customer.getHistory.useQuery(
    { customerId: customer?.id || 0 },
    { enabled: !!customer?.id }
  );

  // Busca dívidas
  const { data: debts, isLoading: debtsLoading, refetch: refetchDebts } = trpc.customer.getDebts.useQuery(
    { customerId: customer?.id || 0 },
    { enabled: !!customer?.id }
  );

  // Dívidas da tabela debts (fiado)
  const unpaidDebts = debts?.filter((d) => !d.isPaid) || [];
  const totalDebtFromDebts = unpaidDebts.reduce((sum, d) => sum + parseFloat(d.amount), 0);

  // Pedidos com pagamento pendente (qualquer método de pagamento)
  const pendingPaymentOrders = orders?.filter(
    (o) => o.paymentStatus === 'pendente' && o.orderStatus !== 'cancelado'
  ) || [];
  
  // Total de pagamentos pendentes (excluindo os que já estão em debts para evitar duplicação)
  const debtOrderIds = new Set(unpaidDebts.map(d => d.orderId));
  const pendingPaymentOrdersNotInDebts = pendingPaymentOrders.filter(
    o => !debtOrderIds.has(o.id)
  );
  const totalPendingPayments = pendingPaymentOrdersNotInDebts.reduce(
    (sum, o) => sum + parseFloat(o.totalAmount), 0
  );

  // Total geral de dívidas
  const totalDebt = totalDebtFromDebts + totalPendingPayments;

  // Quantidade total de pendências de pagamento
  const totalDebtCount = unpaidDebts.length + pendingPaymentOrdersNotInDebts.length;

  // Pedidos em andamento (não entregues e não cancelados)
  const inProgressOrders = pendingOrders || [];
  const inProgressCount = inProgressOrders.length;

  // Função para atualizar tudo
  const handleRefresh = () => {
    refetchPending();
    refetchOrders();
    refetchDebts();
  };

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4">
        <div className="container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => navigate("/cardapio")}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <h1 className="text-2xl font-bold">Meus Pedidos</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Customer Info */}
      <div className="bg-primary/5 py-4 border-b">
        <div className="container">
          <p className="text-lg font-medium">{customer.name}</p>
          <p className="text-muted-foreground">{customer.phone}</p>
        </div>
      </div>

      <main className="container py-6">
        {/* Alert Cards */}
        <div className="space-y-4 mb-6">
          {/* Pedidos em andamento */}
          {inProgressCount > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4 flex items-center gap-4">
                <ChefHat className="h-8 w-8 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-800">Pedidos em andamento</p>
                  <p className="text-sm text-blue-700">
                    {inProgressCount} pedido{inProgressCount > 1 ? 's' : ''} aguardando preparo ou retirada
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-400 text-blue-700 hover:bg-blue-100"
                  onClick={() => setActiveTab("pending")}
                >
                  Ver
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Dívidas */}
          {totalDebt > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4 flex items-center gap-4">
                <AlertCircle className="h-8 w-8 text-orange-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-orange-800">Pagamentos pendentes</p>
                  <p className="text-2xl font-bold text-orange-600">
                    R$ {totalDebt.toFixed(2)}
                  </p>
                  <p className="text-sm text-orange-700">
                    {totalDebtCount} pedido{totalDebtCount > 1 ? 's' : ''} aguardando pagamento
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-400 text-orange-700 hover:bg-orange-100"
                  onClick={() => setActiveTab("debts")}
                >
                  Ver
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-14">
            <TabsTrigger value="pending" className="text-base relative">
              <Bell className="h-4 w-4 mr-1" />
              Em Andamento
              {inProgressCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {inProgressCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-base">
              <Package className="h-4 w-4 mr-1" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="debts" className="text-base relative">
              <DollarSign className="h-4 w-4 mr-1" />
              Dívidas
              {totalDebtCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {totalDebtCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Aba de Pedidos em Andamento */}
          <TabsContent value="pending" className="mt-4">
            {pendingLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : inProgressOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                  <p className="mt-4 text-xl text-muted-foreground">
                    Nenhum pedido em andamento
                  </p>
                  <Button
                    className="mt-6 btn-accessible"
                    onClick={() => navigate("/cardapio")}
                  >
                    Fazer Novo Pedido
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {inProgressOrders.map((order) => (
                  <Card
                    key={order.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      order.orderStatus === 'pronto' ? 'border-green-400 bg-green-50 animate-pulse' : ''
                    }`}
                    onClick={() => navigate(`/pedido/${order.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-lg">Pedido #{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={statusColors[order.orderStatus]}>
                            {statusLabels[order.orderStatus]}
                          </Badge>
                          {order.orderStatus === 'pronto' && (
                            <span className="text-sm font-semibold text-green-600 animate-bounce">
                              🎉 Retire seu pedido!
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        {order.items?.slice(0, 3).map((item: any, idx: number) => (
                          <p key={idx} className="text-sm text-muted-foreground">
                            {item.quantity}x {item.productName}
                            {item.flavor && ` (${item.flavor})`}
                          </p>
                        ))}
                        {order.items && order.items.length > 3 && (
                          <p className="text-sm text-muted-foreground">
                            +{order.items.length - 3} itens
                          </p>
                        )}
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
                          </span>
                          {order.paymentStatus === 'pendente' && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                              Aguardando Pagamento
                            </Badge>
                          )}
                        </div>
                        <span className="text-xl font-bold text-primary">
                          R$ {parseFloat(order.totalAmount).toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Aba de Histórico */}
          <TabsContent value="orders" className="mt-4">
            {ordersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : orders?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground" />
                  <p className="mt-4 text-xl text-muted-foreground">
                    Você ainda não fez nenhum pedido
                  </p>
                  <Button
                    className="mt-6 btn-accessible"
                    onClick={() => navigate("/cardapio")}
                  >
                    Fazer Primeiro Pedido
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders?.map((order) => (
                  <Card
                    key={order.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/pedido/${order.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-lg">Pedido #{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={statusColors[order.orderStatus]}>
                            {statusLabels[order.orderStatus]}
                          </Badge>
                          {order.paymentStatus === 'pendente' && order.orderStatus !== 'cancelado' && (
                            <Badge variant="destructive" className="text-xs">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {paymentStatusLabels[order.paymentStatus]}
                            </Badge>
                          )}
                          {order.paymentStatus === 'pago' && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Pago
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        {order.items?.slice(0, 3).map((item: any, idx: number) => (
                          <p key={idx} className="text-sm text-muted-foreground">
                            {item.quantity}x {item.productName}
                            {item.flavor && ` (${item.flavor})`}
                          </p>
                        ))}
                        {order.items && order.items.length > 3 && (
                          <p className="text-sm text-muted-foreground">
                            +{order.items.length - 3} itens
                          </p>
                        )}
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-3 border-t">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="text-xl font-bold text-primary">
                          R$ {parseFloat(order.totalAmount).toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Aba de Dívidas */}
          <TabsContent value="debts" className="mt-4">
            {(ordersLoading || debtsLoading) ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : totalDebtCount === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                  <p className="mt-4 text-xl text-muted-foreground">
                    Você não tem pagamentos pendentes
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Resumo */}
                <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-orange-700">Total em dívidas</p>
                        <p className="text-3xl font-bold text-orange-600">
                          R$ {totalDebt.toFixed(2)}
                        </p>
                      </div>
                      <AlertCircle className="h-12 w-12 text-orange-400" />
                    </div>
                  </CardContent>
                </Card>

                {/* Pedidos com pagamento pendente (não fiado) */}
                {pendingPaymentOrdersNotInDebts.map((order) => (
                  <Card 
                    key={`order-${order.id}`} 
                    className="border-orange-200 cursor-pointer hover:shadow-md"
                    onClick={() => navigate(`/pedido/${order.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">Pedido #{order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString("pt-BR")}
                          </p>
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-orange-600">
                            R$ {parseFloat(order.totalAmount).toFixed(2)}
                          </p>
                          <Badge variant="destructive" className="mt-1">
                            Pendente
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Dívidas (fiado) */}
                {unpaidDebts.map((debt) => (
                  <Card 
                    key={`debt-${debt.id}`} 
                    className="border-red-200 cursor-pointer hover:shadow-md"
                    onClick={() => navigate(`/pedido/${debt.orderId}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">Pedido #{debt.order?.orderNumber || debt.orderId}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(debt.createdAt).toLocaleString("pt-BR")}
                          </p>
                          <Badge variant="secondary" className="mt-2 text-xs bg-orange-100 text-orange-700">
                            <Clock className="h-3 w-3 mr-1" />
                            Fiado
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-red-600">
                            R$ {parseFloat(debt.amount).toFixed(2)}
                          </p>
                          <Badge variant="destructive" className="mt-1">
                            Dívida
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
