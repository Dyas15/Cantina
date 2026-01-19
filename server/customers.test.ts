import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import type { Request, Response } from "express";

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

describe("Customer Routes", () => {
  describe("identify", () => {
    it("deve criar novo cliente se não existir", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      const customer = await caller.customer.identify({
        name: "Novo Cliente",
        phone: "11777777777",
      });

      expect(customer.id).toBeDefined();
      expect(customer.name).toBe("Novo Cliente");
      expect(customer.phone).toBe("11777777777");
    });

    it("deve recuperar cliente existente pelo telefone", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      // Criar primeiro cliente
      const customer1 = await caller.customer.identify({
        name: "Cliente Original",
        phone: "11666666666",
      });

      // Tentar criar novamente com mesmo telefone
      const customer2 = await caller.customer.identify({
        name: "Nome Diferente",
        phone: "11666666666",
      });

      // Deve retornar o mesmo cliente
      expect(customer2.id).toBe(customer1.id);
      expect(customer2.phone).toBe(customer1.phone);
    });

    it("deve normalizar telefone removendo caracteres especiais", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      const customer1 = await caller.customer.identify({
        name: "Cliente 1",
        phone: "(11) 99999-9999",
      });

      const customer2 = await caller.customer.identify({
        name: "Cliente 2",
        phone: "11999999999",
      });

      // Deve ser o mesmo cliente (telefone normalizado)
      expect(customer1.id).toBe(customer2.id);
    });
  });
});
