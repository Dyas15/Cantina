/**
 * Valida variáveis de ambiente obrigatórias
 * Sistema não inicia se variáveis críticas estiverem faltando
 */

export function validateEnv() {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Variáveis obrigatórias
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL é obrigatória. Configure no arquivo .env");
  }

  // Variáveis com valores padrão inseguros
  const defaultJwtSecret = "cantina-secret-key-change-in-production";
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === defaultJwtSecret) {
    warnings.push(
      "⚠️  JWT_SECRET não configurado ou usando valor padrão. " +
      "Isso é INSEGURO para produção! Gere uma chave aleatória: " +
      "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  // Variáveis opcionais mas recomendadas
  if (!process.env.PIX_KEY) {
    warnings.push(
      "PIX_KEY não configurada. O sistema funcionará, mas QR Code Pix pode não funcionar corretamente."
    );
  }

  // Mostrar erros (bloqueiam inicialização)
  if (errors.length > 0) {
    console.error("\n❌ ERROS DE CONFIGURAÇÃO:\n");
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error("\nPor favor, corrija os erros acima antes de continuar.\n");
    process.exit(1);
  }

  // Mostrar avisos (não bloqueiam, mas são importantes)
  if (warnings.length > 0) {
    console.warn("\n⚠️  AVISOS DE CONFIGURAÇÃO:\n");
    warnings.forEach((warning) => console.warn(`  ${warning}`));
    console.warn("");
    
    if (process.env.NODE_ENV === "production") {
      console.error(
        "❌ Você está em modo PRODUÇÃO com configurações inseguras!\n" +
        "Por favor, corrija os avisos acima antes de continuar.\n"
      );
      process.exit(1);
    }
  }

  console.log("✅ Variáveis de ambiente validadas com sucesso!");
}
