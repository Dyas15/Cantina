import { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { 
  Search, 
  RefreshCw, 
  Clock, 
  ChefHat, 
  CheckCircle, 
  Package, 
  XCircle,
  DollarSign,
  Plus,
  List,
  Eye
} from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: any; column: string }> = {
  aguardando_pagamento: { 
    label: "Aguardando Pagamento", 
    color: "bg-yellow-100 text-yellow-800 border-yellow-300", 
    icon: Clock,
    column: "novos"
  },
  em_preparo: { 
    label: "Em Preparo", 
    color: "bg-blue-100 text-blue-800 border-blue-300", 
    icon: ChefHat,
    column: "preparo"
  },
  pronto: { 
    label: "Pronto", 
    color: "bg-green-100 text-green-800 border-green-300", 
    icon: CheckCircle,
    column: "prontos"
  },
  entregue: { 
    label: "Entregue", 
    color: "bg-gray-100 text-gray-800 border-gray-300", 
    icon: Package,
    column: "entregues"
  },
  cancelado: { 
    label: "Cancelado", 
    color: "bg-red-100 text-red-800 border-red-300", 
    icon: XCircle,
    column: "cancelados"
  },
};

const paymentLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  fiado: "Fiado",
};

const columns = [
  { id: "novos", title: "Novos", status: "aguardando_pagamento" },
  { id: "preparo", title: "Em Preparo", status: "em_preparo" },
  { id: "prontos", title: "Prontos", status: "pronto" },
  { id: "entregues", title: "Entregues", status: "entregue" },
];

export default function AdminOrdersKanban() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const utils = trpc.useUtils();

  // Conecta ao sistema de tempo real (SSE)
  const { isConnected } = useRealtimeOrders();

  const { data: orders, isLoading, refetch } = trpc.order.list.useQuery(
    {},
    { 
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    }
  );

  const updateStatusMutation = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.order.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updatePaymentMutation = trpc.order.updatePaymentStatus.useMutation({
    onSuccess: () => {
      toast.success("Pagamento confirmado!");
      utils.order.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Filtrar pedidos
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let filtered = orders;

    if (searchQuery) {
      filtered = filtered.filter(
        (o) =>
          o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.orderNumber.toString().includes(searchQuery)
      );
    }

    // Remove cancelados da visualização Kanban
    filtered = filtered.filter((o) => o.orderStatus !== "cancelado");

    return filtered;
  }, [orders, searchQuery]);

  // Agrupar pedidos por coluna com ordenação correta
  const ordersByColumn = useMemo(() => {
    const grouped: Record<string, typeof filteredOrders> = {
      novos: [],
      preparo: [],
      prontos: [],
      entregues: [],
    };

    filteredOrders.forEach((order) => {
      const status = statusConfig[order.orderStatus];
      if (status && grouped[status.column]) {
        grouped[status.column].push(order);
      }
    });

    // Ordenar: FIFO para novos, preparo, prontos (mais antigos primeiro)
    // Entregues: mais novos primeiro
    Object.keys(grouped).forEach((key) => {
      if (key === "entregues") {
        // Entregues: mais novos primeiro
        grouped[key].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else {
        // Resto: FIFO (mais antigos primeiro)
        grouped[key].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
    });

    return grouped;
  }, [filteredOrders]);

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus as any });
  };

  const handleMarkAsPaid = (orderId: number) => {
    updatePaymentMutation.mutate({ id: orderId, status: "pago" });
  };

  const OrderCard = ({ order }: { order: any }) => {
    const status = statusConfig[order.orderStatus];
    const StatusIcon = status.icon;

    return (
      <Card 
        className="mb-3 cursor-pointer hover:shadow-lg transition-shadow border-2"
        onClick={() => setSelectedOrder(order)}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-bold text-base sm:text-lg">#{order.orderNumber}</h4>
                {order.isPresencial && (
                  <Badge variant="outline" className="text-xs">Presencial</Badge>
                )}
              </div>
              <p className="font-semibold text-sm sm:text-base truncate">{order.customer.name}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">{order.customer.phone}</p>
            </div>
            <Badge className={`${status.color} border shrink-0`}>
              <StatusIcon className="h-3 w-3 mr-1" />
            </Badge>
          </div>

          <div className="space-y-1 mb-3 text-xs sm:text-sm">
            {order.items?.slice(0, 3).map((item: any, idx: number) => (
              <p key={idx} className="text-muted-foreground truncate">
                {item.quantity}x {item.productName}
                {item.flavor && ` (${item.flavor})`}
              </p>
            ))}
            {order.items && order.items.length > 3 && (
              <p className="text-muted-foreground text-xs">
                +{order.items.length - 3} item(s)
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-lg sm:text-xl font-bold text-primary">
              R$ {parseFloat(order.totalAmount).toFixed(2)}
            </span>
            <Badge variant={order.paymentStatus === "pago" ? "default" : "destructive"}>
              {order.paymentStatus === "pago" ? "Pago" : "Pendente"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            <Badge variant="secondary" className="text-xs">
              {paymentLabels[order.paymentMethod]}
            </Badge>
          </div>

          <div className="flex flex-col gap-2 mt-3">
            {/* Botão Ver Detalhes */}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedOrder(order);
              }}
            >
              <Eye className="h-3 w-3 mr-1" />
              Ver Detalhes
            </Button>

            {order.paymentStatus !== "pago" && order.orderStatus !== "cancelado" && (
              <Button
                size="sm"
                variant="default"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAsPaid(order.id);
                }}
              >
                <DollarSign className="h-3 w-3 mr-1" />
                Marcar Pago
              </Button>
            )}

            {order.orderStatus === "aguardando_pagamento" && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(order.id, "em_preparo");
                }}
              >
                <ChefHat className="h-3 w-3 mr-1" />
                Iniciar Preparo
              </Button>
            )}

            {order.orderStatus === "em_preparo" && (
              <Button
                size="sm"
                variant="outline"
                className="w-full bg-green-50 hover:bg-green-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(order.id, "pronto");
                }}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Marcar Pronto
              </Button>
            )}

            {order.orderStatus === "pronto" && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(order.id, "entregue");
                }}
              >
                <Package className="h-3 w-3 mr-1" />
                Marcar Entregue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Pedidos - Kanban</h1>
            <p className="text-sm text-muted-foreground">
              Visualização tipo fila de cozinha
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => window.location.href = "/admin/pedidos"}
            >
              <List className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${isConnected ? "text-green-500" : "text-yellow-500"}`} />
              <span className="hidden sm:inline">{isConnected ? "Tempo Real" : "Atualizar"}</span>
            </Button>
            <Button 
              size="sm"
              onClick={() => window.location.href = "/admin/clientes"}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Novo Pedido</span>
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card className="card-accessible">
          <CardContent className="pt-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Buscar por nome ou número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-accessible"
              />
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="spinner mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.map((column) => {
              const columnOrders = ordersByColumn[column.id] || [];
              const status = statusConfig[column.status];

              return (
                <div key={column.id} className="flex flex-col">
                  <Card className="mb-4">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                          {status.icon && <status.icon className="h-4 w-4 sm:h-5 sm:w-5" />}
                          {column.title}
                        </CardTitle>
                        <Badge variant="secondary" className="text-sm">
                          {columnOrders.length}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>

                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-350px)] sm:max-h-[calc(100vh-300px)]">
                    {columnOrders.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center">
                          <p className="text-muted-foreground text-sm">
                            Nenhum pedido
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      columnOrders.map((order) => (
                        <OrderCard key={order.id} order={order} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Order Details Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="dialog-content sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Status Pagamento</h4>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
