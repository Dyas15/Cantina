import { eq, and, desc, asc, like, sql, gte, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { 
  InsertUser, users, 
  customers, InsertCustomer, Customer,
  products, InsertProduct, Product,
  orders, InsertOrder, Order,
  orderItems, InsertOrderItem, OrderItem,
  debts, InsertDebt, Debt,
  expenses, InsertExpense, Expense,
  savedCards, InsertSavedCard, SavedCard,
  paymentTransactions, InsertPaymentTransaction, PaymentTransaction
} from "../drizzle/schema";
import { createLogger, logDbConnection, logQuery, logQueryError } from "./_core/logger";

const logger = createLogger('Database');

let _db: any = null;
let _pool: mysql.Pool | null = null;

/**
 * Obtém a instância do banco de dados MySQL
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      
      // Log da tentativa de conexão (sem expor credenciais)
      const urlParts = databaseUrl.match(/^mysql:\/\/([^:]+):[^@]+@([^:\/]+)/);
      const safeUrl = urlParts ? `mysql://${urlParts[1]}:***@${urlParts[2]}` : 'mysql://***';
      
      logDbConnection('connecting', { 
        url: safeUrl,
        nodeEnv: process.env.NODE_ENV
      });

      // Cria pool de conexões MySQL
      _pool = mysql.createPool({
        uri: databaseUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });

      _db = drizzle(_pool);
      
      // Testa a conexão
      try {
        await _db.execute(sql`SELECT 1 as test`);
        logDbConnection('connected', { url: safeUrl });
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
      _pool = null;
    }
  }
  return _db;
}

/**
 * Wrapper para executar queries com logging de erros
 */
export async function executeWithLogging<T>(
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
    const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    
    if (existing.length > 0) {
      // Update
      const updateSet: Record<string, unknown> = {};
      if (user.name !== undefined) updateSet.name = user.name;
      if (user.email !== undefined) updateSet.email = user.email;
      if (user.loginMethod !== undefined) updateSet.loginMethod = user.loginMethod;
      if (user.lastSignedIn !== undefined) updateSet.lastSignedIn = user.lastSignedIn;
      if (user.role !== undefined) updateSet.role = user.role;
      
      if (Object.keys(updateSet).length > 0) {
        await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
      }
    } else {
      // Insert
      await db.insert(users).values({
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role: user.role ?? 'user',
        lastSignedIn: user.lastSignedIn ?? new Date(),
      });
    }
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
    });

    const insertId = (result as any)[0]?.insertId;
    logger.info('Admin user created', { email, id: insertId });
    return insertId;
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
    });

    const insertId = (result as any)[0]?.insertId;
    
    // Busca o cliente recém criado
    const newCustomer = await db.select().from(customers).where(eq(customers.id, insertId)).limit(1);
    
    logger.info('New customer created', { id: insertId, name: name.trim(), phone: normalizedPhone });
    return newCustomer[0];
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
        like(customers.name, `%${query}%`),
        like(customers.phone, `%${query}%`)
      ))
      .orderBy(desc(customers.updatedAt))
      .limit(20);
  }, `search customers ${query}`);
}

export async function getAllCustomers(): Promise<(Customer & { calculatedDebt: number, calculatedPendingPayments: number })[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getAllCustomers', async () => {
    const allCustomers = await db.select().from(customers).orderBy(desc(customers.createdAt));
    
    // Para cada cliente, calcula a dívida real (fiado não pago + pedidos pendentes)
    const customersWithCalculatedDebt = await Promise.all(
      allCustomers.map(async (customer) => {
        // Dívidas da tabela debts (fiado não pago)
        const debtResult = await db.select({
          total: sql<string>`COALESCE(SUM(${debts.amount}), 0)`,
        }).from(debts)
          .where(and(
            eq(debts.customerId, customer.id),
            eq(debts.isPaid, false)
          ));
        const calculatedDebt = Number(debtResult[0]?.total || 0);

        // Pedidos com pagamento pendente (qualquer método, exceto fiado que já está em debts)
        const pendingResult = await db.select({
          total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
        }).from(orders)
          .where(and(
            eq(orders.customerId, customer.id),
            eq(orders.paymentStatus, 'pendente'),
            sql`${orders.orderStatus} != 'cancelado'`,
            sql`${orders.paymentMethod} != 'fiado'`
          ));
        const calculatedPendingPayments = Number(pendingResult[0]?.total || 0);

        return {
          ...customer,
          calculatedDebt,
          calculatedPendingPayments,
          // Atualiza o totalDebt para refletir a dívida real
          totalDebt: (calculatedDebt + calculatedPendingPayments).toFixed(2),
        };
      })
    );

    return customersWithCalculatedDebt;
  }, 'get all customers');
}

export async function updateCustomerTotals(customerId: number, amountSpent: number, amountDebt: number) {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('updateCustomerTotals', async () => {
    await db.update(customers)
      .set({
        totalSpent: sql`${customers.totalSpent} + ${amountSpent}`,
        totalDebt: sql`${customers.totalDebt} + ${amountDebt}`,
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
      total: sql<string>`COALESCE(SUM(${debts.amount}), 0)`,
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
    const result = await db.insert(products).values(product);
    const insertId = (result as any)[0]?.insertId;
    logger.info('Product created', { id: insertId, name: product.name });
    return insertId;
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
    });
    
    const orderId = (result as any)[0]?.insertId;

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
    const conditions: any[] = [];

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
      return db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt));
    }

    return db.select().from(orders).orderBy(desc(orders.createdAt));
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
          eq(orders.orderStatus, 'aguardando_pagamento'),
          eq(orders.orderStatus, 'em_preparo')
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

// Busca pedidos não entregues de um cliente específico
export async function getCustomerPendingOrders(customerId: number): Promise<(Order & { items: OrderItem[] })[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getCustomerPendingOrders', async () => {
    const orderResults = await db.select().from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        or(
          eq(orders.orderStatus, 'aguardando_pagamento'),
          eq(orders.orderStatus, 'em_preparo'),
          eq(orders.orderStatus, 'pronto')
        )
      ))
      .orderBy(desc(orders.createdAt));

    const ordersWithItems = await Promise.all(
      orderResults.map(async (order) => {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        return { ...order, items };
      })
    );

    return ordersWithItems;
  }, `get customer pending orders ${customerId}`);
}

export async function updateOrderStatus(orderId: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('updateOrderStatus', async () => {
    await db.update(orders).set({ orderStatus: status as any }).where(eq(orders.id, orderId));
    logger.info('Order status updated', { orderId, status });
  }, `update order status ${orderId} to ${status}`);
}

export async function updatePaymentStatus(orderId: number, status: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('updatePaymentStatus', async () => {
    await db.update(orders).set({ paymentStatus: status as any }).where(eq(orders.id, orderId));
    
    // Se o pagamento foi confirmado, atualiza o totalSpent do cliente
    if (status === 'pago') {
      const order = await getOrderById(orderId);
      if (order) {
        await db.update(customers)
          .set({
            totalSpent: sql`${customers.totalSpent} + ${order.totalAmount}`,
          })
          .where(eq(customers.id, order.customerId));
      }
    }
    
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
    const debtResults = onlyUnpaid
      ? await db.select().from(debts).where(eq(debts.isPaid, false)).orderBy(desc(debts.createdAt))
      : await db.select().from(debts).orderBy(desc(debts.createdAt));

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

    // Atualiza totais do cliente - subtrai da dívida e adiciona ao gasto
    await db.update(customers)
      .set({
        totalDebt: sql`GREATEST(${customers.totalDebt} - ${debt.amount}, 0)`,
        totalSpent: sql`${customers.totalSpent} + ${debt.amount}`,
      })
      .where(eq(customers.id, debt.customerId));
    
    logger.info('Debt marked as paid', { debtId, orderId: debt.orderId, customerId: debt.customerId });
    
    // Emite evento de atualização
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

// ==================== EXPENSE QUERIES ====================

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
    const result = await db.insert(expenses).values({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      notes: expense.notes || null,
    });

    const id = (result as any)[0]?.insertId;
    logger.info('Expense created', { id, description: expense.description, amount: expense.amount });
    return id;
  }, `create expense ${expense.description}`);
}

export async function getAllExpenses(filters?: {
  startDate?: Date;
  endDate?: Date;
  category?: string;
}): Promise<Expense[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getAllExpenses', async () => {
    const conditions: any[] = [];
    
    if (filters?.startDate) {
      conditions.push(gte(expenses.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(expenses.date, filters.endDate));
    }
    if (filters?.category) {
      conditions.push(eq(expenses.category, filters.category));
    }

    if (conditions.length > 0) {
      return db.select().from(expenses).where(and(...conditions)).orderBy(desc(expenses.date));
    }
    
    return db.select().from(expenses).orderBy(desc(expenses.date));
  }, 'get all expenses');
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('deleteExpense', async () => {
    await db.delete(expenses).where(eq(expenses.id, id));
    logger.info('Expense deleted', { id });
  }, `delete expense ${id}`);
}

export async function getFinancialSummary(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  return executeWithLogging('getFinancialSummary', async () => {
    // Total de vendas (pedidos não cancelados)
    const salesResult = await db.select({
      totalSales: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    }).from(orders)
      .where(and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        sql`${orders.orderStatus} != 'cancelado'`
      ));

    // Total recebido (pagos)
    const receivedResult = await db.select({
      totalReceived: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    }).from(orders)
      .where(and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        eq(orders.paymentStatus, 'pago')
      ));

    // Total de despesas
    const expensesResult = await db.select({
      total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
    }).from(expenses)
      .where(and(
        gte(expenses.date, startDate),
        lte(expenses.date, endDate)
      ));
    
    const totalExpenses = Number(expensesResult[0]?.total || 0);

    // Total a receber (fiado não pago)
    const pendingResult = await db.select({
      totalPending: sql<string>`COALESCE(SUM(${debts.amount}), 0)`,
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
      total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(orders)
      .where(and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        sql`${orders.orderStatus} != 'cancelado'`
      ));

    // Total recebido (pagos)
    const totalReceived = await db.select({
      total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    }).from(orders)
      .where(and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        eq(orders.paymentStatus, 'pago')
      ));

    // Total a receber (fiado não pago)
    const totalPending = await db.select({
      total: sql<string>`COALESCE(SUM(${debts.amount}), 0)`,
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
      totalRevenue: sql<string>`SUM(${orderItems.subtotal})`,
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
      totalSpent: sql<string>`SUM(${orders.totalAmount})`,
      orderCount: sql<number>`COUNT(*)`,
    }).from(orders)
      .where(and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        sql`${orders.orderStatus} != 'cancelado'`
      ))
      .groupBy(orders.customerId)
      .orderBy(desc(sql`SUM(${orders.totalAmount})`))
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
    // Busca clientes com dívidas não pagas (calculado dinamicamente)
    const debtorsResult = await db.select({
      customerId: debts.customerId,
      totalDebt: sql<string>`SUM(${debts.amount})`,
    }).from(debts)
      .where(eq(debts.isPaid, false))
      .groupBy(debts.customerId)
      .having(sql`SUM(${debts.amount}) > 0`)
      .orderBy(desc(sql`SUM(${debts.amount})`))
      .limit(limit);

    // Busca dados dos clientes
    const debtorsWithDetails = await Promise.all(
      debtorsResult.map(async (item) => {
        const customer = await getCustomerById(item.customerId);
        return {
          ...customer!,
          totalDebt: item.totalDebt,
        };
      })
    );

    return debtorsWithDetails;
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
    const dateFormat = groupBy === 'day' ? '%Y-%m-%d' 
      : groupBy === 'week' ? '%Y-%u' 
      : '%Y-%m';

    const result = await db.select({
      period: sql<string>`DATE_FORMAT(${orders.createdAt}, ${dateFormat})`,
      totalSales: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
      orderCount: sql<number>`COUNT(*)`,
    }).from(orders)
      .where(and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        sql`${orders.orderStatus} != 'cancelado'`
      ))
      .groupBy(sql`DATE_FORMAT(${orders.createdAt}, ${dateFormat})`)
      .orderBy(sql`DATE_FORMAT(${orders.createdAt}, ${dateFormat})`);

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
      totalSales: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`,
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
      totalSales: sql<string>`COALESCE(SUM(${orderItems.subtotal}), 0)`,
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

// ==================== SAVED CARDS QUERIES (para gateway de pagamento) ====================

export async function getSavedCardsByCustomer(customerId: number): Promise<SavedCard[]> {
  const db = await getDb();
  if (!db) return [];

  return executeWithLogging('getSavedCardsByCustomer', async () => {
    return db.select().from(savedCards)
      .where(eq(savedCards.customerId, customerId))
      .orderBy(desc(savedCards.isDefault), desc(savedCards.createdAt));
  }, `get saved cards by customer ${customerId}`);
}

export async function createSavedCard(card: InsertSavedCard): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return executeWithLogging('createSavedCard', async () => {
    // Se for o cartão padrão, remove o padrão dos outros
    if (card.isDefault) {
      await db.update(savedCards)
        .set({ isDefault: false })
        .where(eq(savedCards.customerId, card.customerId));
    }

    const result = await db.insert(savedCards).values(card);
    const insertId = (result as any)[0]?.insertId;
    logger.info('Saved card created', { id: insertId, customerId: card.customerId, brand: card.brand });
    return insertId;
  }, `create saved card for customer ${card.customerId}`);
}

export async function deleteSavedCard(id: number, customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('deleteSavedCard', async () => {
    await db.delete(savedCards)
      .where(and(eq(savedCards.id, id), eq(savedCards.customerId, customerId)));
    logger.info('Saved card deleted', { id, customerId });
  }, `delete saved card ${id}`);
}

// ==================== PAYMENT TRANSACTIONS QUERIES ====================

export async function createPaymentTransaction(transaction: InsertPaymentTransaction): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return executeWithLogging('createPaymentTransaction', async () => {
    const result = await db.insert(paymentTransactions).values(transaction);
    const insertId = (result as any)[0]?.insertId;
    logger.info('Payment transaction created', { id: insertId, orderId: transaction.orderId });
    return insertId;
  }, `create payment transaction for order ${transaction.orderId}`);
}

export async function updatePaymentTransaction(id: number, updates: Partial<InsertPaymentTransaction>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  return executeWithLogging('updatePaymentTransaction', async () => {
    await db.update(paymentTransactions).set(updates).where(eq(paymentTransactions.id, id));
    logger.info('Payment transaction updated', { id, updates: Object.keys(updates) });
  }, `update payment transaction ${id}`);
}

export async function getPaymentTransactionByOrderId(orderId: number): Promise<PaymentTransaction | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  return executeWithLogging('getPaymentTransactionByOrderId', async () => {
    const result = await db.select().from(paymentTransactions)
      .where(eq(paymentTransactions.orderId, orderId))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(1);
    return result[0];
  }, `get payment transaction by order ${orderId}`);
}
