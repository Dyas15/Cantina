import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { useLocation } from "wouter";
import { 
  Search, 
  AlertCircle, 
  CheckCircle, 
  DollarSign, 
  User, 
  Phone, 
  Calendar, 
  Eye, 
  Package, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Clock, 
  Undo2,
  Plus,
  ShoppingCart,
  Minus
} from "lucide-react";

const paymentLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  fiado: "Fiado",
};

const paymentIcons: Record<string, any> = {
  pix: QrCode,
  dinheiro: Banknote,
  cartao: CreditCard,
  fiado: Clock,
};

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  flavor?: string;
  subtotal: string;
}

export default function AdminDebts() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPaid, setShowPaid] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  
  // Estados para pagamento parcial
  const [showPartialPayment, setShowPartialPayment] = useState(false);
  const [orderForPartialPayment, setOrderForPartialPayment] = useState<any>(null);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState("");

  // Estados para criar pedido rápido (dívida)
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");

  const utils = trpc.useUtils();
  
  // Conecta ao sistema de tempo real
  useRealtimeOrders();

  // Busca todos os pedidos
  const { data: orders, isLoading: ordersLoading } = trpc.order.list.useQuery(
    {},
    {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    }
  );

  // Busca clientes para o select
  const { data: customers } = trpc.customer.list.useQuery();

  // Busca produtos para o pedido rápido
  const { data: products } = trpc.product.listAvailable.useQuery();

  const updatePaymentMutation = trpc.order.updatePaymentStatus.useMutation({
    onSuccess: () => {
      toast.success("Pagamento confirmado!");
      utils.order.list.invalidate();
      utils.customer.list.invalidate();
      utils.debt.list.invalidate();
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
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Mutation para criar pedido rápido
  const createOrderMutation = trpc.order.create.useMutation({
    onSuccess: () => {
      toast.success("Pedido criado com sucesso! Dívida registrada.");
      setShowQuickOrder(false);
      setSelectedCustomerId(null);
      setCart([]);
      setOrderNotes("");
      utils.order.list.invalidate();
      utils.customer.list.invalidate();
      utils.debt.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Filtra pedidos com pagamento pendente (apenas fiado ou todos dependendo do filtro)
  const pendingOrders = orders?.filter(
    (o) => {
      const matchesStatus = showPaid 
        ? true 
        : o.paymentStatus === 'pendente';
      const notCancelled = o.orderStatus !== 'cancelado';
      const matchesPaymentMethod = paymentMethodFilter === 'all' 
        ? true 
        : o.paymentMethod === paymentMethodFilter;
      return matchesStatus && notCancelled && matchesPaymentMethod;
    }
  ) || [];

  // Filtrar por busca
  const filteredOrders = pendingOrders.filter(
    (o) =>
      o.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer.phone.includes(searchQuery) ||
      o.orderNumber.toString().includes(searchQuery)
  );

  // Agrupar pedidos por cliente
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
      const remaining = parseFloat(order.totalAmount) - parseFloat(order.paidAmount || "0");
      acc[order.customerId].totalPending += remaining;
    }
    return acc;
  }, {});

  const totalPending = filteredOrders
    .filter((o) => o.paymentStatus === 'pendente')
    .reduce((sum, o) => {
      const remaining = parseFloat(o.totalAmount) - parseFloat(o.paidAmount || "0");
      return sum + remaining;
    }, 0);

  // Estatísticas por método de pagamento
  const pendingByMethod = orders?.filter(o => o.paymentStatus === 'pendente' && o.orderStatus !== 'cancelado')
    .reduce((acc: Record<string, number>, order) => {
      const remaining = parseFloat(order.totalAmount) - parseFloat(order.paidAmount || "0");
      acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + remaining;
      return acc;
    }, {}) || {};

  const handleMarkAsPaid = (orderId: number) => {
    updatePaymentMutation.mutate({ id: orderId, status: "pago" });
  };

  const handleUndoPayment = (orderId: number) => {
    undoPaymentMutation.mutate({ id: orderId });
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

  // Funções do carrinho para pedido rápido
  const addToCart = (product: any, flavor?: string) => {
    const existingIndex = cart.findIndex(
      (item) => item.productId === product.id && item.flavor === flavor
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].subtotal = (
        newCart[existingIndex].quantity * parseFloat(newCart[existingIndex].unitPrice)
      ).toFixed(2);
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          flavor,
          subtotal: product.price,
        },
      ]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    } else {
      newCart[index].subtotal = (
        newCart[index].quantity * parseFloat(newCart[index].unitPrice)
      ).toFixed(2);
    }
    setCart(newCart);
  };

  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

  const handleCreateQuickOrder = () => {
    if (!selectedCustomerId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    createOrderMutation.mutate({
      customerId: selectedCustomerId,
      items: cart,
      totalAmount: cartTotal.toFixed(2),
      paymentMethod: "fiado",
      notes: orderNotes || undefined,
    });
  };

  const openQuickOrder = () => {
    setSelectedCustomerId(null);
    setCart([]);
    setOrderNotes("");
    setShowQuickOrder(true);
  };

  const isLoading = ordersLoading;

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 text-red-600" />
                Dívidas e Pagamentos
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Gerencie pagamentos pendentes e lance pedidos fiado
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button onClick={openQuickOrder} className="btn-primary">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Lançar Fiado</span>
              </Button>
            </div>
          </div>

          {/* Total Card */}
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-3 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-red-600">Total Pendente</p>
                  <p className="text-lg sm:text-2xl font-bold text-red-700">
                    R$ {totalPending.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-red-600">
                <p>{filteredOrders.filter(o => o.paymentStatus === 'pendente').length} pedidos</p>
              </div>
            </CardContent>
          </Card>

          {/* Stats por método de pagamento */}
          <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
            {Object.entries(paymentLabels).map(([method, label]) => {
              const Icon = paymentIcons[method];
              const amount = pendingByMethod[method] || 0;
              const isActive = paymentMethodFilter === method;
              
              return (
                <Card 
                  key={method}
                  className={`cursor-pointer transition-all ${
                    isActive ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                  } ${amount > 0 ? 'border-orange-200' : ''}`}
                  onClick={() => setPaymentMethodFilter(isActive ? 'all' : method)}
                >
                  <CardContent className="p-3 flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${amount > 0 ? 'bg-orange-100' : 'bg-muted'}`}>
                      <Icon className={`h-4 w-4 ${amount > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground truncate">{label}</p>
                      <p className={`font-bold ${amount > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                        R$ {amount.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Buscar por nome, telefone ou número do pedido..."
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

        {/* Orders List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : Object.keys(ordersByCustomer).length === 0 ? (
          <Card className="card-accessible">
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <p className="text-muted-foreground mb-4">
                {showPaid ? "Nenhum pedido encontrado" : "Nenhum pagamento pendente"}
              </p>
              <Button onClick={openQuickOrder}>
                <Plus className="h-4 w-4 mr-2" />
                Lançar Primeiro Fiado
              </Button>
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
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                            group.totalPending > 0 
                              ? "bg-red-100 text-red-700" 
                              : "bg-green-100 text-green-700"
                          }`}>
                            {group.customer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{group.customer.name}</span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1 ml-12">
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
                      {group.orders.map((order: any) => {
                        const PaymentIcon = paymentIcons[order.paymentMethod];
                        const remaining = getRemainingAmount(order);
                        const paidAmount = parseFloat(order.paidAmount || "0");
                        const hasPartialPayment = paidAmount > 0 && remaining > 0;
                        
                        return (
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
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    <PaymentIcon className="h-3 w-3" />
                                    {paymentLabels[order.paymentMethod]}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                                  </p>
                                </div>
                                {hasPartialPayment && (
                                  <p className="text-xs text-orange-600 mt-1">
                                    Pago parcial: R$ {paidAmount.toFixed(2)} de R$ {parseFloat(order.totalAmount).toFixed(2)}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <p className="text-lg font-bold">
                                  R$ {parseFloat(order.totalAmount).toFixed(2)}
                                </p>
                                <Badge 
                                  variant={order.paymentStatus === "pago" ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {order.paymentStatus === "pago" ? "Pago" : hasPartialPayment ? `Falta R$ ${remaining.toFixed(2)}` : "Pendente"}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedOrder(order)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                              {order.paymentStatus !== "pago" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkAsPaid(order.id)}
                                    disabled={updatePaymentMutation.isPending}
                                  >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Pago
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openPartialPayment(order)}
                                  >
                                    <CreditCard className="h-4 w-4 mr-1" />
                                    Parcial
                                  </Button>
                                </>
                              )}
                              {order.paymentStatus === "pago" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-orange-600"
                                  onClick={() => handleUndoPayment(order.id)}
                                  disabled={undoPaymentMutation.isPending}
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Desfazer
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = paymentIcons[selectedOrder.paymentMethod];
                      return <Icon className="h-4 w-4" />;
                    })()}
                    <span className="font-medium">{paymentLabels[selectedOrder.paymentMethod]}</span>
                  </div>
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

      {/* Quick Order Dialog (Lançar Fiado) */}
      <Dialog open={showQuickOrder} onOpenChange={setShowQuickOrder}>
        <DialogContent className="dialog-content sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Lançar Pedido Fiado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-medium text-blue-800 text-sm">Lançamento Rápido</p>
                <p className="text-sm text-blue-600">
                  Use esta opção para registrar compras fiado sem passar pelo kanban.
                  O pedido será criado e a dívida registrada automaticamente.
                </p>
              </div>
            </div>

            {/* Cliente */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={selectedCustomerId?.toString() || ""}
                onValueChange={(value) => setSelectedCustomerId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{customer.name}</span>
                        <span className="text-muted-foreground">- {customer.phone}</span>
                        {parseFloat(customer.totalDebt) > 0 && (
                          <Badge variant="destructive" className="text-xs ml-2">
                            Deve R$ {parseFloat(customer.totalDebt).toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Produtos */}
            <div>
              <Label className="text-base font-semibold">Produtos *</Label>
              <div className="grid gap-2 mt-2 max-h-48 sm:max-h-60 overflow-y-auto">
                {products?.map((product) => (
                  <div key={product.id} className="border rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-primary font-bold text-sm">
                          R$ {parseFloat(product.price).toFixed(2)}
                        </p>
                      </div>
                      {product.flavors && product.flavors.length > 0 ? (
                        <Select onValueChange={(flavor) => addToCart(product, flavor)}>
                          <SelectTrigger className="w-28 sm:w-36 h-9">
                            <SelectValue placeholder="Sabor" />
                          </SelectTrigger>
                          <SelectContent>
                            {product.flavors.map((flavor: string) => (
                              <SelectItem key={flavor} value={flavor}>
                                {flavor}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Button
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => addToCart(product)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Carrinho */}
            {cart.length > 0 && (
              <div>
                <Label className="text-base font-semibold">Carrinho</Label>
                <div className="space-y-2 mt-2">
                  {cart.map((item, index) => (
                    <div
                      key={`${item.productId}-${item.flavor}`}
                      className="flex items-center justify-between p-2 sm:p-3 bg-muted rounded-xl"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {item.productName}
                          {item.flavor && <span className="text-muted-foreground"> ({item.flavor})</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          R$ {parseFloat(item.unitPrice).toFixed(2)} cada
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(index, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(index, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="border-t pt-3 mt-3 flex justify-between items-center">
                    <span className="font-bold">Total:</span>
                    <span className="text-xl font-bold text-primary">
                      R$ {cartTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Ex: Compra do dia 15/01, anotada no caderno"
                className="min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowQuickOrder(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              className="btn-primary w-full sm:w-auto"
              onClick={handleCreateQuickOrder}
              disabled={cart.length === 0 || !selectedCustomerId || createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? "Criando..." : `Lançar Fiado • R$ ${cartTotal.toFixed(2)}`}
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
    </AdminLayout>
  );
}
