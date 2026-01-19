import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Helper para criar contexto de admin
function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-test",
      email: "admin@test.com",
      name: "Admin Test",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// Helper para criar contexto público (sem usuário)
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Cantina System - Product Routes", () => {
  it("should list available products (public)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const products = await caller.product.listAvailable();
    expect(Array.isArray(products)).toBe(true);
    // Todos os produtos retornados devem estar disponíveis
    products.forEach(p => {
      expect(p.available).toBe(true);
    });
  });

  it("should list all products (admin)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const products = await caller.product.list();
    expect(Array.isArray(products)).toBe(true);
  });
});

describe("Cantina System - Customer Routes", () => {
  it("should identify customer by phone (create new)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const testPhone = "11999990001";
    const testName = "Cliente Teste Vitest";
    
    const customer = await caller.customer.identify({
      name: testName,
      phone: testPhone,
    });
    
    expect(customer).toBeDefined();
    expect(customer.phone).toBe(testPhone);
    expect(customer.name).toBe(testName);
    expect(customer.id).toBeGreaterThan(0);
  });

  it("should return same customer when phone exists", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const testPhone = "11999990002";
    
    // Criar primeiro
    const customer1 = await caller.customer.identify({
      name: "Cliente Original",
      phone: testPhone,
    });
    
    // Buscar novamente com mesmo telefone
    const customer2 = await caller.customer.identify({
      name: "Outro Nome",
      phone: testPhone,
    });
    
    // Deve retornar o mesmo cliente (mesmo ID)
    expect(customer2.id).toBe(customer1.id);
  });

  it("should list customers (admin only)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const customers = await caller.customer.list();
    expect(Array.isArray(customers)).toBe(true);
  });
});

describe("Cantina System - Order Routes", () => {
  let testCustomerId: number;
  let testOrderId: number;

  beforeAll(async () => {
    // Criar cliente de teste
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const customer = await caller.customer.identify({
      name: "Cliente Pedido Teste",
      phone: "11999990003",
    });
    testCustomerId = customer.id;
  });

  it("should create an order", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.order.create({
      customerId: testCustomerId,
      items: [
        {
          productId: 1,
          productName: "Pastel Teste",
          quantity: 2,
          unitPrice: "8.00",
          subtotal: "16.00",
          flavor: "Queijo",
        },
      ],
      totalAmount: "16.00",
      paymentMethod: "pix",
    });
    
    expect(result).toBeDefined();
    expect(result.orderId).toBeGreaterThan(0);
    
    testOrderId = result.orderId;
  });

  it("should get order by id", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    if (!testOrderId) {
      // Criar um pedido se não existir
      const result = await caller.order.create({
        customerId: testCustomerId,
        items: [
          {
            productId: 1,
            productName: "Pastel",
            quantity: 1,
            unitPrice: "8.00",
            subtotal: "8.00",
          },
        ],
        totalAmount: "8.00",
        paymentMethod: "dinheiro",
      });
      testOrderId = result.orderId;
    }
    
    const order = await caller.order.getById({ id: testOrderId });
    
    expect(order).toBeDefined();
    expect(order?.id).toBe(testOrderId);
    expect(order?.customer).toBeDefined();
    expect(order?.items).toBeDefined();
  });

  it("should list orders (admin)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const orders = await caller.order.list({});
    expect(Array.isArray(orders)).toBe(true);
  });

  it("should update order status (admin)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    // Criar um pedido para testar
    const publicCaller = appRouter.createCaller(createPublicContext());
    const newOrder = await publicCaller.order.create({
      customerId: testCustomerId,
      items: [
        {
          productId: 1,
          productName: "Pastel Status Test",
          quantity: 1,
          unitPrice: "8.00",
          subtotal: "8.00",
        },
      ],
      totalAmount: "8.00",
      paymentMethod: "dinheiro",
    });
    
    // Atualizar status
    const updated = await caller.order.updateStatus({
      id: newOrder.orderId,
      status: "em_preparo",
    });
    
    expect(updated.success).toBe(true);
  });

  it("should create debt when payment is fiado", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.order.create({
      customerId: testCustomerId,
      items: [
        {
          productId: 1,
          productName: "Pastel Fiado",
          quantity: 1,
          unitPrice: "10.00",
          subtotal: "10.00",
        },
      ],
      totalAmount: "10.00",
      paymentMethod: "fiado",
    });
    
    expect(result.orderId).toBeGreaterThan(0);
    
    // Verificar se a dívida foi criada
    const adminCtx = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const debts = await adminCaller.debt.list({});
    
    const orderDebt = debts.find(d => d.orderId === result.orderId);
    expect(orderDebt).toBeDefined();
    expect(parseFloat(orderDebt!.amount)).toBe(10.00);
  });
});

describe("Cantina System - Debt Routes", () => {
  it("should list debts (admin)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const debts = await caller.debt.list({});
    expect(Array.isArray(debts)).toBe(true);
  });

  it("should list only unpaid debts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const debts = await caller.debt.list({ onlyUnpaid: true });
    expect(Array.isArray(debts)).toBe(true);
    debts.forEach(d => {
      expect(d.isPaid).toBe(false);
    });
  });
});

describe("Cantina System - Report Routes", () => {
  it("should get sales report (admin)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const report = await caller.report.sales({
      startDate: today,
      endDate: endOfDay,
    });
    
    expect(report).toBeDefined();
    expect(typeof report.totalSales).toBe("number");
    expect(typeof report.totalReceived).toBe("number");
    expect(typeof report.totalPending).toBe("number");
    expect(typeof report.orderCount).toBe("number");
  });

  it("should get top products report (admin)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const products = await caller.report.topProducts({
      startDate: today,
      endDate: endOfDay,
      limit: 5,
    });
    
    expect(Array.isArray(products)).toBe(true);
  });

  it("should get top debtors (admin)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    
    const debtors = await caller.report.topDebtors({ limit: 5 });
    
    expect(Array.isArray(debtors)).toBe(true);
  });
});
