import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // Validação rigorosa: usuário deve existir E ser admin
    if (!ctx.user) {
      throw new TRPCError({ 
        code: "UNAUTHORIZED", 
        message: "Autenticação necessária. Por favor, faça login." 
      });
    }

    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ 
        code: "FORBIDDEN", 
        message: NOT_ADMIN_ERR_MSG 
      });
    }

    // Validação adicional: verifica se usuário ainda está ativo
    // (pode ser expandido para verificar se usuário foi desativado)

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
