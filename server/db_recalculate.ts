// Função para recalcular o totalDebt de um cliente baseado nas dívidas reais
export async function recalculateCustomerDebt(customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('recalculateCustomerDebt', async () => {
    // Calcula o total de dívidas não pagas (fiado)
    const debtResult = await db.select({
      total: sql<string>`COALESCE(SUM(${debts.amount}), 0)`,
    }).from(debts)
      .where(and(
        eq(debts.customerId, customerId),
        eq(debts.isPaid, false)
      ));

    const fiadoDebt = Number(debtResult[0]?.total || 0);

    // Calcula o total de pedidos com pagamento pendente (outros métodos)
    const pendingResult = await db.select({
      total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    }).from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        eq(orders.paymentStatus, 'pendente'),
        sql`${orders.orderStatus} != 'cancelado'`,
        sql`${orders.paymentMethod} != 'fiado'`
      ));

    const pendingPayments = Number(pendingResult[0]?.total || 0);
    const totalDebt = fiadoDebt + pendingPayments;

    // Atualiza o totalDebt do cliente
    await db.update(customers)
      .set({ totalDebt: totalDebt.toFixed(2) })
      .where(eq(customers.id, customerId));
    
    logger.debug('Customer debt recalculated', { customerId, totalDebt, fiadoDebt, pendingPayments });
  }, `recalculate customer debt ${customerId}`);
}
