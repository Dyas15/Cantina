import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Package, AlertCircle, Clock, CheckCircle } from "lucide-react";

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

export default function CustomerHistory() {
  const [, navigate] = useLocation();
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cantina_customer");
    if (!saved) {
      navigate("/");
      return;
    }
    setCustomer(JSON.parse(saved));
  }, [navigate]);

  const { data: orders, isLoading: ordersLoading } = trpc.customer.getHistory.useQuery(
    { customerId: customer?.id || 0 },
    { enabled: !!customer?.id }
  );

  const { data: debts, isLoading: debtsLoading } = trpc.customer.getDebts.useQuery(
    { customerId: customer?.id || 0 },
    { enabled: !!customer?.id }
  );

  const unpaidDebts = debts?.filter((d) => !d.isPaid) || [];
  const totalDebt = unpaidDebts.reduce((sum, d) => sum + parseFloat(d.amount), 0);

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4">
        <div className="container">
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
        {/* Debt Alert */}
        {totalDebt > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-orange-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-800">Você tem dívidas pendentes</p>
                <p className="text-2xl font-bold text-orange-600">
                  R$ {totalDebt.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-14">
            <TabsTrigger value="orders" className="text-lg">
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="debts" className="text-lg">
              Dívidas {unpaidDebts.length > 0 && `(${unpaidDebts.length})`}
            </TabsTrigger>
          </TabsList>

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
                        <Badge className={statusColors[order.orderStatus]}>
                          {statusLabels[order.orderStatus]}
                        </Badge>
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

          <TabsContent value="debts" className="mt-4">
            {debtsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : debts?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                  <p className="mt-4 text-xl text-muted-foreground">
                    Você não tem dívidas pendentes
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {debts?.map((debt) => (
                  <Card key={debt.id} className={debt.isPaid ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">Pedido #{debt.order.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(debt.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">
                            R$ {parseFloat(debt.amount).toFixed(2)}
                          </p>
                          <Badge variant={debt.isPaid ? "default" : "destructive"}>
                            {debt.isPaid ? "Pago" : "Pendente"}
                          </Badge>
                        </div>
                      </div>
                      {debt.isPaid && debt.paidAt && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Pago em: {new Date(debt.paidAt).toLocaleString("pt-BR")}
                        </p>
                      )}
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
