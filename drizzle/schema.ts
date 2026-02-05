import { mysqlTable, serial, text, varchar, decimal, boolean, timestamp, int, json, mysqlEnum } from "drizzle-orm/mysql-core";

// Enums do MySQL
export const roleValues = ["user", "admin"] as const;
export const paymentMethodValues = ["pix", "dinheiro", "cartao", "fiado"] as const;
export const paymentStatusValues = ["pendente", "pago", "cancelado"] as const;
export const orderStatusValues = ["aguardando_pagamento", "em_preparo", "pronto", "entregue", "cancelado"] as const;

/**
 * Core user table backing auth flow (admin users).
 */
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("password_hash", { length: 255 }), // Hash da senha para login admin
  loginMethod: varchar("login_method", { length: 64 }),
  role: mysqlEnum("role", roleValues).default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clientes da cantina - identificados por nome e telefone (sem senha)
 */
export const customers = mysqlTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0").notNull(),
  totalDebt: decimal("total_debt", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Produtos da cantina
 */
export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  category: varchar("category", { length: 100 }).default("geral").notNull(),
  flavors: json("flavors").$type<string[]>(), // Array de sabores disponíveis
  available: boolean("available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Pedidos
 */
export const orders = mysqlTable("orders", {
  id: serial("id").primaryKey(),
  customerId: int("customer_id").notNull(),
  orderNumber: int("order_number").notNull(), // Número sequencial do dia
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0").notNull(), // Valor já pago (para pagamento parcial)
  paymentMethod: mysqlEnum("payment_method", paymentMethodValues).notNull(),
  paymentStatus: mysqlEnum("payment_status", paymentStatusValues).default("pendente").notNull(),
  orderStatus: mysqlEnum("order_status", orderStatusValues).default("aguardando_pagamento").notNull(),
  isPresencial: boolean("is_presencial").default(false).notNull(), // Pedido feito presencialmente pelo admin
  notes: text("notes"), // Observações do pedido
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Itens do pedido
 */
export const orderItems = mysqlTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: int("order_id").notNull(),
  productId: int("product_id").notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(), // Snapshot do nome
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(), // Snapshot do preço
  flavor: varchar("flavor", { length: 100 }), // Sabor escolhido
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * Dívidas (fiado) - sempre vinculada a um pedido para rastreabilidade
 */
export const debts = mysqlTable("debts", {
  id: serial("id").primaryKey(),
  customerId: int("customer_id").notNull(),
  orderId: int("order_id").notNull(), // Sempre obrigatório - vinculado a um pedido
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Debt = typeof debts.$inferSelect;
export type InsertDebt = typeof debts.$inferInsert;

/**
 * Despesas da cantina
 */
export const expenses = mysqlTable("expenses", {
  id: serial("id").primaryKey(),
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }).default("geral").notNull(),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

/**
 * Cartões salvos dos clientes (para gateway de pagamento)
 * Armazena apenas tokens, nunca dados sensíveis do cartão
 */
export const savedCards = mysqlTable("saved_cards", {
  id: serial("id").primaryKey(),
  customerId: int("customer_id").notNull(),
  gatewayCardId: varchar("gateway_card_id", { length: 255 }).notNull(), // Token do gateway
  lastFourDigits: varchar("last_four_digits", { length: 4 }).notNull(),
  brand: varchar("brand", { length: 50 }).notNull(), // visa, mastercard, etc
  expirationMonth: int("expiration_month").notNull(),
  expirationYear: int("expiration_year").notNull(),
  holderName: varchar("holder_name", { length: 255 }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SavedCard = typeof savedCards.$inferSelect;
export type InsertSavedCard = typeof savedCards.$inferInsert;

/**
 * Transações de pagamento (para rastreamento de gateway)
 */
export const paymentTransactions = mysqlTable("payment_transactions", {
  id: serial("id").primaryKey(),
  orderId: int("order_id").notNull(),
  customerId: int("customer_id").notNull(),
  gatewayTransactionId: varchar("gateway_transaction_id", { length: 255 }), // ID da transação no gateway
  paymentMethod: mysqlEnum("payment_method", paymentMethodValues).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, approved, rejected, refunded
  pixCode: text("pix_code"), // Código copia e cola do PIX
  pixQrCodeBase64: text("pix_qr_code_base64"), // QR Code em base64
  pixExpiresAt: timestamp("pix_expires_at"), // Expiração do PIX
  savedCardId: int("saved_card_id"), // Referência ao cartão salvo usado
  gatewayResponse: json("gateway_response"), // Resposta completa do gateway
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;
