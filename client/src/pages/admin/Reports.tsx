import { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Package,
  AlertCircle,
  Calendar,
  BarChart3
} from "lucide-react";

type Period = "today" | "week" | "month" | "year" | "custom";

export default function AdminReports() {
  const [period, setPeriod] = useState<Period>("today");
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split("T")[0]);

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    switch (period) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "week":
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case "month":
        start.setMonth(now.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case "year":
        start.setFullYear(now.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case "custom":
        const [startYear, startMonth, startDay] = customStartDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = customEndDate.split('-').map(Number);
        start.setFullYear(startYear, startMonth - 1, startDay);
        start.setHours(0, 0, 0, 0);
        end.setFullYear(endYear, endMonth - 1, endDay);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { startDate: start, endDate: end };
  }, [period, customStartDate, customEndDate]);

  const { data: salesReport, isLoading: salesLoading } = trpc.report.sales.useQuery(dateRange);
  const { data: topProducts, isLoading: productsLoading } = trpc.report.topProducts.useQuery({
    ...dateRange,
    limit: 10,
  });
  const { data: topCustomers, isLoading: customersLoading } = trpc.report.topCustomers.useQuery({
    ...dateRange,
    limit: 10,
  });
  const { data: topDebtors, isLoading: debtorsLoading } = trpc.report.topDebtors.useQuery({
    limit: 10,
  });

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              Relatórios
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Análise de vendas e desempenho
            </p>
          </div>

          {/* Period Selector */}
          <Card className="card-accessible">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1 sm:max-w-[200px]">
                  <Label className="text-sm font-medium mb-2 block">Período</Label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                    <SelectTrigger className="input-accessible">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="week">Últimos 7 dias</SelectItem>
                      <SelectItem value="month">Último mês</SelectItem>
                      <SelectItem value="year">Último ano</SelectItem>
                      <SelectItem value="custom">Data Específica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {period === "custom" && (
                  <>
                    <div className="flex-1">
                      <Label className="text-sm font-medium mb-2 block">Data Inicial</Label>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="input-accessible"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-sm font-medium mb-2 block">Data Final</Label>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="input-accessible"
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="card-highlight">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Total Vendido
              </CardTitle>
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              {salesLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">
                    R$ {(salesReport?.totalSales || 0).toFixed(2)}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {salesReport?.orderCount || 0} pedidos
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-green-700">
                Recebido
              </CardTitle>
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
            </CardHeader>
            <CardContent className="pt-0">
              {salesLoading ? (
                <div className="h-8 bg-green-100 animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-700">
                    R$ {(salesReport?.totalReceived || 0).toFixed(2)}
                  </div>
                  <p className="text-xs sm:text-sm text-green-600 mt-1">
                    Confirmados
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-orange-700">
                A Receber
              </CardTitle>
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
            </CardHeader>
            <CardContent className="pt-0">
              {salesLoading ? (
                <div className="h-8 bg-orange-100 animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-700">
                    R$ {(salesReport?.totalPending || 0).toFixed(2)}
                  </div>
                  <p className="text-xs sm:text-sm text-orange-600 mt-1">
                    Pendentes
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                Ticket Médio
              </CardTitle>
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              {salesLoading ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold">
                    R$ {salesReport?.orderCount 
                      ? (salesReport.totalSales / salesReport.orderCount).toFixed(2)
                      : "0.00"}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Por pedido
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Top Products */}
          <Card className="card-accessible">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Package className="h-5 w-5" />
                Produtos Mais Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : topProducts?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma venda no período
                </p>
              ) : (
                <div className="space-y-2">
                  {topProducts?.map((product, index) => (
                    <div
                      key={product.productId}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-gray-100 text-gray-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.totalQuantity} unidades
                        </p>
                      </div>
                      <span className="font-bold text-sm text-primary shrink-0">
                        R$ {parseFloat(product.totalRevenue || "0").toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card className="card-accessible">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Users className="h-5 w-5" />
                Clientes que Mais Compraram
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : topCustomers?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma venda no período
                </p>
              ) : (
                <div className="space-y-2">
                  {topCustomers?.map((item, index) => (
                    <div
                      key={item.customerId}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-gray-100 text-gray-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.orderCount} pedidos
                        </p>
                      </div>
                      <span className="font-bold text-sm text-primary shrink-0">
                        R$ {parseFloat(item.totalSpent || "0").toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Debtors */}
          <Card className="card-accessible lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Maiores Devedores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {debtorsLoading ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : topDebtors?.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <p className="text-muted-foreground">
                    Nenhum devedor
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {topDebtors?.map((customer, index) => (
                    <div
                      key={customer.id}
                      className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-red-100 text-red-700">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.phone}
                        </p>
                      </div>
                      <span className="font-bold text-sm text-red-600 shrink-0">
                        R$ {parseFloat(customer.totalDebt).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
