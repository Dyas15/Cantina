import { Router } from "express";
import * as db from "../db";

/**
 * Health check endpoint
 * Retorna status do sistema e do banco de dados
 */
export function createHealthRouter() {
  const router = Router();

  router.get("/health", async (req, res) => {
    try {
      // Verifica conexão com banco
      const database = await db.getDb();
      const dbStatus = database ? "connected" : "disconnected";

      const health = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        database: dbStatus,
        version: "1.0.0",
      };

      // Se banco não estiver conectado, retorna 503
      const statusCode = dbStatus === "connected" ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
