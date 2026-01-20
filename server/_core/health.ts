import { Router } from "express";
import { sql } from "drizzle-orm";
import * as db from "../db";
import { createLogger } from "./logger";

const logger = createLogger('Health');

/**
 * Health check endpoint
 * Retorna status do sistema e do banco de dados
 * Inclui informações de diagnóstico para troubleshooting
 */
export function createHealthRouter() {
  const router = Router();

  router.get("/health", async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Verifica conexão com banco
      const database = await db.getDb();
      let dbStatus = "disconnected";
      let dbLatency: number | null = null;
      let dbError: string | null = null;
      let dbVersion: string | null = null;

      if (database) {
        try {
          const dbStart = Date.now();
          const result = await database.execute(sql`SELECT version() as version`);
          dbLatency = Date.now() - dbStart;
          dbStatus = "connected";
          dbVersion = (result as any)[0]?.version?.split(' ')[0] || null;
        } catch (error) {
          dbStatus = "error";
          dbError = error instanceof Error ? error.message : "Unknown error";
          logger.error('Health check: database query failed', { error: dbError });
        }
      } else {
        dbError = "Database connection not initialized";
        logger.warn('Health check: database not connected');
      }

      const health = {
        status: dbStatus === "connected" ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0",
        database: {
          status: dbStatus,
          latency: dbLatency ? `${dbLatency}ms` : null,
          version: dbVersion,
          error: dbError,
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: "MB",
        },
        responseTime: `${Date.now() - startTime}ms`,
      };

      // Se banco não estiver conectado, retorna 503
      const statusCode = dbStatus === "connected" ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed', undefined, error as Error);
      
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        responseTime: `${Date.now() - startTime}ms`,
      });
    }
  });

  // Endpoint de diagnóstico detalhado (apenas em desenvolvimento ou com query param)
  router.get("/health/debug", async (req, res) => {
    // Só permite em desenvolvimento ou com token de debug
    const debugToken = req.query.token;
    const isAllowed = process.env.NODE_ENV !== "production" || 
                      debugToken === process.env.DEBUG_TOKEN;

    if (!isAllowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const database = await db.getDb();
      
      const debug = {
        timestamp: new Date().toISOString(),
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT,
          LOG_LEVEL: process.env.LOG_LEVEL || "default",
          hasDbUrl: !!process.env.DATABASE_URL,
          hasJwtSecret: !!process.env.JWT_SECRET,
          hasPixKey: !!process.env.PIX_KEY,
        },
        database: {
          connected: !!database,
          urlPattern: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@').replace(/\?.*$/, '?...') || null,
        },
        process: {
          pid: process.pid,
          uptime: Math.floor(process.uptime()),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        memory: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
          unit: "MB",
        },
      };

      logger.info('Debug endpoint accessed', { ip: req.ip });
      res.json(debug);
    } catch (error) {
      logger.error('Debug endpoint failed', undefined, error as Error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  return router;
}
