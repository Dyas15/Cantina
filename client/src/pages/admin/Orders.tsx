import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  Grid3x3,
  Filter,
  Eye,
  Edit,
  Trash2,
  Undo2,
  CreditCard
} from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  aguardando_pagamento: { label: "Aguardando", color: "status-aguardando", icon: Clock },
  em_preparo: { label: "Em Preparo", color: "status-preparo", icon: ChefHat },
  pronto: { label: "Pronto", color: "status-pronto", icon: CheckCircle },
  entregue: { label: "Entregue", color: "status-entregue", icon: Package },
  cancelado: { label: "Cancelado", color: "status-cancelado", icon: XCircle },
};

const paymentLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  fiado: "Fiado",
};

export default function AdminOrders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados para modais
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPartialPayment, setShowPartialPayment] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<any>(null);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [orderForPartialPayment, setOrderForPartialPayment] = useState<any>(null);
  
  // Estados para formulários
  const [editNotes, setEditNotes] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [partialPaymentAmount, setPartialPaymentAmount] = useState("");

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
      utils.customer.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updatePaymentMutation = trpc.order.updatePaymentStatus.useMutation({
    onSuccess: () => {
      toast.success("Pagamento confirmado!");
      utils.order.list.invalidate();
      utils.customer.list.invalidate();
      utils.debt.list.invalidate();
      utils.report.sales.invalidate();
      utils.report.financialSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const undoPaymentMutation = trpc.order.undoPayment.useMutation({
    onSuccess: () => {
      toast.success("Pagamento revertido para pendente!");
      utils.order.list.invalidate();
      utils.customer.list.invalidate();
      utils.debt.list.invalidate();
      utils.report.sales.invalidate();
      utils.report.financialSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateOrderMutation = trpc.order.update.useMutation({
    onSuccess: () => {
      toast.success("Pedido atualizado!");
      setShowEditModal(false);
      setOrderToEdit(null);
      utils.order.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteOrderMutation = trpc.order.delete.useMutation({
    onSuccess: () => {
      toast.success("Pedido excluído!");
      setShowDeleteConfirm(false);
      setOrderToDelete(null);
      utils.order.list.invalidate();
      utils.customer.list.invalidate();
      utils.report.sales.invalidate();
      utils.report.financialSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const partialPaymentMutation = trpc.order.registerPartialPayment.useMutation({
    onSuccess: () => {
      toast.success("Pagamento parcial registrado!");
      setShowPartialPayment(false);
      setOrderForPartialPayment(null);
      setPartialPaymentAmount("");
      utils.order.list.invalidate();
      utils.customer.list.invalidate();
      utils.debt.list.invalidate();
      utils.report.sales.invalidate();
      utils.report.financialSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Filtrar e ordenar pedidos
  let filteredOrders = orders || [];

  if (searchQuery) {
    filteredOrders = filteredOrders.filter(
      (o) =>
        o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.orderNumber.toString().includes(searchQuery)
    );
  }

  if (statusFilter !== "all") {
    filteredOrders = filteredOrders.filter((o) => o.orderStatus === statusFilter);
  }

  // Ordenação especial para entregues (mais novos primeiro), resto FIFO
  if (statusFilter === "entregue") {
    filteredOrders = [...filteredOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else if (sortBy === "recent") {
    filteredOrders = [...filteredOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else if (sortBy === "oldest") {
    filteredOrders = [...filteredOrders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } else if (sortBy === "highest") {
    filteredOrders = [...filteredOrders].sort(
      (a, b) => parseFloat(b.totalAmount) - parseFloat(a.totalAmount)
    );
  }

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus as any });
  };

  const handleMarkAsPaid = (orderId: number) => {
    updatePaymentMutation.mutate({ id: orderId, status: "pago" });
  };

  const handleUndoPayment = (orderId: number) => {
    undoPaymentMutation.mutate({ id: orderId });
  };

  const openEditModal = (order: any) => {
    setOrderToEdit(order);
    setEditNotes(order.notes || "");
    setEditPaymentMethod(order.paymentMethod);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!orderToEdit) return;
    updateOrderMutation.mutate({
      id: orderToEdit.id,
      notes: editNotes,
      paymentMethod: editPaymentMethod as any,
    });
  };

  const openDeleteConfirm = (order: any) => {
    setOrderToDelete(order);
    setShowDeleteConfirm(true);
  };

  const handleDelete = () => {
    if (!orderToDelete) return;
    deleteOrderMutation.mutate({ id: orderToDelete.id });
  };

  const openPartialPayment = (order: any) => {
    setOrderForPartialPayment(order);
    setPartialPaymentAmount("");
    setShowPartialPayment(true);
  };

  const handlePartialPayment = () => {
    if (!orderForPartialPayment || !partialPaymentAmount) return;
    const amount = parseFloat(partialPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    partialPaymentMutation.mutate({
      id: orderForPartialPayment.id,
      amount: amount.toFixed(2),
    });
  };

  const getRemainingAmount = (order: any) => {
    const total = parseFloat(order.totalAmount);
    const paid = parseFloat(order.paidAmount || "0");
    return Math.max(0, total - paid);
  };

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Pedidos</h1>
              <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
                Gerencie os pedidos em tempo real
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                className="hidden sm:flex"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isConnected ? "text-green-500" : "text-yellow-500"}`} />
                {isConnected ? "Tempo Real" : "Atualizar"}
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => window.location.href = "/admin/pedidos/kanban"}
              >
                <Grid3x3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Kanban</span>
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Buscar pedido..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-accessible"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-primary/10" : ""}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <Card className="card-accessible">
              <CardContent className="pt-4 pb-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="input-accessible">
                        <SelectValue placeholder="Filtrar por status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="aguardando_pagamento">Aguardando</SelectItem>
                        <SelectItem value="em_preparo">Em Preparo</SelectItem>
                        <SelectItem value="pronto">Pronto</SelectItem>
                        <SelectItem value="entregue">Entregue</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Ordenar</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="input-accessible">
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Mais recentes</SelectItem>
                        <SelectItem value="oldest">Mais antigos</SelectItem>
                        <SelectItem value="highest">Maior valor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="card-accessible">
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                Nenhum pedido encontrado
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const status = statusConfig[order.orderStatus];
              const StatusIcon = status.icon;
              const remainingAmount = getRemainingAmount(order);
              const paidAmount = parseFloat(order.paidAmount || "0");
              const hasPartialPayment = paidAmount > 0 && remainingAmount > 0;

              return (
                <Card key={order.id} className="card-accessible overflow-hidden">
                  <CardContent className="p-0">
                    {/* Mobile Layout */}
                    <div className="p-3 sm:p-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base sm:text-lg">
                              #{order.orderNumber}
                            </h3>
                            <span className={`badge ${status.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </span>
                          </div>
                          <p className="font-medium text-sm sm:text-base truncate mt-1">
                            {order.customer.name}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-lg sm:text-xl font-bold text-primary">
                            R$ {parseFloat(order.totalAmount).toFixed(2)}
                          </p>
                          {hasPartialPayment ? (
                            <div className="space-y-1">
                              <Badge variant="secondary" className="text-xs">
                                Pago: R$ {paidAmount.toFixed(2)}
                              </Badge>
                              <Badge variant="destructive" className="text-xs block">
                                Falta: R$ {remainingAmount.toFixed(2)}
                              </Badge>
                            </div>
                          ) : (
                            <Badge 
                              variant={order.paymentStatus === "pago" ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {order.paymentStatus === "pago" ? "Pago" : "Pendente"}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Items Summary */}
                      <div className="text-sm text-muted-foreground mb-2">
                        {order.items?.slice(0, 2).map((item: any, idx: number) => (
                          <span key={idx}>
                            {item.quantity}x {item.productName}
                            {idx < Math.min(order.items.length - 1, 1) && ", "}
                          </span>
                        ))}
                        {order.items && order.items.length > 2 && (
                          <span className="text-primary"> +{order.items.length - 2} mais</span>
                        )}
                      </div>

                      {/* Meta Info */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <Badge variant="secondary" className="text-xs">
                          {paymentLabels[order.paymentMethod]}
                        </Badge>
                        <span>•</span>
                        <span>{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      {order.notes && (
                        <div className="p-2 bg-yellow-50 rounded-lg text-xs mb-3">
                          <strong>Obs:</strong> {order.notes}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {/* Botão Ver Detalhes */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detalhes
                        </Button>

                        {/* Botões de Pagamento */}
                        {order.paymentStatus !== "pago" && order.orderStatus !== "cancelado" && (
                          <>
                            <Button
                              size="sm"
                              className="flex-1 sm:flex-none"
                              onClick={() => handleMarkAsPaid(order.id)}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Pago Total
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 sm:flex-none"
                              onClick={() => openPartialPayment(order)}
                            >
                              <CreditCard className="h-4 w-4 mr-1" />
                              Parcial
                            </Button>
                          </>
                        )}

                        {/* Desfazer Pagamento */}
                        {order.paymentStatus === "pago" && order.orderStatus !== "cancelado" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none text-orange-600 hover:text-orange-700"
                            onClick={() => handleUndoPayment(order.id)}
                          >
                            <Undo2 className="h-4 w-4 mr-1" />
                            Desfazer
                          </Button>
                        )}

                        {/* Botões de Status */}
                        {order.orderStatus === "aguardando_pagamento" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            onClick={() => handleStatusChange(order.id, "em_preparo")}
                          >
                            <ChefHat className="h-4 w-4 mr-1" />
                            Preparar
                          </Button>
                        )}

                        {order.orderStatus === "em_preparo" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none bg-green-50 hover:bg-green-100"
                            onClick={() => handleStatusChange(order.id, "pronto")}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Pronto
                          </Button>
                        )}

                        {order.orderStatus === "pronto" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            onClick={() => handleStatusChange(order.id, "entregue")}
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Entregue
                          </Button>
                        )}

                        {/* Editar */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                          onClick={() => openEditModal(order)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        {/* Cancelar/Excluir */}
                        {order.orderStatus !== "cancelado" && order.orderStatus !== "entregue" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleStatusChange(order.id, "cancelado")}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Excluir permanentemente */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => openDeleteConfirm(order)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

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
                    {parseFloat(selectedOrder.paidAmount || "0") > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Pago</span>
                          <span>R$ {parseFloat(selectedOrder.paidAmount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-red-600 font-medium">
                          <span>Restante</span>
                          <span>R$ {getRemainingAmount(selectedOrder).toFixed(2)}</span>
                        </div>
                      </>
                    )}
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Order Dialog */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="dialog-content sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Editar Pedido #{orderToEdit?.orderNumber}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Método de Pagamento</Label>
                <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                  <SelectTrigger className="input-accessible">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="fiado">Fiado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Observações do pedido..."
                  className="textarea-accessible min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateOrderMutation.isPending}>
                {updateOrderMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Partial Payment Dialog */}
        <Dialog open={showPartialPayment} onOpenChange={setShowPartialPayment}>
          <DialogContent className="dialog-content sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Pagamento Parcial - Pedido #{orderForPartialPayment?.orderNumber}
              </DialogTitle>
            </DialogHeader>
            {orderForPartialPayment && (
              <div className="space-y-4 py-2">
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total do pedido:</span>
                    <span className="font-bold">R$ {parseFloat(orderForPartialPayment.totalAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Já pago:</span>
                    <span>R$ {parseFloat(orderForPartialPayment.paidAmount || "0").toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600 font-medium">
                    <span>Restante:</span>
                    <span>R$ {getRemainingAmount(orderForPartialPayment).toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Valor a pagar agora (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={getRemainingAmount(orderForPartialPayment)}
                    value={partialPaymentAmount}
                    onChange={(e) => setPartialPaymentAmount(e.target.value)}
                    placeholder="0,00"
                    className="input-accessible"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPartialPayment(false)}>
                Cancelar
              </Button>
              <Button onClick={handlePartialPayment} disabled={partialPaymentMutation.isPending}>
                {partialPaymentMutation.isPending ? "Registrando..." : "Registrar Pagamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir permanentemente o pedido #{orderToDelete?.orderNumber}?
                Esta ação não pode ser desfeita e todos os dados do pedido serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteOrderMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
