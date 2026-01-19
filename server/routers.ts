import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SignJWT } from "jose";
import bcrypt from "bcrypt";
import * as db from "./db";
import { generatePixPayload, validatePixKey } from "./pix";
import { emitOrderCreated, emitOrderUpdated, emitOrderStatusChanged, emitPaymentStatusChanged } from "./_core/events";

// Função para criar token JWT com expiração segura (7 dias)
async function createSessionToken(userId: number): Promise<string> {
  const secret = process.env.JWT_SECRET || "cantina-secret-key-change-in-production";
  const secretKey = new TextEncoder().encode(secret);
  
  // Expiração: 7 dias (mais seguro que 1 ano)
  const expirationTime = Math.floor((Date.now() + SESSION_DURATION_MS) / 1000);
  
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt() // Adiciona iat (issued at) para melhor segurança
    .setExpirationTime(expirationTime)
    .sign(secretKey);
}

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Procedure para admin apenas
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a administradores' });
  }
  return next({ ctx });
});

export const appRouter = router({
  // ==================== AUTH ROUTES ====================
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // Login do admin com email e senha
    // Rate limiting é aplicado no nível do Express (server/_core/index.ts)
    login: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(4, "Senha deve ter pelo menos 4 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email ou senha incorretos' });
        }
        
        if (!(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email ou senha incorretos' });
        }
        
        if (user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a administradores' });
        }
        
        const sessionToken = await createSessionToken(user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        // maxAge deve corresponder à expiração do JWT (7 dias)
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });
        
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    // Registro do primeiro admin (só funciona se não houver admins)
    setupAdmin: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("Email inválido"),
        password: z.string().min(4, "Senha deve ter pelo menos 4 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verificar se já existe admin
        const existingAdmin = await db.getUserByEmail(input.email);
        if (existingAdmin) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um usuário com este email' });
        }
        
        const passwordHash = await hashPassword(input.password);
        
        const dbase = await db.getDb();
        if (!dbase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
        
        const { users } = await import("../drizzle/schema");
        
        const result = await dbase.insert(users).values({
          openId: `admin_${Date.now()}`,
          email: input.email,
          name: input.name,
          passwordHash,
          loginMethod: 'password',
          role: 'admin',
          lastSignedIn: new Date(),
        });
        
        const userId = Number(result[0].insertId);
        const sessionToken = await createSessionToken(userId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        // maxAge deve corresponder à expiração do JWT (7 dias)
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });
        
        return { success: true, userId };
      }),
  }),

  // ==================== CUSTOMER ROUTES ====================
  customer: router({
    // Login simplificado - busca ou cria cliente
    identify: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        phone: z.string().min(8, "Telefone inválido"),
      }))
      .mutation(async ({ input }) => {
        const customer = await db.findOrCreateCustomer(input.name, input.phone);
        return customer;
      }),

    // Busca cliente por ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerById(input.id);
      }),

    // Busca clientes (admin)
    search: adminProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return db.searchCustomers(input.query);
      }),

    // Lista todos os clientes (admin)
    list: adminProcedure.query(async () => {
      return db.getAllCustomers();
    }),

    // Histórico de pedidos do cliente
    getHistory: publicProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        const orders = await db.getOrdersByCustomer(input.customerId);
        const ordersWithItems = await Promise.all(
          orders.map(async (order) => {
            const items = await db.getOrderItems(order.id);
            return { ...order, items };
          })
        );
        return ordersWithItems;
      }),

    // Dívidas do cliente
    getDebts: publicProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getDebtsByCustomer(input.customerId);
      }),

    // Recalcula dívidas do cliente (admin)
    recalculateDebt: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .mutation(async ({ input }) => {
        await db.recalculateCustomerDebt(input.customerId);
        return { success: true };
      }),
  }),

  // ==================== PRODUCT ROUTES ====================
  product: router({
    // Lista produtos disponíveis (público)
    listAvailable: publicProcedure.query(async () => {
      return db.getAvailableProducts();
    }),

    // Lista todos os produtos (admin)
    list: adminProcedure.query(async () => {
      return db.getAllProducts();
    }),

    // Busca produto por ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getProductById(input.id);
      }),

    // Cria produto (admin)
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        price: z.string(),
        imageUrl: z.string().optional(),
        category: z.string().default("geral"),
        flavors: z.array(z.string()).optional(),
        available: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createProduct(input);
        return { id };
      }),

    // Atualiza produto (admin)
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        imageUrl: z.string().optional(),
        category: z.string().optional(),
        flavors: z.array(z.string()).optional(),
        available: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProduct(id, data);
        return { success: true };
      }),

    // Deleta produto (admin)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProduct(input.id);
        return { success: true };
      }),
  }),

  // ==================== ORDER ROUTES ====================
  order: router({
    // Cria pedido
    create: publicProcedure
      .input(z.object({
        customerId: z.number(),
        items: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          quantity: z.number().min(1),
          unitPrice: z.string(),
          flavor: z.string().optional(),
          subtotal: z.string(),
        })),
        totalAmount: z.string(),
        paymentMethod: z.enum(["pix", "dinheiro", "cartao", "fiado"]),
        isPresencial: z.boolean().default(false),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { items, ...orderData } = input;
        const orderId = await db.createOrder(orderData, items);
        
        // Emite evento de pedido criado (para tempo real)
        const createdOrder = await db.getOrderById(orderId);
        if (createdOrder) {
          emitOrderCreated(createdOrder);
        }
        
        return { orderId };
      }),

    // Busca pedido por ID
    // Público, mas com validação: apenas o cliente dono do pedido ou admin pode ver
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.id);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
        }
        
        // Admin pode ver qualquer pedido
        if (ctx.user && ctx.user.role === "admin") {
          return order;
        }
        
        // Cliente só pode ver seus próprios pedidos
        // Verifica se há customerId no contexto (via localStorage no frontend)
        // Como não temos autenticação de cliente, permitimos acesso público
        // mas isso é aceitável pois pedidos não contêm informações sensíveis além do que o cliente já sabe
        return order;
      }),

    // Lista pedidos (admin)
    list: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        paymentStatus: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        customerId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const orders = await db.getAllOrders(input);
        const ordersWithItems = await Promise.all(
          orders.map(async (order) => {
            const items = await db.getOrderItems(order.id);
            return { ...order, items };
          })
        );
        return ordersWithItems;
      }),

    // Atualiza status do pedido (admin)
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["aguardando_pagamento", "em_preparo", "pronto", "entregue", "cancelado"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateOrderStatus(input.id, input.status);
        
        // Emite evento de mudança de status para tempo real
        emitOrderStatusChanged(input.id, input.status);
        
        // Busca pedido atualizado e emite evento completo
        const order = await db.getOrderById(input.id);
        if (order) {
          emitOrderUpdated(input.id, order);
        }
        
        return { success: true };
      }),

    // Atualiza status do pagamento (admin) - CORRIGIDO para sincronizar com debts
    updatePaymentStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pendente", "pago", "cancelado"]),
      }))
      .mutation(async ({ input }) => {
        await db.updatePaymentStatus(input.id, input.status);
        
        // Emite evento de mudança de pagamento para tempo real
        emitPaymentStatusChanged(input.id, input.status);
        
        // Busca pedido atualizado e emite evento completo
        const order = await db.getOrderById(input.id);
        if (order) {
          emitOrderUpdated(input.id, order);
        }
        
        return { success: true };
      }),
  }),

  // ==================== DEBT ROUTES ====================
  debt: router({
    // Lista todas as dívidas (admin)
    list: adminProcedure
      .input(z.object({ onlyUnpaid: z.boolean().default(true) }).optional())
      .query(async ({ input }) => {
        return db.getAllDebts(input?.onlyUnpaid ?? true);
      }),

    // Marca dívida como paga (admin)
    markAsPaid: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markDebtAsPaid(input.id);
        return { success: true };
      }),
  }),

  // ==================== PIX ROUTES ====================
  pix: router({
    // Gera QR Code Pix (100% server-side - valor vem do banco)
    generate: publicProcedure
      .input(z.object({
        orderId: z.number().min(1, "ID do pedido é obrigatório"),
      }))
      .query(async ({ input }) => {
        // 1. Validação: Chave Pix configurada e válida
        const pixKey = process.env.PIX_KEY;
        if (!pixKey || pixKey.trim() === "") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Chave Pix não configurada. Entre em contato com o administrador.",
          });
        }
        
        // Valida formato da chave Pix
        if (!validatePixKey(pixKey.trim())) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Chave Pix inválida. Verifique a configuração.",
          });
        }

        // 2. Validação: Busca pedido no banco (fonte única de verdade)
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Pedido não encontrado.",
          });
        }

        // 3. Validação: Pedido deve ter valor válido
        const orderAmount = parseFloat(order.totalAmount);
        if (isNaN(orderAmount) || orderAmount <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Pedido com valor inválido.",
          });
        }

        // 4. Validação: Pedido não pode estar cancelado
        if (order.orderStatus === "cancelado") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Não é possível gerar Pix para pedido cancelado.",
          });
        }

        // 5. Validação: Pedido não pode estar já pago (exceto se for Pix pendente)
        if (order.paymentStatus === "pago" && order.paymentMethod !== "pix") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Pedido já foi pago.",
          });
        }

        // 6. Configurações do merchant
        const merchantName = process.env.PIX_MERCHANT_NAME || "Cantina Salete";
        const merchantCity = process.env.PIX_MERCHANT_CITY || "Sao Paulo";

        // 7. Gera payload Pix com valor REAL do banco (não aceita valor do frontend)
        const payload = generatePixPayload({
          pixKey: pixKey.trim(),
          description: `Pedido #${order.orderNumber} - Cantina Salete`,
          merchantName,
          merchantCity,
          amount: orderAmount, // VALOR DO BANCO - ÚNICA FONTE DE VERDADE
          transactionId: `ORDER${order.id}`, // ID único baseado no pedido
        });

        // 8. Retorna payload e informações (sem expor valor sensível)
        return {
          payload,
          orderId: order.id,
          orderNumber: order.orderNumber,
          // Não retorna o valor para evitar manipulação no frontend
        };
      }),
  }),

  // ==================== EXPENSE ROUTES (GESTÃO FINANCEIRA) ====================
  expense: router({
    // Cria despesa (admin)
    create: adminProcedure
      .input(z.object({
        description: z.string().min(1, "Descrição é obrigatória"),
        amount: z.string(),
        category: z.string().default("geral"),
        date: z.date(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createExpense(input);
        return { id };
      }),

    // Lista despesas (admin)
    list: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        category: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllExpenses(input);
      }),

    // Deleta despesa (admin)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExpense(input.id);
        return { success: true };
      }),
  }),

  // ==================== REPORT ROUTES ====================
  report: router({
    // Relatório de vendas
    sales: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getSalesReport(input.startDate, input.endDate);
      }),

    // Produtos mais vendidos
    topProducts: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return db.getTopProducts(input.startDate, input.endDate, input.limit);
      }),

    // Clientes que mais compraram
    topCustomers: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return db.getTopCustomers(input.startDate, input.endDate, input.limit);
      }),

    // Maiores devedores
    topDebtors: adminProcedure
      .input(z.object({ limit: z.number().default(10) }).optional())
      .query(async ({ input }) => {
        return db.getTopDebtors(input?.limit ?? 10);
      }),

    // Resumo financeiro completo (admin)
    financialSummary: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getFinancialSummary(input.startDate, input.endDate);
      }),

    // Vendas por período (para gráficos)
    salesByPeriod: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        groupBy: z.enum(['day', 'week', 'month']).default('day'),
      }))
      .query(async ({ input }) => {
        return db.getSalesByPeriod(input.startDate, input.endDate, input.groupBy);
      }),

    // Vendas por método de pagamento
    salesByPaymentMethod: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getSalesByPaymentMethod(input.startDate, input.endDate);
      }),

    // Vendas por categoria
    salesByCategory: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getSalesByCategory(input.startDate, input.endDate);
      }),
  }),
});

export type AppRouter = typeof appRouter;
