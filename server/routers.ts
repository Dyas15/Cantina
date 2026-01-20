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
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });
        
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),

    // Registro do primeiro admin
    setupAdmin: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("Email inválido"),
        password: z.string().min(4, "Senha deve ter pelo menos 4 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
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
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });
        
        return { success: true, userId };
      }),
  }),

  // ==================== CUSTOMER ROUTES ====================
  customer: router({
    identify: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        phone: z.string().min(8, "Telefone inválido"),
      }))
      .mutation(async ({ input }) => {
        const customer = await db.findOrCreateCustomer(input.name, input.phone);
        return customer;
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerById(input.id);
      }),

    search: adminProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return db.searchCustomers(input.query);
      }),

    list: adminProcedure.query(async () => {
      return db.getAllCustomers();
    }),

    getHistory: publicProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        const orders = await db.getOrdersByCustomer(input.customerId);
        const ordersWithItems = await Promise.all(
          orders.map(async (order) => {
            const items = await db.getOrderItems(order.id);
            const customer = await db.getCustomerById(order.customerId);
            return { 
              ...order, 
              items,
              customer: customer || { id: order.customerId, name: 'Cliente', phone: '' }
            };
          })
        );
        return ordersWithItems;
      }),

    getDebts: publicProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getDebtsByCustomer(input.customerId);
      }),

    recalculateDebt: adminProcedure
      .input(z.object({ customerId: z.number() }))
      .mutation(async ({ input }) => {
        await db.recalculateCustomerDebt(input.customerId);
        return { success: true };
      }),
  }),

  // ==================== PRODUCT ROUTES ====================
  product: router({
    listAvailable: publicProcedure.query(async () => {
      return db.getAvailableProducts();
    }),

    list: adminProcedure.query(async () => {
      return db.getAllProducts();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getProductById(input.id);
      }),

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

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProduct(input.id);
        return { success: true };
      }),
  }),

  // ==================== ORDER ROUTES ====================
  order: router({
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
        
        const createdOrder = await db.getOrderById(orderId);
        if (createdOrder) {
          emitOrderCreated(createdOrder);
        }
        
        return { orderId };
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getOrderById(input.id);
      }),

    list: adminProcedure
      .input(z.object({
        status: z.enum(["aguardando_pagamento", "em_preparo", "pronto", "entregue", "cancelado"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        const orders = await db.getAllOrders(input);
        const ordersWithItems = await Promise.all(
          orders.map(async (order) => {
            const items = await db.getOrderItems(order.id);
            const customer = await db.getCustomerById(order.customerId);
            return { 
              ...order, 
              items,
              customer: customer || { id: order.customerId, name: 'Cliente', phone: '' }
            };
          })
        );
        return ordersWithItems;
      }),

    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["aguardando_pagamento", "em_preparo", "pronto", "entregue", "cancelado"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateOrderStatus(input.id, input.status);
        emitOrderStatusChanged(input.id, input.status);
        
        const updatedOrder = await db.getOrderById(input.id);
        if (updatedOrder) {
          emitOrderUpdated(updatedOrder);
        }
        
        return { success: true };
      }),

    updatePaymentStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pendente", "pago", "cancelado"]),
      }))
      .mutation(async ({ input }) => {
        await db.updatePaymentStatus(input.id, input.status);
        emitPaymentStatusChanged(input.id, input.status);
        
        const updatedOrder = await db.getOrderById(input.id);
        if (updatedOrder) {
          emitOrderUpdated(updatedOrder);
        }
        
        return { success: true };
      }),

    cancel: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.cancelOrder(input.id);
        emitOrderStatusChanged(input.id, "cancelado");
        
        const updatedOrder = await db.getOrderById(input.id);
        if (updatedOrder) {
          emitOrderUpdated(updatedOrder);
        }
        
        return { success: true };
      }),

    generatePix: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido não encontrado' });
        
        const pixKey = process.env.PIX_KEY || "sua-chave-pix@email.com";
        const payload = await generatePixPayload(pixKey, order.customer.name, "Cantina Salete", order.totalAmount);
        
        return {
          payload,
          orderId: order.id,
          orderNumber: order.orderNumber,
        };
      }),
  }),

  // ==================== EXPENSE ROUTES ====================
  expense: router({
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

    list: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        category: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllExpenses(input);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteExpense(input.id);
        return { success: true };
      }),
  }),

  // ==================== REPORT ROUTES ====================
  report: router({
    sales: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getSalesReport(input.startDate, input.endDate);
      }),

    topProducts: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return db.getTopProducts(input.startDate, input.endDate, input.limit);
      }),

    topCustomers: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return db.getTopCustomers(input.startDate, input.endDate, input.limit);
      }),

    topDebtors: adminProcedure
      .input(z.object({ limit: z.number().default(10) }).optional())
      .query(async ({ input }) => {
        return db.getTopDebtors(input?.limit ?? 10);
      }),

    financialSummary: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getFinancialSummary(input.startDate, input.endDate);
      }),

    salesByPeriod: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        groupBy: z.enum(['day', 'week', 'month']).default('day'),
      }))
      .query(async ({ input }) => {
        return db.getSalesByPeriod(input.startDate, input.endDate, input.groupBy);
      }),

    salesByPaymentMethod: adminProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        return db.getSalesByPaymentMethod(input.startDate, input.endDate);
      }),

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
