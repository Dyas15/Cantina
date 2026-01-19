import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import type { Request, Response } from "express";
import * as db from "./db";

// Mock do contexto
function createMockContext(user: any = null) {
  const req = {
    headers: { cookie: "" },
    ip: "127.0.0.1",
  } as unknown as Request;

  const res = {
    cookie: () => {},
    clearCookie: () => {},
  } as unknown as Response;

  return createContext({ req, res }).then((ctx) => ({
    ...ctx,
    user,
  }));
}

function createMockAdmin() {
  return {
    id: 1,
    name: "Admin Teste",
    email: "admin@teste.com",
    role: "admin" as const,
  };
}

describe("Order Routes", () => {
  describe("create", () => {
    it("deve criar um pedido com sucesso", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      // Primeiro criar um cliente
      const customer = await caller.customer.identify({
        name: "Cliente Teste",
        phone: "11999999999",
      });

      // Criar um produto (precisa de admin)
      const adminCtx = await createMockContext(createMockAdmin());
      const adminCaller = appRouter.createCaller(adminCtx);

      const product = await adminCaller.product.create({
        name: "Pastel",
        price: "5.00",
        category: "Salgado",
        available: true,
      });

      // Criar pedido
      const order = await caller.order.create({
        customerId: customer.id,
        items: [
          {
            productId: product.id,
            productName: "Pastel",
            quantity: 2,
            unitPrice: "5.00",
            subtotal: "10.00",
          },
        ],
        totalAmount: "10.00",
        paymentMethod: "pix",
      });

      expect(order.orderId).toBeDefined();
    });

    it("deve criar pedido com fiado e gerar dívida", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      const customer = await caller.customer.identify({
        name: "Cliente Fiado",
        phone: "11888888888",
      });

      const adminCtx = await createMockContext(createMockAdmin());
      const adminCaller = appRouter.createCaller(adminCtx);

      const product = await adminCaller.product.create({
        name: "Refrigerante",
        price: "3.00",
        category: "Bebida",
        available: true,
      });

      const order = await caller.order.create({
        customerId: customer.id,
        items: [
          {
            productId: product.id,
            productName: "Refrigerante",
            quantity: 1,
            unitPrice: "3.00",
            subtotal: "3.00",
          },
        ],
        totalAmount: "3.00",
        paymentMethod: "fiado",
      });

      expect(order.orderId).toBeDefined();

      // Verificar se dívida foi criada
      const debts = await adminCaller.debt.list({ onlyUnpaid: true });
      const customerDebt = debts.find((d) => d.customerId === customer.id);
      expect(customerDebt).toBeDefined();
      expect(parseFloat(customerDebt!.amount)).toBe(3.0);
    });
  });
});
