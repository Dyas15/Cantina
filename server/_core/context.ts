import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || "cantina-secret-key-change-in-production";
  return new TextEncoder().encode(secret);
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const cookieHeader = opts.req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const sessionCookie = cookies[COOKIE_NAME];
      
      if (sessionCookie) {
        const secretKey = getJwtSecret();
        const { payload } = await jwtVerify(sessionCookie, secretKey, {
          algorithms: ["HS256"],
          // Valida expiração automaticamente
          // Valida iat (issued at) se presente
        });
        
        const userId = payload.userId as number;
        if (userId && typeof userId === "number") {
          // Validação adicional: userId deve ser número válido
          user = await db.getUserById(userId) || null;
          
          // Verifica se usuário ainda existe e está ativo
          if (user && user.role !== "admin") {
            // Se não for admin, não permite acesso (segurança extra)
            user = null;
          }
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
