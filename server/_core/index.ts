import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { validateEnv } from "./validateEnv";
import { createHealthRouter } from "./health";
import { loginRateLimiter, apiRateLimiter } from "./rateLimit";
import { eventEmitter } from "./events";
import { createLogger, logRequest } from "./logger";

const logger = createLogger('Server');

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  logger.info('Iniciando servidor...', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    hasDbUrl: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
  });

  // Valida variáveis de ambiente antes de iniciar
  validateEnv();

  const app = express();
  const server = createServer(app);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Middleware de logging de requisições
  app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      // Não loga health checks para evitar spam
      if (req.path !== '/health') {
        logRequest(req.method, req.path, res.statusCode, duration);
      }
    });
    
    next();
  });
  
  // Health check endpoint (antes de tudo, para monitoramento)
  app.use(createHealthRouter());
  
  // Server-Sent Events para tempo real
  app.get("/api/events", (req, res) => {
    eventEmitter.registerClient(res);
    
    // Envia heartbeat a cada 30 segundos para manter conexão viva
    const heartbeat = setInterval(() => {
      if (res.closed) {
        clearInterval(heartbeat);
        return;
      }
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);
    
    req.on("close", () => {
      clearInterval(heartbeat);
    });
  });
  
  // Rate limiting para API geral (100 req/min)
  app.use("/api/trpc", apiRateLimiter);
  
  // Rate limiting específico para login (5 tentativas / minuto)
  // Aplicado como middleware Express que verifica o body da requisição tRPC
  app.use("/api/trpc", (req, res, next) => {
    // Verifica se é uma requisição de login
    if (req.method === "POST" && req.body) {
      try {
        // tRPC envia requisições em formato batch ou single
        const body = Array.isArray(req.body) ? req.body : [req.body];
        const isLoginRequest = body.some((item: any) => {
          // Formato tRPC: { procedure: "mutation", path: "auth.login", ... }
          return item?.procedure === "mutation" && item?.path === "auth.login";
        });
        
        if (isLoginRequest) {
          // Aplica rate limiting para login
          return loginRateLimiter(req, res, (err?: Error | string) => {
            if (err) {
              // Se rate limit foi excedido, retorna erro adequado
              // O erro já foi enviado na resposta HTTP 429 pelo middleware
              return;
            }
            next();
          });
        }
      } catch {
        // Se houver erro ao verificar, continua normalmente
      }
    }
    next();
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info(`Servidor iniciado com sucesso`, { 
      url: `http://localhost:${port}/`,
      nodeEnv: process.env.NODE_ENV,
    });
  });
}

startServer().catch((error) => {
  logger.error('Falha ao iniciar servidor', undefined, error);
  process.exit(1);
});
