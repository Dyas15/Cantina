import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  ShoppingCart, 
  Package, 
  Users, 
  AlertCircle, 
  BarChart3,
  Store,
  Wallet,
  Menu,
  X
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: ShoppingCart, label: "Pedidos", path: "/admin/pedidos/kanban" },
  { icon: Package, label: "Produtos", path: "/admin/produtos" },
  { icon: Users, label: "Clientes", path: "/admin/clientes" },
  { icon: AlertCircle, label: "Dívidas", path: "/admin/dividas" },
  { icon: Wallet, label: "Financeiro", path: "/admin/financeiro" },
  { icon: BarChart3, label: "Relatórios", path: "/admin/relatorios" },
];

const SIDEBAR_WIDTH_KEY = "admin-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

// Componente de Login do Admin
function AdminLoginForm() {
  const [, navigate] = useLocation();
  const [isSetup, setIsSetup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const utils = trpc.useUtils();
  
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Login realizado com sucesso!");
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      if (error.data?.code === "TOO_MANY_REQUESTS" || error.message.includes("Muitas tentativas")) {
        toast.error(
          "Muitas tentativas de login. Por favor, aguarde alguns minutos.",
          { duration: 5000 }
        );
      } else {
        toast.error(error.message || "Erro ao fazer login.");
      }
    },
  });
  
  const setupMutation = trpc.auth.setupAdmin.useMutation({
    onSuccess: () => {
      toast.success("Administrador criado com sucesso!");
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSetup) {
      setupMutation.mutate({ name, email, password });
    } else {
      loginMutation.mutate({ email, password });
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen min-h-[100dvh] bg-gradient-to-b from-primary/5 to-background p-4">
      <div className="flex flex-col items-center gap-6 p-6 sm:p-8 max-w-md w-full bg-card rounded-2xl shadow-lg border">
        <div className="bg-primary/10 p-4 rounded-full">
          <Store className="h-12 w-12 sm:h-14 sm:w-14 text-primary" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl sm:text-2xl font-bold">
            {isSetup ? "Criar Administrador" : "Painel Administrativo"}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isSetup 
              ? "Configure o primeiro administrador"
              : "Cantina Salete"
            }
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {isSetup && (
            <div className="space-y-2">
              <Label htmlFor="name" className="label-accessible">Nome</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="input-accessible"
                required
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email" className="label-accessible">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@cantina.com"
              className="input-accessible"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="label-accessible">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-accessible"
              required
            />
          </div>
          
          <Button
            type="submit"
            className="btn-primary w-full"
            disabled={loginMutation.isPending || setupMutation.isPending}
          >
            {loginMutation.isPending || setupMutation.isPending 
              ? "Carregando..." 
              : isSetup ? "Criar Administrador" : "Entrar"
            }
          </Button>
        </form>
        
        <div className="flex flex-col gap-2 w-full">
          {/* <Button
            variant="ghost"
            onClick={() => setIsSetup(!isSetup)}
            className="w-full"
          >
            {isSetup ? "Já tenho conta" : "Criar primeiro administrador"}
          </Button> */}
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="w-full"
          >
            Voltar para o Site
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return <AdminLoginForm />;
  }

  if (user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen min-h-[100dvh] bg-background p-4">
        <div className="flex flex-col items-center gap-6 p-6 max-w-md w-full bg-card rounded-2xl shadow-lg border text-center">
          <div className="bg-destructive/10 p-4 rounded-full">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-xl font-bold">Acesso Restrito</h1>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar o painel administrativo.
            </p>
          </div>
          <Button
            onClick={() => navigate("/")}
            className="btn-primary w-full"
          >
            Voltar para o Site
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <AdminLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </AdminLayoutContent>
    </SidebarProvider>
  );
}

type AdminLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function AdminLayoutContent({
  children,
  setSidebarWidth,
}: AdminLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-14 sm:h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Store className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-semibold tracking-tight truncate text-sm sm:text-base">
                    Cantina Admin
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 sm:h-11 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-5 w-5 ${isActive ? "text-primary" : ""}`}
                      />
                      <span className="text-sm sm:text-base">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-2 sm:p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 sm:gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-xs sm:text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      Administrador
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/")}
                  className="cursor-pointer"
                >
                  <Store className="mr-2 h-4 w-4" />
                  <span>Ver Site</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-12 sm:h-14 items-center justify-between bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground font-medium text-sm sm:text-base">
                {activeMenuItem?.label ?? "Menu"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </SidebarInset>
    </>
  );
}
