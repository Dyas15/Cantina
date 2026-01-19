import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { Search, AlertCircle, CheckCircle, DollarSign, User, Phone, Calendar, Eye, Package } from "lucide-react";

const paymentLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  fiado: "Fiado",
};

export default function AdminDebts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showPaid, setShowPaid] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const utils = trpc.useUtils();
  
  // Conecta ao sistema de tempo real
  useRealtimeOrders();

  // Busca todos os pedidos e filtra por paymentStatus
  const { data: orders, isLoading } = trpc.order.list.useQuery(
    {},
    {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    }
  );

  const updatePaymentMutation = trpc.order.updatePaymentStatus.useMutation({
    onSuccess: () => {
      toast.success("Pagamento confirmado!");
      utils.order.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Filtra pedidos com pagamento pendente (dívidas)
  const pendingOrders = orders?.filter(
    (o) => {
      const matchesStatus = showPaid 
        ? true 
        : o.paymentStatus === 'pendente';
      const notCancelled = o.orderStatus !== 'cancelado';
      return matchesStatus && notCancelled;
    }
  ) || [];

  // Filtrar por busca
  const filteredOrders = pendingOrders.filter(
    (o) =>
      o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer.phone.includes(searchQuery) ||
      o.orderNumber.toString().includes(searchQuery)
  );

  // Agrupar por cliente
  const ordersByCustomer = filteredOrders.reduce((acc: Record<number, any>, order) => {
    if (!acc[order.customerId]) {
      acc[order.customerId] = {
        customer: order.customer,
        orders: [],
        totalPending: 0,
      };
    }
    acc[order.customerId].orders.push(order);
    if (order.paymentStatus === 'pendente') {
      acc[order.customerId].totalPending += parseFloat(order.totalAmount);
    }
    return acc;
  }, {});

  const totalPending = filteredOrders
    .filter((o) => o.paymentStatus === 'pendente')
    .reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);

  const handleMarkAsPaid = (orderId: number) => {
    updatePaymentMutation.mutate({ id: orderId, status: "pago" });
  };

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Dívidas</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Gerencie os pagamentos pendentes
              </p>
            </div>
            <Card className="bg-red-50 border-red-200 shrink-0">
              <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-red-600">Pendente</p>
                  <p className="text-lg sm:text-2xl font-bold text-red-700">
                    R$ {totalPending.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Buscar por nome, telefone ou pedido..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-accessible"
              />
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
              <Switch
                id="showPaid"
                checked={showPaid}
                onCheckedChange={setShowPaid}
              />
              <Label htmlFor="showPaid" className="text-sm cursor-pointer">Mostrar pagos</Label>
            </div>
          </div>
        </div>

        {/* Debts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : Object.keys(ordersByCustomer).length === 0 ? (
          <Card className="card-accessible">
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <p className="text-muted-foreground">
                {showPaid ? "Nenhum pedido encontrado" : "Nenhum pagamento pendente"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.values(ordersByCustomer)
              .sort((a: any, b: any) => b.totalPending - a.totalPending)
              .map((group: any) => (
                <Card key={group.customer.id} className="card-accessible overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                          <User className="h-5 w-5 shrink-0" />
                          <span className="truncate">{group.customer.name}</span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" />
                          {group.customer.phone}
                        </p>
                      </div>
                      {group.totalPending > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Total Pendente</p>
                          <p className="text-xl sm:text-2xl font-bold text-red-600">
                            R$ {group.totalPending.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {group.orders.map((order: any) => (
                        <div
                          key={order.id}
                          className={`p-3 rounded-xl ${
                            order.paymentStatus === "pago" 
                              ? "bg-green-50 border border-green-200" 
                              : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm sm:text-base">
                                Pedido #{order.orderNumber}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {paymentLabels[order.paymentMethod]}
                                </Badge>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                              {order.paymentStatus === "pago" && (
                                <p className="text-xs text-green-600 mt-1">
                                  Pago em: {new Date(order.updatedAt).toLocaleDateString("pt-BR")}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                              <div className="text-right">
                                <p className="text-lg sm:text-xl font-bold">
                                  R$ {parseFloat(order.totalAmount).toFixed(2)}
                                </p>
                                <Badge 
                                  variant={order.paymentStatus === "pago" ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {order.paymentStatus === "pago" ? "Pago" : "Pendente"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Detalhes
                            </Button>
                            {order.paymentStatus !== "pago" && (
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => handleMarkAsPaid(order.id)}
                                disabled={updatePaymentMutation.isPending}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Marcar Pago
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="dialog-content sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Pedido #{selectedOrder?.orderNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-2">
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-1">Cliente</h4>
                <p className="font-medium">{selectedOrder.customer.name}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer.phone}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">Itens</h4>
                <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}x {item.productName}
                        {item.flavor && <span className="text-muted-foreground"> ({item.flavor})</span>}
                      </span>
                      <span className="font-medium">R$ {parseFloat(item.subtotal).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary">R$ {parseFloat(selectedOrder.totalAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Pagamento</h4>
                  <p className="font-medium">{paymentLabels[selectedOrder.paymentMethod]}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Status</h4>
                  <Badge variant={selectedOrder.paymentStatus === "pago" ? "default" : "destructive"}>
                    {selectedOrder.paymentStatus === "pago" ? "Pago" : "Pendente"}
                  </Badge>
                </div>
              </div>

              {selectedOrder.notes && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Observações</h4>
                  <p className="text-sm bg-yellow-50 p-2 rounded-lg">{selectedOrder.notes}</p>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-1">Data/Hora</h4>
                <p className="text-sm">{new Date(selectedOrder.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            {selectedOrder?.paymentStatus !== "pago" && (
              <Button
                onClick={() => {
                  handleMarkAsPaid(selectedOrder.id);
                  setSelectedOrder(null);
                }}
                disabled={updatePaymentMutation.isPending}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Marcar como Pago
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
