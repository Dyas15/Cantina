import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { 
  Search, 
  Users, 
  ShoppingCart, 
  Plus, 
  Minus, 
  AlertCircle, 
  Phone, 
  Calendar, 
  DollarSign,
  TrendingUp,
  Wallet,
  Eye,
  User
} from "lucide-react";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  flavor?: string;
  subtotal: string;
}

export default function AdminCustomers() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("dinheiro");

  const utils = trpc.useUtils();

  const { data: customers, isLoading } = trpc.customer.list.useQuery();
  const { data: products } = trpc.product.listAvailable.useQuery();
  const { data: customerDebts } = trpc.customer.getDebts.useQuery(
    { customerId: selectedCustomer?.id || 0 },
    { enabled: !!selectedCustomer }
  );

  const createOrderMutation = trpc.order.create.useMutation({
    onSuccess: () => {
      toast.success("Pedido criado com sucesso!");
      utils.order.list.invalidate();
      utils.customer.list.invalidate();
      closeOrderDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Filtrar clientes
  const filteredCustomers = customers?.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  ) || [];

  // Estatísticas
  const totalCustomers = customers?.length || 0;
  const totalDebtAll = customers?.reduce((sum, c) => sum + parseFloat(c.totalDebt), 0) || 0;
  const totalSpentAll = customers?.reduce((sum, c) => sum + parseFloat(c.totalSpent), 0) || 0;
  const customersWithDebt = customers?.filter((c) => parseFloat(c.totalDebt) > 0).length || 0;

  const openOrderDialog = (customer: any) => {
    setSelectedCustomer(customer);
    setCart([]);
    setPaymentMethod("dinheiro");
    setShowOrderDialog(true);
  };

  const closeOrderDialog = () => {
    setShowOrderDialog(false);
    setSelectedCustomer(null);
    setCart([]);
  };

  const openDetailsDialog = (customer: any) => {
    setSelectedCustomer(customer);
    setShowDetailsDialog(true);
  };

  const closeDetailsDialog = () => {
    setShowDetailsDialog(false);
    setSelectedCustomer(null);
  };

  const addToCart = (product: any, flavor?: string) => {
    const existingIndex = cart.findIndex(
      (item) => item.productId === product.id && item.flavor === flavor
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].subtotal = (
        parseFloat(newCart[existingIndex].unitPrice) * newCart[existingIndex].quantity
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
        parseFloat(newCart[index].unitPrice) * newCart[index].quantity
      ).toFixed(2);
    }
    setCart(newCart);
  };

  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

  const handleCreateOrder = () => {
    if (cart.length === 0) {
      toast.error("Adicione pelo menos um item ao pedido");
      return;
    }

    createOrderMutation.mutate({
      customerId: selectedCustomer.id,
      items: cart,
      totalAmount: cartTotal.toFixed(2),
      paymentMethod: paymentMethod as any,
      isPresencial: true,
    });
  };

  const unpaidDebts = customerDebts?.filter((d) => !d.isPaid) || [];
  const totalDebt = unpaidDebts.reduce((sum, d) => sum + parseFloat(d.amount), 0);

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
            Clientes
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gerencie seus clientes e faça pedidos presenciais
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="card-highlight">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                  <p className="text-xl sm:text-2xl font-bold">{totalCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2.5 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-green-700">Faturado</p>
                  <p className="text-lg sm:text-xl font-bold text-green-700">
                    R$ {totalSpentAll.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2.5 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-red-700">Dívidas</p>
                  <p className="text-lg sm:text-xl font-bold text-red-700">
                    R$ {totalDebtAll.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2.5 rounded-xl">
                  <Wallet className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-orange-700">Devedores</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-700">{customersWithDebt}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="card-accessible">
          <CardContent className="pt-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-accessible"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card className="card-accessible">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCustomers.map((customer) => {
              const hasDebt = parseFloat(customer.totalDebt) > 0;
              
              return (
                <Card 
                  key={customer.id} 
                  className={`card-interactive overflow-hidden transition-all ${
                    hasDebt ? "border-red-200 bg-red-50/30" : ""
                  }`}
                >
                  <CardContent className="p-0">
                    {/* Customer Header */}
                    <div className="p-4 pb-3">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                          hasDebt 
                            ? "bg-red-100 text-red-700" 
                            : "bg-primary/10 text-primary"
                        }`}>
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base truncate">
                            {customer.name}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </p>
                        </div>

                        {/* Debt Badge */}
                        {hasDebt && (
                          <Badge variant="destructive" className="shrink-0">
                            Devedor
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-px bg-border">
                      <div className="bg-card p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Gasto</p>
                        <p className="font-semibold text-green-600">
                          R$ {parseFloat(customer.totalSpent).toFixed(2)}
                        </p>
                      </div>
                      <div className={`p-3 text-center ${hasDebt ? "bg-red-50" : "bg-card"}`}>
                        <p className="text-xs text-muted-foreground">Dívida</p>
                        <p className={`font-semibold ${hasDebt ? "text-red-600" : "text-muted-foreground"}`}>
                          R$ {parseFloat(customer.totalDebt).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-3 bg-muted/30 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openDetailsDialog(customer)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Detalhes
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 btn-primary"
                        onClick={() => openOrderDialog(customer)}
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Novo Pedido
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Customer Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={closeDetailsDialog}>
          <DialogContent className="dialog-content sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <User className="h-5 w-5" />
                Detalhes do Cliente
              </DialogTitle>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-4 py-2">
                {/* Avatar e Nome */}
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                    parseFloat(selectedCustomer.totalDebt) > 0 
                      ? "bg-red-100 text-red-700" 
                      : "bg-primary/10 text-primary"
                  }`}>
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedCustomer.name}</h3>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {selectedCustomer.phone}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-4 rounded-xl text-center">
                    <DollarSign className="h-6 w-6 mx-auto text-green-600 mb-1" />
                    <p className="text-xs text-green-700">Total Gasto</p>
                    <p className="text-xl font-bold text-green-700">
                      R$ {parseFloat(selectedCustomer.totalSpent).toFixed(2)}
                    </p>
                  </div>
                  <div className={`p-4 rounded-xl text-center ${
                    parseFloat(selectedCustomer.totalDebt) > 0 
                      ? "bg-red-50" 
                      : "bg-muted/50"
                  }`}>
                    <AlertCircle className={`h-6 w-6 mx-auto mb-1 ${
                      parseFloat(selectedCustomer.totalDebt) > 0 
                        ? "text-red-600" 
                        : "text-muted-foreground"
                    }`} />
                    <p className={`text-xs ${
                      parseFloat(selectedCustomer.totalDebt) > 0 
                        ? "text-red-700" 
                        : "text-muted-foreground"
                    }`}>Dívida</p>
                    <p className={`text-xl font-bold ${
                      parseFloat(selectedCustomer.totalDebt) > 0 
                        ? "text-red-700" 
                        : "text-muted-foreground"
                    }`}>
                      R$ {parseFloat(selectedCustomer.totalDebt).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Data de Cadastro */}
                <div className="bg-muted/50 p-3 rounded-xl">
                  <p className="text-xs text-muted-foreground">Cliente desde</p>
                  <p className="font-medium">
                    {new Date(selectedCustomer.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter className="flex gap-2 sm:gap-2">
              {selectedCustomer && parseFloat(selectedCustomer.totalDebt) > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    closeDetailsDialog();
                    navigate("/admin/dividas");
                  }}
                >
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Ver Dívidas
                </Button>
              )}
              <Button
                className="btn-primary"
                onClick={() => {
                  closeDetailsDialog();
                  openOrderDialog(selectedCustomer);
                }}
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Novo Pedido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Order Dialog */}
        <Dialog open={showOrderDialog} onOpenChange={closeOrderDialog}>
          <DialogContent className="dialog-content sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">
                Novo Pedido - {selectedCustomer?.name}
              </DialogTitle>
            </DialogHeader>

            {selectedCustomer && (
              <div className="space-y-4 py-2">
                {/* Customer Debt Warning */}
                {totalDebt > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <div>
                      <p className="font-medium text-red-800 text-sm">Cliente com dívida pendente</p>
                      <p className="text-sm text-red-600">
                        Total: R$ {totalDebt.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Products */}
                <div>
                  <Label className="text-base font-semibold">Produtos</Label>
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

                {/* Cart */}
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

                {/* Payment Method */}
                <div>
                  <Label className="text-base font-semibold">Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="input-accessible mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="fiado">Fiado (Pagar Depois)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={closeOrderDialog} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                className="btn-primary w-full sm:w-auto"
                onClick={handleCreateOrder}
                disabled={cart.length === 0 || createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? "Criando..." : `Criar Pedido • R$ ${cartTotal.toFixed(2)}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
