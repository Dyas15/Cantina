import { Request, Response, NextFunction } from "express";

/**
 * Rate limiting simples em memória
 * Para produção, considere usar Redis ou serviço externo
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Limpa entradas expiradas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  keyGenerator?: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator
      ? keyGenerator(req)
      : req.ip || req.socket.remoteAddress || "unknown";

    const now = Date.now();
    const record = store[key];

    if (!record || record.resetTime < now) {
      // Nova janela de tempo
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    if (record.count >= maxRequests) {
      // Limite excedido
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      const retryAfterMinutes = Math.ceil(retryAfter / 60);
      
      res.status(429).json({
        error: "TOO_MANY_REQUESTS",
        code: "TOO_MANY_REQUESTS",
        message: `Muitas tentativas de login. Por favor, aguarde ${retryAfter} segundo${retryAfter > 1 ? 's' : ''} antes de tentar novamente.`,
        retryAfter, // segundos até poder tentar novamente
        retryAfterMinutes, // minutos até poder tentar novamente
        maxRequests, // número máximo de tentativas permitidas
        windowMs, // janela de tempo em milissegundos
      });
      return;
    }

    // Incrementa contador
    record.count++;
    next();
  };
}

// Rate limiters pré-configurados
export const loginRateLimiter = createRateLimiter(
  5, // 5 tentativas
  60 * 1000, // por 1 minuto (ajustado conforme solicitado)
  (req) => {
    // Usa IP + email se disponível (do body)
    try {
      const body = req.body as { email?: string };
      const email = body?.email || "";
      return `login:${req.ip || req.socket.remoteAddress || "unknown"}:${email}`;
    } catch {
      return `login:${req.ip || req.socket.remoteAddress || "unknown"}`;
    }
  }
);

export const apiRateLimiter = createRateLimiter(
  100, // 100 requisições
  60 * 1000, // por minuto
  (req) => `api:${req.ip}`
);
