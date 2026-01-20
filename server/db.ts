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
import { createLogger, logDbConnection, logQuery, logQueryError } from "./_core/logger";

const logger = createLogger('Database');

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

/**
 * Obtém a instância do banco de dados
 * Configura SSL automaticamente para ambientes de produção (Render, Railway, etc.)
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      
      // Log da tentativa de conexão (sem expor credenciais)
      const urlParts = databaseUrl.match(/^postgres(ql)?:\/\/([^:]+):[^@]+@([^:\/]+)/);
      const safeUrl = urlParts ? `postgres://${urlParts[2]}:***@${urlParts[3]}` : 'postgres://***';
      
      logDbConnection('connecting', { 
        url: safeUrl,
        nodeEnv: process.env.NODE_ENV,
        hasSSL: databaseUrl.includes('ssl') || databaseUrl.includes('sslmode')
      });

      // Configuração do cliente postgres
      // Em produção, força SSL se não estiver explicitamente configurado
      const isProduction = process.env.NODE_ENV === 'production';
      const hasSSLInUrl = databaseUrl.includes('ssl') || databaseUrl.includes('sslmode');
      
      const clientOptions: postgres.Options<{}> = {
        // Configurações de conexão
        max: 10, // Máximo de conexões no pool
        idle_timeout: 20, // Timeout de conexão ociosa em segundos
        connect_timeout: 30, // Timeout de conexão em segundos
        
        // Callbacks para logging
        onnotice: (notice) => {
          logger.debug('PostgreSQL Notice', { notice });
        },
        
        // Debug de queries (apenas em desenvolvimento)
        debug: process.env.LOG_LEVEL === 'debug' ? (connection, query, params) => {
          logQuery(query, params as unknown[]);
        } : undefined,
      };

      // Configuração SSL para produção
      // Render, Railway, Supabase e outros provedores geralmente requerem SSL
      if (isProduction && !hasSSLInUrl) {
        logger.info('Produção detectada: habilitando SSL para conexão com banco de dados');
        (clientOptions as any).ssl = { rejectUnauthorized: false };
      }

      _client = postgres(databaseUrl, clientOptions);
      _db = drizzle(_client);
      
      // Testa a conexão
      try {
        await _db.execute(sql`SELECT 1 as test`);
        logDbConnection('connected', { 
          url: safeUrl,
          ssl: isProduction && !hasSSLInUrl ? 'enabled (auto)' : 'from url'
        });
      } catch (testError) {
        logger.error('Teste de conexão falhou', { url: safeUrl }, testError as Error);
        throw testError;
      }
      
    } catch (error) {
      logDbConnection('error', { 
        error: (error as Error).message,
        code: (error as any).code,
        detail: (error as any).detail
      });
      logger.error('Falha ao conectar ao banco de dados', undefined, error as Error);
      _db = null;
      _client = null;
    }
  }
  return _db;
}

/**
 * Wrapper para executar queries com logging de erros
 */
async function executeWithLogging<T>(
  operation: string,
  queryFn: () => Promise<T>,
  queryDescription?: string
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    logger.debug(`${operation} concluído`, { duration: `${duration}ms`, query: queryDescription });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`${operation} falhou`, { 
      duration: `${duration}ms`, 
      query: queryDescription,
      errorCode: (error as any).code,
      errorDetail: (error as any).detail,
      errorHint: (error as any).hint
    }, error as Error);
    throw error;
  }
}

// ==================== USER QUERIES ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn("Cannot upsert user: database not available");
    return;
  }

  return executeWithLogging('upsertUser', async () => {
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

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  }, `upsert user ${user.openId}`);
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("Cannot get user: database not available");
    return undefined;
  }

  return executeWithLogging('getUserByOpenId', async () => {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, `get user by openId ${openId}`);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    logger.warn("Cannot get user: database not available");
    return undefined;
  }

  return executeWithLogging('getUserById', async () => {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, `get user by id ${id}`);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("Cannot get user: database not available");
    return undefined;
  }

  return executeWithLogging('getUserByEmail', async () => {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }, `get user by email ${email}`);
}

export async function createAdminUser(email: string, passwordHash: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return executeWithLogging('createAdminUser', async () => {
    const result = await db.insert(users).values({
      openId: `admin_${Date.now()}`,
      email,
      name,
      loginMethod: 'password',
      role: 'admin',
      lastSignedIn: new Date(),
    }).returning({ id: users.id });

    logger.info('Admin user created', { email, id: result[0].id });
    return result[0].id;
  }, `create admin user ${email}`);
}

// ==================== CUSTOMER QUERIES ====================

export async function findOrCreateCustomer(name: string, phone: string): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normaliza o telefone removendo caracteres especiais
  const normalizedPhone = phone.replace(/\D/g, '');
  
  logger.debug('findOrCreateCustomer', { name, phone, normalizedPhone });

  return executeWithLogging('findOrCreateCustomer', async () => {
    // Busca cliente existente pelo telefone
    const existing = await db.select().from(customers)
      .where(eq(customers.phone, normalizedPhone))
      .limit(1);

    if (existing.length > 0) {
      logger.debug('Customer found', { id: existing[0].id, name: existing[0].name });
      return existing[0];
    }

    // Cria novo cliente
    const result = await db.insert(customers).values({
      name: name.trim(),
      phone: normalizedPhone,
    }).returning();

    logger.info('New customer created', { id: result[0].id, name: result[0].name, phone: normalizedPhone });
    return result[0];
  }, `find or create customer ${normalizedPhone}`);
}

export async function getCustomerById(id: number): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  return executeWithLogging('getCustomerById', async () => {
    const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    return result[0];
  }, `get customer by id ${id}`);
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('searchCustomers', async () => {
    return db.select().from(customers)
      .where(or(
        ilike(customers.name, `%${query}%`),
        ilike(customers.phone, `%${query}%`)
      ))
      .orderBy(desc(customers.updatedAt))
      .limit(20);
  }, `search customers ${query}`);
}

export async function getAllCustomers(): Promise<Customer[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getAllCustomers', async () => {
    return db.select().from(customers).orderBy(desc(customers.createdAt));
  }, 'get all customers');
}

export async function updateCustomerTotals(customerId: number, amountSpent: number, amountDebt: number) {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('updateCustomerTotals', async () => {
    await db.update(customers)
      .set({
        totalSpent: sql`${customers.totalSpent}::numeric + ${amountSpent}`,
        totalDebt: sql`${customers.totalDebt}::numeric + ${amountDebt}`,
      })
      .where(eq(customers.id, customerId));
  }, `update customer totals ${customerId}`);
}

// Função para recalcular o totalDebt de um cliente baseado nas dívidas reais
export async function recalculateCustomerDebt(customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('recalculateCustomerDebt', async () => {
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
    
    logger.debug('Customer debt recalculated', { customerId, totalDebt });
  }, `recalculate customer debt ${customerId}`);
}

// ==================== PRODUCT QUERIES ====================

export async function createProduct(product: InsertProduct): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return executeWithLogging('createProduct', async () => {
    const result = await db.insert(products).values(product).returning({ id: products.id });
    logger.info('Product created', { id: result[0].id, name: product.name });
    return result[0].id;
  }, `create product ${product.name}`);
}

export async function updateProduct(id: number, product: Partial<InsertProduct>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('updateProduct', async () => {
    await db.update(products).set(product).where(eq(products.id, id));
    logger.info('Product updated', { id, changes: Object.keys(product) });
  }, `update product ${id}`);
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('deleteProduct', async () => {
    await db.delete(products).where(eq(products.id, id));
    logger.info('Product deleted', { id });
  }, `delete product ${id}`);
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  return executeWithLogging('getProductById', async () => {
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return result[0];
  }, `get product by id ${id}`);
}

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getAllProducts', async () => {
    return db.select().from(products).orderBy(asc(products.category), asc(products.name));
  }, 'get all products');
}

export async function getAvailableProducts(): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getAvailableProducts', async () => {
    return db.select().from(products)
      .where(eq(products.available, true))
      .orderBy(asc(products.category), asc(products.name));
  }, 'get available products');
}

// ==================== ORDER QUERIES ====================

export async function getNextOrderNumber(): Promise<number> {
  const db = await getDb();
  if (!db) return 1;

  return executeWithLogging('getNextOrderNumber', async () => {
    // Pega o maior número de pedido do dia
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await db.select({ maxNumber: sql<number>`MAX(${orders.orderNumber})` })
      .from(orders)
      .where(gte(orders.createdAt, today));

    return (result[0]?.maxNumber || 0) + 1;
  }, 'get next order number');
}

export async function createOrder(order: Omit<InsertOrder, 'orderNumber'>, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return executeWithLogging('createOrder', async () => {
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

    logger.info('Order created', { 
      orderId, 
      orderNumber, 
      customerId: order.customerId, 
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      itemCount: items.length
    });

    return orderId;
  }, `create order for customer ${order.customerId}`);
}

export async function getOrderById(id: number): Promise<(Order & { items: OrderItem[], customer: Customer }) | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  return executeWithLogging('getOrderById', async () => {
    const orderResult = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (orderResult.length === 0) return undefined;

    const order = orderResult[0];
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const customer = await getCustomerById(order.customerId);

    return { ...order, items, customer: customer! };
  }, `get order by id ${id}`);
}

export async function getOrdersByCustomer(customerId: number): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getOrdersByCustomer', async () => {
    return db.select().from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));
  }, `get orders by customer ${customerId}`);
}

export async function getAllOrders(filters?: {
  startDate?: Date;
  endDate?: Date;
  customerId?: number;
}): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getAllOrders', async () => {
    let query = db.select().from(orders);
    const conditions = [];

    if (filters?.startDate) {
      conditions.push(gte(orders.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(orders.createdAt, filters.endDate));
    }
    if (filters?.customerId) {
      conditions.push(eq(orders.customerId, filters.customerId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(desc(orders.createdAt));
  }, `get all orders`);
}

export async function getTodayOrders(): Promise<(Order & { customer: Customer })[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getTodayOrders', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orderResults = await db.select().from(orders)
      .where(gte(orders.createdAt, today))
      .orderBy(desc(orders.createdAt));

    const ordersWithCustomers = await Promise.all(
      orderResults.map(async (order) => {
        const customer = await getCustomerById(order.customerId);
        return { ...order, customer: customer! };
      })
    );

    return ordersWithCustomers;
  }, 'get today orders');
}

export async function getPendingOrders(): Promise<(Order & { customer: Customer, items: OrderItem[] })[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getPendingOrders', async () => {
    const orderResults = await db.select().from(orders)
      .where(and(
        or(
          eq(orders.orderStatus, 'pendente'),
          eq(orders.orderStatus, 'preparando')
        ),
        sql`${orders.orderStatus} != 'cancelado'`
      ))
      .orderBy(asc(orders.createdAt));

    const ordersWithDetails = await Promise.all(
      orderResults.map(async (order) => {
        const customer = await getCustomerById(order.customerId);
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        return { ...order, customer: customer!, items };
      })
    );

    return ordersWithDetails;
  }, 'get pending orders');
}

export async function updateOrderStatus(orderId: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('updateOrderStatus', async () => {
    await db.update(orders).set({ orderStatus: status }).where(eq(orders.id, orderId));
    logger.info('Order status updated', { orderId, status });
  }, `update order status ${orderId} to ${status}`);
}

export async function updatePaymentStatus(orderId: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('updatePaymentStatus', async () => {
    await db.update(orders).set({ paymentStatus: status }).where(eq(orders.id, orderId));
    logger.info('Payment status updated', { orderId, status });
  }, `update payment status ${orderId} to ${status}`);
}

export async function cancelOrder(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('cancelOrder', async () => {
    const order = await getOrderById(orderId);
    if (!order) return;

    // Cancela o pedido
    await db.update(orders).set({ orderStatus: 'cancelado' }).where(eq(orders.id, orderId));

    // Se tinha dívida, remove
    if (order.paymentMethod === 'fiado') {
      const debtResult = await db.select().from(debts).where(eq(debts.orderId, orderId)).limit(1);
      if (debtResult.length > 0 && !debtResult[0].isPaid) {
        await db.delete(debts).where(eq(debts.orderId, orderId));
        await updateCustomerTotals(order.customerId, 0, -Number(order.totalAmount));
      }
    }

    logger.info('Order cancelled', { orderId });
  }, `cancel order ${orderId}`);
}

// ==================== DEBT QUERIES ====================

export async function getDebtsByCustomer(customerId: number): Promise<(Debt & { order: Order })[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getDebtsByCustomer', async () => {
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
  }, `get debts by customer ${customerId}`);
}

export async function getAllDebts(onlyUnpaid = true): Promise<(Debt & { customer: Customer, order: Order })[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getAllDebts', async () => {
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
  }, `get all debts (onlyUnpaid: ${onlyUnpaid})`);
}

export async function markDebtAsPaid(debtId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('markDebtAsPaid', async () => {
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
    
    logger.info('Debt marked as paid', { debtId, orderId: debt.orderId, customerId: debt.customerId });
    
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
  }, `mark debt as paid ${debtId}`);
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

  return executeWithLogging('createExpense', async () => {
    const notesValue = expense.notes || null;

    // Usando SQL direto já que a tabela pode não existir no schema ainda
    const result = await db.execute(sql`
      INSERT INTO expenses (description, amount, category, date, notes, created_at, updated_at)
      VALUES (${expense.description}, ${expense.amount}, ${expense.category}, ${expense.date}, ${notesValue}, NOW(), NOW())
      RETURNING id
    `);

    const id = Number((result as any)[0]?.id);
    logger.info('Expense created', { id, description: expense.description, amount: expense.amount });
    return id;
  }, `create expense ${expense.description}`);
}

export async function getAllExpenses(filters?: {
  startDate?: Date;
  endDate?: Date;
  category?: string;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getAllExpenses', async () => {
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
  }, 'get all expenses');
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('deleteExpense', async () => {
    await db.execute(sql`DELETE FROM expenses WHERE id = ${id}`);
    logger.info('Expense deleted', { id });
  }, `delete expense ${id}`);
}

export async function getFinancialSummary(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  return executeWithLogging('getFinancialSummary', async () => {
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
  }, `get financial summary ${startDate.toISOString()} to ${endDate.toISOString()}`);
}

// ==================== REPORT QUERIES ====================

export async function getSalesReport(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  return executeWithLogging('getSalesReport', async () => {
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
  }, `get sales report ${startDate.toISOString()} to ${endDate.toISOString()}`);
}

export async function getTopProducts(startDate: Date, endDate: Date, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getTopProducts', async () => {
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
  }, `get top products ${startDate.toISOString()} to ${endDate.toISOString()}`);
}

export async function getTopCustomers(startDate: Date, endDate: Date, limit = 10) {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getTopCustomers', async () => {
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
  }, `get top customers ${startDate.toISOString()} to ${endDate.toISOString()}`);
}

export async function getTopDebtors(limit = 10) {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getTopDebtors', async () => {
    return db.select().from(customers)
      .where(sql`${customers.totalDebt}::numeric > 0`)
      .orderBy(desc(customers.totalDebt))
      .limit(limit);
  }, `get top debtors limit ${limit}`);
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getOrderItems', async () => {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }, `get order items ${orderId}`);
}

// Vendas por período (para gráficos)
export async function getSalesByPeriod(startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month' = 'day') {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getSalesByPeriod', async () => {
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
  }, `get sales by period ${groupBy}`);
}

// Vendas por método de pagamento
export async function getSalesByPaymentMethod(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getSalesByPaymentMethod', async () => {
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
  }, `get sales by payment method`);
}

// Vendas por categoria de produto
export async function getSalesByCategory(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getSalesByCategory', async () => {
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
  }, `get sales by category`);
}
