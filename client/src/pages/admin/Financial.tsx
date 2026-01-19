import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { 
  Wallet, 
  TrendingUp, 
  Plus, 
  Trash2,
  Calendar,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  ShoppingBag,
  CreditCard,
  Banknote,
  Clock
} from "lucide-react";

const expenseCategories = [
  { value: "ingredientes", label: "Ingredientes" },
  { value: "embalagens", label: "Embalagens" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "manutencao", label: "Manutenção" },
  { value: "limpeza", label: "Limpeza" },
  { value: "outros", label: "Outros" },
];

export default function AdminFinancial() {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month">("today");
  
  // Form state
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("ingredientes");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseNotes, setExpenseNotes] = useState("");

  // Conecta ao sistema de tempo real
  useRealtimeOrders();

  // Calculate date range based on selected period
  const getDateRange = () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    if (selectedPeriod === "week") {
      start.setDate(start.getDate() - 7);
    } else if (selectedPeriod === "month") {
      start.setMonth(start.getMonth() - 1);
    }

    return { startDate: start, endDate: end };
  };

  const { startDate, endDate } = getDateRange();

  const utils = trpc.useUtils();

  // Queries com refetch automático
  const { data: financialSummary, refetch: refetchSummary } = trpc.report.financialSummary.useQuery(
    { startDate, endDate },
    { refetchOnWindowFocus: true, refetchOnReconnect: true }
  );

  const { data: salesByPayment } = trpc.report.salesByPaymentMethod.useQuery(
    { startDate, endDate },
    { refetchOnWindowFocus: true, refetchOnReconnect: true }
  );

  const { data: topProducts } = trpc.report.topProducts.useQuery(
    { startDate, endDate, limit: 5 },
    { refetchOnWindowFocus: true, refetchOnReconnect: true }
  );

  const { data: expenses, refetch: refetchExpenses } = trpc.expense.list.useQuery(
    { startDate, endDate },
    { refetchOnWindowFocus: true, refetchOnReconnect: true }
  );

  // Mutations
  const createExpenseMutation = trpc.expense.create.useMutation({
    onSuccess: () => {
      toast.success("Despesa adicionada com sucesso!");
      setShowAddExpense(false);
      resetForm();
      refetchExpenses();
      refetchSummary();
      utils.expense.list.invalidate();
      utils.report.financialSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar despesa");
    },
  });

  const deleteExpenseMutation = trpc.expense.delete.useMutation({
    onSuccess: () => {
      toast.success("Despesa removida!");
      refetchExpenses();
      refetchSummary();
      utils.expense.list.invalidate();
      utils.report.financialSummary.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao remover despesa");
    },
  });

  const resetForm = () => {
    setExpenseDescription("");
    setExpenseAmount("");
    setExpenseCategory("ingredientes");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setExpenseNotes("");
  };

  const handleAddExpense = () => {
    if (!expenseDescription.trim()) {
      toast.error("Informe a descrição da despesa");
      return;
    }
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    // Cria a data corretamente no fuso horário local
    const [year, month, day] = expenseDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day, 12, 0, 0);

    createExpenseMutation.mutate({
      description: expenseDescription.trim(),
      amount: parseFloat(expenseAmount).toFixed(2),
      category: expenseCategory,
      date: dateObj,
      notes: expenseNotes.trim() || undefined,
    });
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "pix":
        return <CreditCard className="h-4 w-4" />;
      case "dinheiro":
        return <Banknote className="h-4 w-4" />;
      case "cartao":
        return <CreditCard className="h-4 w-4" />;
      case "fiado":
        return <Clock className="h-4 w-4" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0) || 0;

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Wallet className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              Gestão Financeira
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Controle de receitas, despesas e lucros
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedPeriod} onValueChange={(v: any) => setSelectedPeriod(v)}>
              <SelectTrigger className="w-[140px] sm:w-[160px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Última Semana</SelectItem>
                <SelectItem value="month">Último Mês</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowAddExpense(true)} className="btn-primary">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Despesa</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Total Vendas */}
          <Card className="card-highlight">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Total Vendas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                R$ {(financialSummary?.totalSales || 0).toFixed(2)}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {financialSummary?.orderCount || 0} pedidos
              </p>
            </CardContent>
          </Card>

          {/* Recebido */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-green-700 flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Recebido
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-700">
                R$ {(financialSummary?.totalReceived || 0).toFixed(2)}
              </div>
              <p className="text-xs sm:text-sm text-green-600 mt-1">
                Pagamentos confirmados
              </p>
            </CardContent>
          </Card>

          {/* Despesas */}
          <Card className="bg-red-50 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-red-700 flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-700">
                R$ {totalExpenses.toFixed(2)}
              </div>
              <p className="text-xs sm:text-sm text-red-600 mt-1">
                {expenses?.length || 0} registros
              </p>
            </CardContent>
          </Card>

          {/* Lucro */}
          <Card className={`${(financialSummary?.profit || 0) >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-xs sm:text-sm font-medium flex items-center gap-2 ${(financialSummary?.profit || 0) >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                <TrendingUp className="h-4 w-4" />
                Lucro
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${(financialSummary?.profit || 0) >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                R$ {(financialSummary?.profit || 0).toFixed(2)}
              </div>
              <p className={`text-xs sm:text-sm mt-1 ${(financialSummary?.profit || 0) >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                Margem: {financialSummary?.profitMargin || 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Vendas por Método de Pagamento */}
          <Card className="card-accessible">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Vendas por Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesByPayment && salesByPayment.length > 0 ? (
                <div className="space-y-3">
                  {salesByPayment.map((item: any) => {
                    const total = salesByPayment.reduce((sum: number, i: any) => sum + parseFloat(i.totalSales || 0), 0);
                    const percentage = total > 0 ? ((parseFloat(item.totalSales || 0) / total) * 100).toFixed(1) : 0;
                    return (
                      <div key={item.paymentMethod} className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                          {getPaymentIcon(item.paymentMethod)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm capitalize truncate">
                              {item.paymentMethod}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {percentage}%
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="font-semibold text-sm shrink-0">
                          R$ {parseFloat(item.totalSales || 0).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma venda no período
                </p>
              )}
            </CardContent>
          </Card>

          {/* Produtos Mais Vendidos */}
          <Card className="card-accessible">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Produtos Mais Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts && topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((product: any, index: number) => (
                    <div key={product.productId} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
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
                      <span className="font-semibold text-sm text-primary shrink-0">
                        R$ {parseFloat(product.totalRevenue || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum produto vendido no período
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Despesas Recentes */}
        <Card className="card-accessible">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Despesas Recentes
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddExpense(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {expenses && expenses.length > 0 ? (
              <div className="space-y-2">
                {expenses.slice(0, 10).map((expense: any) => (
                  <div 
                    key={expense.id} 
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                  >
                    <div className="bg-red-100 p-2 rounded-lg">
                      <ArrowDownRight className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {expenseCategories.find(c => c.value === expense.category)?.label || expense.category}
                        {" • "}
                        {new Date(expense.date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="font-semibold text-sm text-red-600 shrink-0">
                      - R$ {parseFloat(expense.amount || 0).toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm("Remover esta despesa?")) {
                          deleteExpenseMutation.mutate({ id: expense.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Nenhuma despesa registrada no período
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowAddExpense(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Despesa
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent className="dialog-content sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="label-accessible">Descrição</Label>
              <Input
                placeholder="Ex: Compra de ingredientes"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                className="input-accessible"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="label-accessible">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="input-accessible"
                />
              </div>
              <div className="space-y-2">
                <Label className="label-accessible">Data</Label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="input-accessible"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="label-accessible">Categoria</Label>
              <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                <SelectTrigger className="input-accessible">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="label-accessible">Observações (opcional)</Label>
              <Textarea
                placeholder="Detalhes adicionais..."
                value={expenseNotes}
                onChange={(e) => setExpenseNotes(e.target.value)}
                className="textarea-accessible min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddExpense(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              className="btn-primary"
              onClick={handleAddExpense}
              disabled={createExpenseMutation.isPending}
            >
              {createExpenseMutation.isPending ? "Salvando..." : "Salvar Despesa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
