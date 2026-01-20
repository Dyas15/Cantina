import { eq, and, desc, asc, ilike, sql, gte, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  InsertUser, users, 
  customers, InsertCustomer, Customer,
  products, InsertProduct, Product,
  orders, InsertOrder, Order,
  orderItems, InsertOrderItem, OrderItem,
  debts, InsertDebt, Debt
} from "../drizzle/schema";


let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL);
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USER QUERIES ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // PostgreSQL upsert usando ON CONFLICT
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createAdminUser(email: string, passwordHash: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(users).values({
    openId: `admin_${Date.now()}`,
    email,
    name,
    loginMethod: 'password',
    role: 'admin',
    lastSignedIn: new Date(),
  }).returning({ id: users.id });

  return result[0].id;
}

// ==================== CUSTOMER QUERIES ====================

export async function findOrCreateCustomer(name: string, phone: string): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normaliza o telefone removendo caracteres especiais
  const normalizedPhone = phone.replace(/\D/g, '');
  
  // Busca cliente existente pelo telefone
  const existing = await db.select().from(customers)
    .where(eq(customers.phone, normalizedPhone))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Cria novo cliente
  const result = await db.insert(customers).values({
    name: name.trim(),
    phone: normalizedPhone,
  }).returning();

  return result[0];
}

export async function getCustomerById(id: number): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(customers)
    .where(or(
      ilike(customers.name, `%${query}%`),
      ilike(customers.phone, `%${query}%`)
    ))
    .orderBy(desc(customers.updatedAt))
    .limit(20);
}

export async function getAllCustomers(): Promise<Customer[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function updateCustomerTotals(customerId: number, amountSpent: number, amountDebt: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(customers)
    .set({
      totalSpent: sql`${customers.totalSpent}::numeric + ${amountSpent}`,
      totalDebt: sql`${customers.totalDebt}::numeric + ${amountDebt}`,
    })
    .where(eq(customers.id, customerId));
}

// Função para recalcular o totalDebt de um cliente baseado nas dívidas reais
export async function recalculateCustomerDebt(customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Calcula o total de dívidas não pagas
  const result = await db.select({
    total: sql<string>`COALESCE(SUM(${debts.amount}::numeric), 0)`,
  }).from(debts)
    .where(and(
      eq(debts.customerId, customerId),
      eq(debts.isPaid, false)
    ));

  const totalDebt = Number(result[0]?.total || 0);

  // Atualiza o totalDebt do cliente
  await db.update(customers)
    .set({ totalDebt: totalDebt.toFixed(2) })
    .where(eq(customers.id, customerId));
}

// ==================== PRODUCT QUERIES ====================

export async function createProduct(product: InsertProduct): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(products).values(product).returning({ id: products.id });
  return result[0].id;
}

export async function updateProduct(id: number, product: Partial<InsertProduct>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(products).set(product).where(eq(products.id, id));
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(products).where(eq(products.id, id));
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(products).orderBy(asc(products.category), asc(products.name));
}

export async function getAvailableProducts(): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(products)
    .where(eq(products.available, true))
    .orderBy(asc(products.category), asc(products.name));
}

// ==================== ORDER QUERIES ====================

export async function getNextOrderNumber(): Promise<number> {
  const db = await getDb();
  if (!db) return 1;

  // Pega o maior número de pedido do dia
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db.select({ maxNumber: sql<number>`MAX(${orders.orderNumber})` })
    .from(orders)
    .where(gte(orders.createdAt, today));

  return (result[0]?.maxNumber || 0) + 1;
}

export async function createOrder(order: Omit<InsertOrder, 'orderNumber'>, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verifica se o cliente existe
  const customer = await getCustomerById(order.customerId);
  if (!customer) {
    throw new Error("Cliente não encontrado");
  }

  const orderNumber = await getNextOrderNumber();
  
  // Define o status inicial baseado no método de pagamento
  const result = await db.insert(orders).values({
    ...order,
    orderNumber,
    paymentStatus: 'pendente',
  }).returning({ id: orders.id });
  
  const orderId = result[0].id;

  // Insere os itens do pedido
  if (items.length > 0) {
    await db.insert(orderItems).values(
      items.map(item => ({
        ...item,
        orderId,
      }))
    );
  }

  // Se for fiado, cria a dívida
  if (order.paymentMethod === 'fiado') {
    await db.insert(debts).values({
      customerId: order.customerId,
      orderId,
      amount: order.totalAmount,
    });
    
    // Atualiza total de dívida do cliente
    await updateCustomerTotals(order.customerId, 0, Number(order.totalAmount));
  }

  return orderId;
}

export async function getOrderById(id: number): Promise<(Order & { items: OrderItem[], customer: Customer }) | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const orderResult = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (orderResult.length === 0) return undefined;

  const order = orderResult[0];
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const customer = await getCustomerById(order.customerId);

  return {
    ...order,
    items,
    customer: customer!,
  };
}

export async function getOrdersByCustomer(customerId: number): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt));
}

export async function getAllOrders(filters?: {
  status?: string;
  paymentStatus?: string;
  startDate?: Date;
  endDate?: Date;
  customerId?: number;
}): Promise<(Order & { customer: Customer })[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(orders);
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(orders.orderStatus, filters.status as any));
  }
  if (filters?.paymentStatus) {
    conditions.push(eq(orders.paymentStatus, filters.paymentStatus as any));
  }
  if (filters?.startDate) {
    conditions.push(gte(orders.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(orders.createdAt, filters.endDate));
  }
  if (filters?.customerId) {
    conditions.push(eq(orders.customerId, filters.customerId));
  }

  const orderResults = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(orders.createdAt))
    : await query.orderBy(desc(orders.createdAt));

  // Busca clientes para cada pedido
  const ordersWithCustomers = await Promise.all(
    orderResults.map(async (order) => {
      const customer = await getCustomerById(order.customerId);
      return { ...order, customer: customer! };
    })
  );

  return ordersWithCustomers;
}

export async function updateOrderStatus(id: number, status: Order['orderStatus']): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(orders).set({ orderStatus: status }).where(eq(orders.id, id));
}

// CORREÇÃO DO BUG PRINCIPAL: updatePaymentStatus agora sincroniza com debts e customer.totalDebt
export async function updatePaymentStatus(id: number, status: Order['paymentStatus']): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Busca o pedido atual
  const orderResult = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (orderResult.length === 0) return;

  const order = orderResult[0];
  const previousStatus = order.paymentStatus;

  // Atualiza o status do pedido
  await db.update(orders).set({ paymentStatus: status }).where(eq(orders.id, id));

  // Se o pedido é fiado, sincroniza com a tabela de dívidas
  if (order.paymentMethod === 'fiado') {
    // Busca a dívida correspondente
    const debtResult = await db.select().from(debts)
      .where(eq(debts.orderId, id))
      .limit(1);

    if (debtResult.length > 0) {
      const debt = debtResult[0];

      // Se está marcando como PAGO e a dívida ainda não foi paga
      if (status === 'pago' && !debt.isPaid) {
        await db.update(debts).set({ 
          isPaid: true, 
          paidAt: new Date() 
        }).where(eq(debts.id, debt.id));

        // Atualiza totais do cliente: diminui dívida, aumenta gasto
        await db.update(customers)
          .set({
            totalDebt: sql`GREATEST(${customers.totalDebt}::numeric - ${debt.amount}::numeric, 0)`,
            totalSpent: sql`${customers.totalSpent}::numeric + ${debt.amount}::numeric`,
          })
          .where(eq(customers.id, order.customerId));
      }
      // Se está voltando para PENDENTE e a dívida estava paga
      else if (status === 'pendente' && debt.isPaid) {
        await db.update(debts).set({ 
          isPaid: false, 
          paidAt: null 
        }).where(eq(debts.id, debt.id));

        // Reverte totais do cliente: aumenta dívida, diminui gasto
        await db.update(customers)
          .set({
            totalDebt: sql`${customers.totalDebt}::numeric + ${debt.amount}::numeric`,
            totalSpent: sql`GREATEST(${customers.totalSpent}::numeric - ${debt.amount}::numeric, 0)`,
          })
          .where(eq(customers.id, order.customerId));
      }
    }
  } else {
    // Para outros métodos de pagamento (não fiado)
    // Atualiza totalSpent quando o pagamento é confirmado
    if (status === 'pago' && previousStatus !== 'pago') {
      await db.update(customers)
        .set({
          totalSpent: sql`${customers.totalSpent}::numeric + ${order.totalAmount}::numeric`,
        })
        .where(eq(customers.id, order.customerId));
    }
    // Se está revertendo de pago para pendente, diminui o totalSpent
    else if (status === 'pendente' && previousStatus === 'pago') {
      await db.update(customers)
        .set({
          totalSpent: sql`GREATEST(${customers.totalSpent}::numeric - ${order.totalAmount}::numeric, 0)`,
        })
        .where(eq(customers.id, order.customerId));
    }
  }
}

// ==================== DEBT QUERIES ====================

export async function getDebtsByCustomer(customerId: number): Promise<(Debt & { order: Order })[]> {
  const db = await getDb();
  if (!db) return [];

  const debtResults = await db.select().from(debts)
    .where(eq(debts.customerId, customerId))
    .orderBy(desc(debts.createdAt));

  const debtsWithOrders = await Promise.all(
    debtResults.map(async (debt) => {
      const orderResult = await db.select().from(orders).where(eq(orders.id, debt.orderId)).limit(1);
      return { ...debt, order: orderResult[0] };
    })
  );

  return debtsWithOrders;
}

export async function getAllDebts(onlyUnpaid = true): Promise<(Debt & { customer: Customer, order: Order })[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(debts);
  
  const debtResults = onlyUnpaid
    ? await query.where(eq(debts.isPaid, false)).orderBy(desc(debts.createdAt))
    : await query.orderBy(desc(debts.createdAt));

  const debtsWithDetails = await Promise.all(
    debtResults.map(async (debt) => {
      const customer = await getCustomerById(debt.customerId);
      const orderResult = await db.select().from(orders).where(eq(orders.id, debt.orderId)).limit(1);
      return { ...debt, customer: customer!, order: orderResult[0] };
    })
  );

  return debtsWithDetails;
}

export async function markDebtAsPaid(debtId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const debtResult = await db.select().from(debts).where(eq(debts.id, debtId)).limit(1);
  if (debtResult.length === 0) return;

  const debt = debtResult[0];

  // Só processa se a dívida ainda não foi paga
  if (debt.isPaid) return;

  await db.update(debts).set({ 
    isPaid: true, 
    paidAt: new Date() 
  }).where(eq(debts.id, debtId));

  // Atualiza o status do pagamento do pedido
  await db.update(orders).set({ paymentStatus: 'pago' }).where(eq(orders.id, debt.orderId));

  // Atualiza totais do cliente
  await db.update(customers)
    .set({
      totalDebt: sql`GREATEST(${customers.totalDebt}::numeric - ${debt.amount}::numeric, 0)`,
      totalSpent: sql`${customers.totalSpent}::numeric + ${debt.amount}::numeric`,
    })
    .where(eq(customers.id, debt.customerId));
  
  // Emite evento de atualização (será importado dinamicamente para evitar dependência circular)
  try {
    const { emitPaymentStatusChanged, emitOrderUpdated } = await import("./_core/events");
    emitPaymentStatusChanged(debt.orderId, 'pago');
    const order = await getOrderById(debt.orderId);
    if (order) {
      emitOrderUpdated(debt.orderId, order);
    }
  } catch {
    // Ignora se eventos não estiverem disponíveis
  }
}

// ==================== EXPENSE QUERIES (GESTÃO FINANCEIRA) ====================

export async function createExpense(expense: {
  description: string;
  amount: string;
  category: string;
  date: Date;
  notes?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const notesValue = expense.notes || null;

  // Usando SQL direto já que a tabela pode não existir no schema ainda
  const result = await db.execute(sql`
    INSERT INTO expenses (description, amount, category, date, notes, created_at, updated_at)
    VALUES (${expense.description}, ${expense.amount}, ${expense.category}, ${expense.date}, ${notesValue}, NOW(), NOW())
    RETURNING id
  `);

  return Number((result as any)[0]?.id);
}

export async function getAllExpenses(filters?: {
  startDate?: Date;
  endDate?: Date;
  category?: string;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    let conditions = [];
    
    if (filters?.startDate) {
      conditions.push(sql`date >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`date <= ${filters.endDate}`);
    }
    if (filters?.category) {
      conditions.push(sql`category = ${filters.category}`);
    }

    const whereClause = conditions.length > 0 
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}` 
      : sql``;

    const result = await db.execute(sql`
      SELECT * FROM expenses ${whereClause} ORDER BY date DESC
    `);
    
    return result as any[];
  } catch {
    // Tabela pode não existir ainda
    return [];
  }
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.execute(sql`DELETE FROM expenses WHERE id = ${id}`);
}

export async function getFinancialSummary(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  // Total de vendas (pedidos não cancelados)
  const salesResult = await db.select({
    totalSales: sql<string>`COALESCE(SUM(${orders.totalAmount}::numeric), 0)`,
  }).from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      sql`${orders.orderStatus} != 'cancelado'`
    ));

  // Total recebido (pagos)
  const receivedResult = await db.select({
    totalReceived: sql<string>`COALESCE(SUM(${orders.totalAmount}::numeric), 0)`,
  }).from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      eq(orders.paymentStatus, 'pago')
    ));

  // Total de despesas
  let totalExpenses = 0;
  try {
    const expensesResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total FROM expenses 
      WHERE date >= ${startDate} AND date <= ${endDate}
    `);
    totalExpenses = Number((expensesResult as any)[0]?.total || 0);
  } catch {
    // Tabela pode não existir
  }

  // Total a receber (fiado não pago)
  const pendingResult = await db.select({
    totalPending: sql<string>`COALESCE(SUM(${debts.amount}::numeric), 0)`,
  }).from(debts)
    .where(and(
      gte(debts.createdAt, startDate),
      lte(debts.createdAt, endDate),
      eq(debts.isPaid, false)
    ));

  const totalSales = Number(salesResult[0]?.totalSales || 0);
  const totalReceived = Number(receivedResult[0]?.totalReceived || 0);
  const totalPending = Number(pendingResult[0]?.totalPending || 0);
  const profit = totalReceived - totalExpenses;

  return {
    totalSales,
    orderCount: 0,
    totalReceived,
    totalPending,
    totalExpenses,
    profit,
    profitMargin: totalReceived > 0 ? ((profit / totalReceived) * 100).toFixed(2) : '0.00',
  };
}

// ==================== REPORT QUERIES ====================

export async function getSalesReport(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  // Total vendido
  const totalSales = await db.select({
    total: sql<string>`COALESCE(SUM(${orders.totalAmount}::numeric), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      sql`${orders.orderStatus} != 'cancelado'`
    ));

  // Total recebido (pagos)
  const totalReceived = await db.select({
    total: sql<string>`COALESCE(SUM(${orders.totalAmount}::numeric), 0)`,
  }).from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      eq(orders.paymentStatus, 'pago')
    ));

  // Total a receber (fiado não pago)
  const totalPending = await db.select({
    total: sql<string>`COALESCE(SUM(${debts.amount}::numeric), 0)`,
  }).from(debts)
    .where(and(
      gte(debts.createdAt, startDate),
      lte(debts.createdAt, endDate),
      eq(debts.isPaid, false)
    ));

  return {
    totalSales: Number(totalSales[0]?.total || 0),
    orderCount: Number(totalSales[0]?.count || 0),
    totalReceived: Number(totalReceived[0]?.total || 0),
    totalPending: Number(totalPending[0]?.total || 0),
  };
}

export async function getTopProducts(startDate: Date, endDate: Date, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    productId: orderItems.productId,
    productName: orderItems.productName,
    totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
    totalRevenue: sql<string>`SUM(${orderItems.subtotal}::numeric)`,
  }).from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      sql`${orders.orderStatus} != 'cancelado'`
    ))
    .groupBy(orderItems.productId, orderItems.productName)
    .orderBy(desc(sql`SUM(${orderItems.quantity})`))
    .limit(limit);

  return result;
}

export async function getTopCustomers(startDate: Date, endDate: Date, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    customerId: orders.customerId,
    totalSpent: sql<string>`SUM(${orders.totalAmount}::numeric)`,
    orderCount: sql<number>`COUNT(*)`,
  }).from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      sql`${orders.orderStatus} != 'cancelado'`
    ))
    .groupBy(orders.customerId)
    .orderBy(desc(sql`SUM(${orders.totalAmount}::numeric)`))
    .limit(limit);

  // Busca dados dos clientes
  const customersWithDetails = await Promise.all(
    result.map(async (item) => {
      const customer = await getCustomerById(item.customerId);
      return {
        ...item,
        customer: customer!,
      };
    })
  );

  return customersWithDetails;
}

export async function getTopDebtors(limit = 10) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(customers)
    .where(sql`${customers.totalDebt}::numeric > 0`)
    .orderBy(desc(customers.totalDebt))
    .limit(limit);
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

// Vendas por período (para gráficos)
export async function getSalesByPeriod(startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month' = 'day') {
  const db = await getDb();
  if (!db) return [];

  const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' 
    : groupBy === 'week' ? 'IYYY-IW' 
    : 'YYYY-MM';

  const result = await db.select({
    period: sql<string>`TO_CHAR(${orders.createdAt}, ${dateFormat})`,
    totalSales: sql<string>`COALESCE(SUM(${orders.totalAmount}::numeric), 0)`,
    orderCount: sql<number>`COUNT(*)`,
  }).from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      sql`${orders.orderStatus} != 'cancelado'`
    ))
    .groupBy(sql`TO_CHAR(${orders.createdAt}, ${dateFormat})`)
    .orderBy(sql`TO_CHAR(${orders.createdAt}, ${dateFormat})`);

  return result;
}

// Vendas por método de pagamento
export async function getSalesByPaymentMethod(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    paymentMethod: orders.paymentMethod,
    totalSales: sql<string>`COALESCE(SUM(${orders.totalAmount}::numeric), 0)`,
    orderCount: sql<number>`COUNT(*)`,
  }).from(orders)
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      sql`${orders.orderStatus} != 'cancelado'`
    ))
    .groupBy(orders.paymentMethod);

  return result;
}

// Vendas por categoria de produto
export async function getSalesByCategory(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    category: products.category,
    totalSales: sql<string>`COALESCE(SUM(${orderItems.subtotal}::numeric), 0)`,
    totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
  }).from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      sql`${orders.orderStatus} != 'cancelado'`
    ))
    .groupBy(products.category);

  return result;
}
