import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, ArrowLeft, Store, Package, History, X } from "lucide-react";

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

export default function Menu() {
  const [, navigate] = useLocation();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedFlavor, setSelectedFlavor] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [showFlavorDialog, setShowFlavorDialog] = useState(false);
  const [showCartPreview, setShowCartPreview] = useState(false);

  // Carrega cliente do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("cantina_customer");
    if (!saved) {
      navigate("/");
      return;
    }
    setCustomer(JSON.parse(saved));

    // Carrega carrinho salvo
    const savedCart = localStorage.getItem("cantina_cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, [navigate]);

  // Salva carrinho no localStorage
  useEffect(() => {
    localStorage.setItem("cantina_cart", JSON.stringify(cart));
  }, [cart]);

  const { data: products, isLoading } = trpc.product.listAvailable.useQuery();

  const handleAddToCart = (product: any) => {
    if (product.flavors && product.flavors.length > 0) {
      setSelectedProduct(product);
      setSelectedFlavor(product.flavors[0]);
      setQuantity(1);
      setShowFlavorDialog(true);
    } else {
      addItemToCart(product, undefined, 1);
    }
  };

  const addItemToCart = (product: any, flavor: string | undefined, qty: number) => {
    const existingIndex = cart.findIndex(
      (item) => item.productId === product.id && item.flavor === flavor
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += qty;
      newCart[existingIndex].subtotal = (
        parseFloat(newCart[existingIndex].unitPrice) * newCart[existingIndex].quantity
      ).toFixed(2);
      setCart(newCart);
    } else {
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: product.price,
        flavor,
        subtotal: (parseFloat(product.price) * qty).toFixed(2),
      };
      setCart([...cart, newItem]);
    }

    toast.success(`${product.name}${flavor ? ` (${flavor})` : ""} adicionado!`);
    setShowFlavorDialog(false);
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

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Agrupa produtos por categoria
  const productsByCategory = products?.reduce((acc: Record<string, any[]>, product) => {
    const cat = product.category || "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {}) || {};

  if (!customer) return null;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background pb-nav-mobile">
      {/* Header - Mobile First */}
      <header className="header-main">
        <div className="container">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem("cantina_customer");
                localStorage.removeItem("cantina_cart");
                navigate("/");
              }}
              className="text-primary-foreground hover:bg-white/10 gap-1.5 h-10 px-3"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
            
            <div className="flex items-center gap-2 min-w-0">
              <Store className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />
              <span className="font-bold text-base sm:text-lg truncate">Cantina Salete</span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/historico")}
              className="text-primary-foreground hover:bg-white/10 gap-1.5 h-10 px-3"
            >
              <History className="h-5 w-5" />
              <span className="hidden sm:inline">Histórico</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Welcome Banner */}
      <div className="bg-primary/5 py-4 border-b">
        <div className="container">
          <p className="text-base sm:text-lg">
            Olá, <span className="font-semibold">{customer.name}</span>!
          </p>
          <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
            Escolha os produtos que deseja pedir
          </p>
        </div>
      </div>

      {/* Products */}
      <main className="container py-4 sm:py-6">
        {isLoading ? (
          <div className="text-center py-12 sm:py-16">
            <div className="spinner mx-auto" />
            <p className="mt-4 text-muted-foreground">Carregando cardápio...</p>
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <Package className="h-16 w-16 sm:h-20 sm:w-20 mx-auto text-muted-foreground" />
            <p className="mt-4 text-lg sm:text-xl font-semibold">Nenhum produto disponível</p>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">Volte mais tarde</p>
          </div>
        ) : (
          Object.entries(productsByCategory).map(([category, categoryProducts]) => (
            <div key={category} className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-foreground">{category}</h2>
              <div className="grid-products">
                {categoryProducts.map((product: any) => (
                  <Card key={product.id} className="card-interactive overflow-hidden">
                    <CardContent className="p-0">
                      {/* Layout Mobile: Vertical */}
                      <div className="flex flex-col">
                        {product.imageUrl && (
                          <div className="aspect-video w-full shrink-0">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="flex-1 p-3 sm:p-4 flex flex-col">
                          <div className="flex-1 min-h-0">
                            <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-1">
                              {product.name}
                            </h3>
                            {product.description && (
                              <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                                {product.description}
                              </p>
                            )}
                            {product.flavors && product.flavors.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {product.flavors.slice(0, 2).map((flavor: string) => (
                                  <Badge key={flavor} variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                                    {flavor}
                                  </Badge>
                                ))}
                                {product.flavors.length > 2 && (
                                  <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0.5">
                                    +{product.flavors.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Preço e Botão - Layout corrigido para mobile */}
                          <div className="flex flex-col gap-2 mt-3 pt-3 border-t">
                            <span className="text-base sm:text-lg font-bold text-primary">
                              R$ {parseFloat(product.price).toFixed(2)}
                            </span>
                            <Button
                              size="sm"
                              onClick={() => handleAddToCart(product)}
                              className="btn-primary h-9 sm:h-10 w-full text-sm"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Flavor Selection Dialog */}
      <Dialog open={showFlavorDialog} onOpenChange={setShowFlavorDialog}>
        <DialogContent className="dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl">{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="label-accessible mb-3 block">Escolha o sabor:</Label>
            <RadioGroup value={selectedFlavor} onValueChange={setSelectedFlavor} className="space-y-2">
              {selectedProduct?.flavors?.map((flavor: string) => (
                <div key={flavor} className="flex items-center space-x-3 p-3 rounded-xl border hover:bg-accent transition-colors">
                  <RadioGroupItem value={flavor} id={flavor} className="h-5 w-5" />
                  <Label htmlFor={flavor} className="text-base cursor-pointer flex-1">
                    {flavor}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="mt-5">
              <Label className="label-accessible mb-3 block">Quantidade:</Label>
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="btn-icon"
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <span className="text-2xl sm:text-3xl font-bold w-14 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setQuantity(quantity + 1)}
                  className="btn-icon"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="btn-primary w-full"
              onClick={() => addItemToCart(selectedProduct, selectedFlavor, quantity)}
            >
              Adicionar R$ {(parseFloat(selectedProduct?.price || "0") * quantity).toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cart Preview Dialog */}
      <Dialog open={showCartPreview} onOpenChange={setShowCartPreview}>
        <DialogContent className="dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl">Seu Carrinho</DialogTitle>
          </DialogHeader>
          <div className="py-2 max-h-[50vh] overflow-y-auto">
            {cart.map((item, index) => (
              <div key={`${item.productId}-${item.flavor}`} className="flex items-center gap-3 py-3 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.productName}</p>
                  {item.flavor && (
                    <p className="text-sm text-muted-foreground">{item.flavor}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    R$ {parseFloat(item.unitPrice).toFixed(2)} cada
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(index, -1)}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center font-semibold">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateQuantity(index, 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFromCart(index)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold">Total:</span>
              <span className="text-xl font-bold text-primary">R$ {cartTotal.toFixed(2)}</span>
            </div>
            <Button
              className="btn-primary w-full"
              onClick={() => {
                setShowCartPreview(false);
                navigate("/carrinho");
              }}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Finalizar Pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation / Cart Bar */}
      <div className="nav-mobile bg-card border-t-2 border-primary/20 shadow-lg">
        <div className="container py-3">
          {cart.length > 0 ? (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCartPreview(true)}
                className="h-12 px-4 gap-2"
              >
                <div className="bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold">
                  {cartCount}
                </div>
                <span className="font-semibold">R$ {cartTotal.toFixed(2)}</span>
              </Button>
              <Button
                className="btn-primary flex-1 h-12"
                onClick={() => navigate("/carrinho")}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Finalizar Pedido
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => navigate("/historico")}
            >
              <History className="h-5 w-5 mr-2" />
              Ver Pedidos Anteriores
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
