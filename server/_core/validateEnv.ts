/**
 * Valida variáveis de ambiente obrigatórias
 * Sistema não inicia se variáveis críticas estiverem faltando
 */

export function validateEnv() {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Variáveis obrigatórias
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL é obrigatória. Configure no arquivo .env ou nas variáveis de ambiente do Render");
  }

  // Variáveis obrigatórias em produção
  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET) {
      errors.push(
        "JWT_SECRET é obrigatória em produção. " +
        "Gere uma chave aleatória: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
  } else {
    // Em desenvolvimento, apenas avisa
    if (!process.env.JWT_SECRET) {
      warnings.push(
        "⚠️  JWT_SECRET não configurado. Usando valor padrão para desenvolvimento. " +
        "Isso é INSEGURO para produção!"
      );
    }
  }

  // Variáveis opcionais mas recomendadas
  if (!process.env.PIX_KEY) {
    warnings.push(
      "PIX_KEY não configurada. O QR Code Pix pode não funcionar corretamente."
    );
  }

  // Mostrar erros (bloqueiam inicialização)
  if (errors.length > 0) {
    console.error("\n❌ ERROS DE CONFIGURAÇÃO:\n");
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error("\nPor favor, corrija os erros acima antes de continuar.\n");
    process.exit(1);
  }

  // Mostrar avisos (não bloqueiam em desenvolvimento)
  if (warnings.length > 0) {
    console.warn("\n⚠️  AVISOS DE CONFIGURAÇÃO:\n");
    warnings.forEach((warning) => console.warn(`  ${warning}`));
    console.warn("");
  }

  console.log("✅ Variáveis de ambiente validadas com sucesso!");
}
