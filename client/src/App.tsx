import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OfflineBanner } from "./components/OfflineBanner";

// Páginas do Cliente
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Cart from "./pages/Cart";
import OrderStatus from "./pages/OrderStatus";
import CustomerHistory from "./pages/CustomerHistory";

// Páginas do Admin
import AdminDashboard from "./pages/admin/Dashboard";
import AdminOrders from "./pages/admin/Orders";
import AdminOrdersKanban from "./pages/admin/OrdersKanban";
import AdminProducts from "./pages/admin/Products";
import AdminCustomers from "./pages/admin/Customers";
import AdminDebts from "./pages/admin/Debts";
import AdminFinancial from "./pages/admin/Financial";
import AdminReports from "./pages/admin/Reports";

function Router() {
  return (
    <Switch>
      {/* Rotas do Cliente */}
      <Route path="/" component={Home} />
      <Route path="/cardapio" component={Menu} />
      <Route path="/carrinho" component={Cart} />
      <Route path="/pedido/:id" component={OrderStatus} />
      <Route path="/historico" component={CustomerHistory} />
      
      {/* Rotas do Admin */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/pedidos" component={AdminOrders} />
      <Route path="/admin/pedidos/kanban" component={AdminOrdersKanban} />
      <Route path="/admin/produtos" component={AdminProducts} />
      <Route path="/admin/clientes" component={AdminCustomers} />
      <Route path="/admin/dividas" component={AdminDebts} />
      <Route path="/admin/financeiro" component={AdminFinancial} />
      <Route path="/admin/relatorios" component={AdminReports} />
      
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <OfflineBanner />
          <Toaster richColors position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
