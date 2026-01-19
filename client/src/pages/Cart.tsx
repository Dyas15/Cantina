import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, Clock, ShoppingBag, Copy, X } from "lucide-react";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  flavor?: string;
  subtotal: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
}

export default function Cart() {
  const [, navigate] = useLocation();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [notes, setNotes] = useState("");
  const [showPixQR, setShowPixQR] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedCustomer = localStorage.getItem("cantina_customer");
    const savedCart = localStorage.getItem("cantina_cart");
    
    if (!savedCustomer) {
      navigate("/");
      return;
    }
    
    setCustomer(JSON.parse(savedCustomer));
    
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      if (parsedCart.length === 0) {
        navigate("/cardapio");
        return;
      }
      setCart(parsedCart);
    } else {
      navigate("/cardapio");
    }
  }, [navigate]);

  useEffect(() => {
    localStorage.setItem("cantina_cart", JSON.stringify(cart));
  }, [cart]);

  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);

  // Gera QR Code Pix APENAS após pedido ser criado (com orderId do banco)
  const { data: pixData, isLoading: pixLoading } = trpc.pix.generate.useQuery(
    {
      orderId: createdOrderId!,
    },
    {
      enabled: showPixQR && paymentMethod === "pix" && createdOrderId !== null,
    }
  );

  // Gera QR Code quando os dados estiverem prontos
  useEffect(() => {
    if (pixData && qrCodeRef.current && !qrCodeRef.current.querySelector("canvas")) {
      import("qrcode").then((QRCode) => {
        QRCode.default.toCanvas(qrCodeRef.current!, pixData.payload, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
      });
    }
  }, [pixData]);

  const createOrderMutation = trpc.order.create.useMutation({
    onSuccess: (data) => {
      if (paymentMethod === "pix") {
        // Para Pix: cria pedido primeiro, depois gera QR Code
        setCreatedOrderId(data.orderId);
        setShowPixQR(true);
      } else {
        // Para dinheiro/cartão/fiado: pedido vai direto para fila
        localStorage.removeItem("cantina_cart");
        const message = paymentMethod === "fiado" 
          ? "Pedido realizado! Pagamento será feito depois."
          : "Pedido realizado! Seu pedido foi enviado para a fila.";
        toast.success(message);
        navigate(`/pedido/${data.orderId}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar pedido");
    },
  });

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
      if (newCart.length === 0) {
        navigate("/cardapio");
        return;
      }
    } else {
      newCart[index].subtotal = (
        parseFloat(newCart[index].unitPrice) * newCart[index].quantity
      ).toFixed(2);
    }
    setCart(newCart);
  };

  const removeItem = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    if (newCart.length === 0) {
      navigate("/cardapio");
      return;
    }
    setCart(newCart);
  };

  const handleSubmit = () => {
    if (!customer) return;
    submitOrder();
  };

  const submitOrder = () => {
    if (!customer) return;

    createOrderMutation.mutate({
      customerId: customer.id,
      items: cart,
      totalAmount: cartTotal.toFixed(2),
      paymentMethod: paymentMethod as any,
      notes: notes || undefined,
    });
  };

  if (!customer) return null;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background pb-nav-mobile">
      {/* Header - Mobile First */}
      <header className="header-main">
        <div className="container">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/cardapio")}
              className="text-primary-foreground hover:bg-white/10 h-10 px-3"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">Seu Carrinho</h1>
          </div>
        </div>
      </header>

      <main className="container py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Cart Items */}
        <Card className="card-accessible">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />
              Itens do Pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.map((item, index) => (
              <div 
                key={`${item.productId}-${item.flavor}`} 
                className="flex items-start gap-3 p-3 sm:p-4 bg-muted/50 rounded-xl border"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg truncate">{item.productName}</h3>
                  {item.flavor && (
                    <p className="text-sm text-muted-foreground mt-0.5">Sabor: {item.flavor}</p>
                  )}
                  <p className="text-primary font-semibold mt-1">
                    R$ {parseFloat(item.unitPrice).toFixed(2)} cada
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => updateQuantity(index, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-bold w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => updateQuantity(index, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    <span className="text-xs">Remover</span>
                  </Button>
                </div>
              </div>
            ))}

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center text-xl sm:text-2xl font-bold">
                <span>Total:</span>
                <span className="text-primary">R$ {cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="card-accessible">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg sm:text-xl">Como Deseja Pagar?</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
              {/* Pix */}
              <div 
                className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  paymentMethod === "pix" ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
                onClick={() => setPaymentMethod("pix")}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="pix" id="pix" className="h-5 w-5" />
                  <Label htmlFor="pix" className="flex items-center gap-3 cursor-pointer flex-1">
                    <QrCode className="h-6 w-6 text-primary shrink-0" />
                    <div>
                      <span className="font-semibold text-base">Pix</span>
                      <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                    </div>
                  </Label>
                </div>
              </div>
              
              {/* Dinheiro */}
              <div 
                className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  paymentMethod === "dinheiro" ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
                onClick={() => setPaymentMethod("dinheiro")}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="dinheiro" id="dinheiro" className="h-5 w-5" />
                  <Label htmlFor="dinheiro" className="flex items-center gap-3 cursor-pointer flex-1">
                    <Banknote className="h-6 w-6 text-green-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-base">Dinheiro</span>
                      <p className="text-sm text-muted-foreground">Pague na retirada</p>
                    </div>
                  </Label>
                </div>
              </div>
              
              {/* Cartão */}
              <div 
                className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  paymentMethod === "cartao" ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
                onClick={() => setPaymentMethod("cartao")}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="cartao" id="cartao" className="h-5 w-5" />
                  <Label htmlFor="cartao" className="flex items-center gap-3 cursor-pointer flex-1">
                    <CreditCard className="h-6 w-6 text-blue-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-base">Cartão</span>
                      <p className="text-sm text-muted-foreground">Crédito ou débito na retirada</p>
                    </div>
                  </Label>
                </div>
              </div>
              
              {/* Fiado */}
              <div 
                className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  paymentMethod === "fiado" ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
                onClick={() => setPaymentMethod("fiado")}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="fiado" id="fiado" className="h-5 w-5" />
                  <Label htmlFor="fiado" className="flex items-center gap-3 cursor-pointer flex-1">
                    <Clock className="h-6 w-6 text-orange-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-base">Pagar Depois</span>
                      <p className="text-sm text-muted-foreground">Pagamento será feito depois</p>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="card-accessible">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg sm:text-xl">Observações</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ex: Sem cebola, bem passado, sem pimenta, etc.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Digite suas observações aqui..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="textarea-accessible"
            />
          </CardContent>
        </Card>
      </main>

      {/* Bottom Bar - Submit Button */}
      <div className="nav-mobile bg-card border-t-2 border-primary/20 shadow-lg">
        <div className="container py-3">
          <Button
            className="btn-primary w-full h-12"
            onClick={handleSubmit}
            disabled={createOrderMutation.isPending}
          >
            {createOrderMutation.isPending ? (
              <>
                <span className="spinner w-5 h-5 border-2 mr-2" />
                Enviando Pedido...
              </>
            ) : (
              `Confirmar Pedido • R$ ${cartTotal.toFixed(2)}`
            )}
          </Button>
        </div>
      </div>

      {/* Pix QR Code Modal */}
      {showPixQR && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <Card className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-scale-in">
            <CardHeader className="relative pb-2">
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 h-8 w-8 p-0"
                onClick={() => setShowPixQR(false)}
              >
                <X className="h-5 w-5" />
              </Button>
              <CardTitle className="text-center text-xl sm:text-2xl font-bold pr-8">
                Pagamento via Pix
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              {pixLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="spinner" />
                  <p className="mt-4 text-muted-foreground">Gerando código de pagamento...</p>
                </div>
              ) : pixData ? (
                <>
                  <div className="bg-white p-4 rounded-xl flex items-center justify-center border-2 border-primary mx-auto w-fit">
                    <div ref={qrCodeRef} className="flex items-center justify-center" />
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="text-sm text-muted-foreground">Pedido #{pixData.orderNumber}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-primary">R$ {cartTotal.toFixed(2)}</p>
                  </div>

                  {/* Botão Copiar Código Pix */}
                  <Button
                    className="w-full btn-secondary h-12"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pixData.payload);
                        toast.success("Código Pix copiado!");
                      } catch (error) {
                        toast.error("Erro ao copiar código");
                      }
                    }}
                  >
                    <Copy className="h-5 w-5 mr-2" />
                    Copiar Código Pix
                  </Button>

                  {/* Código Pix (oculto por padrão) */}
                  <details className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <summary className="text-sm text-blue-900 font-medium cursor-pointer">
                      Ver código completo
                    </summary>
                    <p className="mt-2 font-mono text-xs break-all text-blue-800 bg-white p-2 rounded-lg">
                      {pixData.payload}
                    </p>
                  </details>

                  {/* Mensagem */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <p className="text-base text-green-900 font-semibold mb-1">
                      Pague e aguarde confirmação
                    </p>
                    <p className="text-sm text-green-800">
                      Escaneie o QR Code ou copie o código Pix para pagar.
                    </p>
                  </div>

                  {/* Botão Ver Pedido */}
                  <Button
                    className="btn-primary w-full h-12"
                    onClick={() => {
                      localStorage.removeItem("cantina_cart");
                      toast.success("Pedido realizado!");
                      navigate(`/pedido/${createdOrderId}`);
                    }}
                  >
                    Ver Meu Pedido
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-lg font-medium mb-2">Erro ao gerar código</p>
                  <p className="text-sm text-muted-foreground mb-4">Tente novamente em alguns instantes</p>
                  <Button
                    variant="outline"
                    onClick={() => setShowPixQR(false)}
                  >
                    Fechar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
