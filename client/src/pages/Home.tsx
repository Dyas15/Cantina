import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Store, Phone, User, ArrowRight, Shield, Clock, CreditCard, Utensils } from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Verifica se já tem cliente salvo no localStorage
  useEffect(() => {
    const savedCustomer = localStorage.getItem("cantina_customer");
    if (savedCustomer) {
      navigate("/cardapio");
    }
  }, [navigate]);

  const identifyMutation = trpc.customer.identify.useMutation({
    onSuccess: (customer) => {
      localStorage.setItem("cantina_customer", JSON.stringify(customer));
      toast.success(`Bem-vindo(a), ${customer.name}!`);
      navigate("/cardapio");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao identificar. Tente novamente.");
    },
  });

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Por favor, informe seu nome completo");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Por favor, informe um telefone válido");
      return;
    }
    identifyMutation.mutate({ name: name.trim(), phone });
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-b from-primary/10 via-background to-background">
      {/* Header - Mobile First */}
      <header className="header-main">
        <div className="container">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Store className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">
                  Cantina Salete
                </h1>
                <p className="text-primary-foreground/80 text-sm sm:text-base truncate hidden sm:block">
                  Assembleia de Deus
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/admin")}
              className="gap-2 shrink-0 h-10 sm:h-11 px-3 sm:px-4"
            >
              <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Painel Admin</span>
              <span className="sm:hidden">Admin</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile First */}
      <main className="container py-6 sm:py-8 lg:py-12">
        <div className="max-w-md mx-auto">
          {/* Card Principal */}
          <Card className="card-accessible border-2">
            <CardHeader className="text-center pb-2 sm:pb-4">
              <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                <Utensils className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
              </div>
              <CardTitle className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                Faça seu Pedido
              </CardTitle>
              <CardDescription className="text-base sm:text-lg mt-2 text-muted-foreground">
                Informe seus dados para começar
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-2">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Campo Nome */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="label-accessible flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Seu Nome Completo
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Digite seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-accessible"
                    autoComplete="name"
                    autoCapitalize="words"
                  />
                </div>

                {/* Campo Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="label-accessible flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Seu Telefone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="input-accessible"
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={15}
                  />
                </div>

                {/* Botão Submit */}
                <Button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={identifyMutation.isPending}
                >
                  {identifyMutation.isPending ? (
                    <>
                      <span className="spinner w-5 h-5 border-2" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Ver Cardápio
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>

              {/* Info */}
              <div className="mt-6 pt-5 border-t border-border">
                <p className="text-center text-sm sm:text-base text-muted-foreground">
                  Não precisa de senha! Basta informar seu nome e telefone.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cards de Informação */}
          <div className="grid gap-3 mt-6 sm:mt-8">
            <Card className="card-highlight">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-xl shrink-0">
                  <Utensils className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">Cardápio Completo</h3>
                  <p className="text-sm text-muted-foreground">Pastéis, bebidas e muito mais</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-highlight">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-xl shrink-0">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">Pedido Rápido</h3>
                  <p className="text-sm text-muted-foreground">Faça seu pedido em poucos cliques</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-highlight">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-xl shrink-0">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">Várias Formas de Pagamento</h3>
                  <p className="text-sm text-muted-foreground">Pix, dinheiro, cartão ou fiado</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
