/**
 * Variáveis de ambiente do sistema
 * Centraliza acesso às variáveis de ambiente
 */

export const ENV = {
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || process.env.FORGE_API_URL || "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || process.env.FORGE_API_KEY || "",
} as const;
