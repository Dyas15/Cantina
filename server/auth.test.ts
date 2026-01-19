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

describe("Auth Routes", () => {
  beforeEach(async () => {
    // Limpar dados de teste se necessário
  });

  describe("setupAdmin", () => {
    it("deve criar o primeiro administrador", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.setupAdmin({
        name: "Admin Teste",
        email: "admin@teste.com",
        password: "senha123",
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
    });

    it("não deve criar admin duplicado", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      // Primeiro admin
      await caller.auth.setupAdmin({
        name: "Admin 1",
        email: "admin1@teste.com",
        password: "senha123",
      });

      // Tentar criar outro com mesmo email
      await expect(
        caller.auth.setupAdmin({
          name: "Admin 2",
          email: "admin1@teste.com",
          password: "senha123",
        })
      ).rejects.toThrow();
    });
  });

  describe("login", () => {
    it("deve fazer login com credenciais corretas", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      // Criar admin primeiro
      await caller.auth.setupAdmin({
        name: "Admin Login",
        email: "login@teste.com",
        password: "senha123",
      });

      // Fazer login
      const result = await caller.auth.login({
        email: "login@teste.com",
        password: "senha123",
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe("login@teste.com");
    });

    it("não deve fazer login com senha incorreta", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      // Criar admin
      await caller.auth.setupAdmin({
        name: "Admin",
        email: "admin@teste.com",
        password: "senha123",
      });

      // Tentar login com senha errada
      await expect(
        caller.auth.login({
          email: "admin@teste.com",
          password: "senhaerrada",
        })
      ).rejects.toThrow("Email ou senha incorretos");
    });

    it("não deve fazer login com email inexistente", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.login({
          email: "naoexiste@teste.com",
          password: "senha123",
        })
      ).rejects.toThrow("Email ou senha incorretos");
    });
  });

  describe("logout", () => {
    it("deve fazer logout com sucesso", async () => {
      const ctx = await createMockContext(null);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result.success).toBe(true);
    });
  });
});
