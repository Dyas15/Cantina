import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { 
  ShoppingCart, 
  DollarSign, 
  AlertCircle,
  Clock,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  
  // Conecta ao sistema de tempo real
  const { isConnected } = useRealtimeOrders();

  // Dados do dashboard
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { data: salesReport } = trpc.report.sales.useQuery({
    startDate: today,
    endDate: endOfDay,
  });

  const { data: orders } = trpc.order.list.useQuery({});
  
  // Buscar dívidas pendentes (pedidos com paymentStatus = 'pendente')
  const pendingPaymentOrders = orders?.filter(
    (o) => o.paymentStatus === 'pendente' && o.orderStatus !== 'cancelado'
  ) || [];

  const totalPendingPayment = pendingPaymentOrders.reduce(
    (sum, o) => sum + parseFloat(o.totalAmount), 0
  );

  const pendingOrders = orders?.filter(
    (o) => o.orderStatus !== "entregue" && o.orderStatus !== "cancelado"
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aguardando_pagamento":
        return <span className="badge status-aguardando">Aguardando</span>;
      case "em_preparo":
        return <span className="badge status-preparo">Em Preparo</span>;
      case "pronto":
        return <span className="badge status-pronto">Pronto</span>;
      case "entregue":
        return <span className="badge status-entregue">Entregue</span>;
      case "cancelado":
        return <span className="badge status-cancelado">Cancelado</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Bem-vindo ao painel da Cantina Salete
          </p>
        </div>

        {/* Stats Cards - Grid Responsivo */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Vendas Hoje */}
          <Card className="card-interactive" onClick={() => navigate("/admin/relatorios")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Vendas Hoje
              </CardTitle>
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">
                R$ {(salesReport?.totalSales || 0).toFixed(2)}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {salesReport?.orderCount || 0} pedidos
              </p>
            </CardContent>
          </Card>

          {/* Recebido Hoje */}
          <Card className="card-interactive" onClick={() => navigate("/admin/financeiro")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Recebido
              </CardTitle>
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">
                R$ {(salesReport?.totalReceived || 0).toFixed(2)}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Pagos hoje
              </p>
            </CardContent>
          </Card>

          {/* Pedidos Pendentes */}
          <Card className="card-interactive" onClick={() => navigate("/admin/pedidos/kanban")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Pendentes
              </CardTitle>
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">
                {pendingOrders.length}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Aguardando
              </p>
            </CardContent>
          </Card>

          {/* Total em Dívidas (pagamentos pendentes) */}
          <Card className="card-interactive" onClick={() => navigate("/admin/dividas")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Dívidas
              </CardTitle>
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600">
                R$ {totalPendingPayment.toFixed(2)}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {pendingPaymentOrders.length} pendentes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate("/admin/pedidos/kanban")}
          >
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-xs sm:text-sm">Ver Pedidos</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate("/admin/clientes")}
          >
            <Users className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-xs sm:text-sm">Clientes</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate("/admin/financeiro")}
          >
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-xs sm:text-sm">Financeiro</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => navigate("/admin/relatorios")}
          >
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="text-xs sm:text-sm">Relatórios</span>
          </Button>
        </div>

        {/* Recent Orders */}
        <Card className="card-accessible">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <ShoppingCart className="h-5 w-5" />
                Pedidos Recentes
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/pedidos/kanban")}
                className="text-primary"
              >
                Ver todos
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingOrders.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Nenhum pedido pendente no momento
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {pendingOrders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate("/admin/pedidos/kanban")}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm sm:text-base truncate">
                        #{order.orderNumber} - {order.customer?.name || 'Cliente'}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {order.items?.length || 0} itens • {order.paymentMethod}
                      </p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="font-bold text-primary text-sm sm:text-base">
                        R$ {parseFloat(order.totalAmount).toFixed(2)}
                      </p>
                      <div className="mt-1">
                        {getStatusBadge(order.orderStatus)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
