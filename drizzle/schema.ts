import { pgTable, serial, text, varchar, decimal, boolean, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";

// Enums do PostgreSQL
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const paymentMethodEnum = pgEnum("payment_method", ["pix", "dinheiro", "cartao", "fiado"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pendente", "pago", "cancelado"]);
export const orderStatusEnum = pgEnum("order_status", ["aguardando_pagamento", "em_preparo", "pronto", "entregue", "cancelado"]);

/**
 * Core user table backing auth flow (admin users).
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("password_hash", { length: 255 }), // Hash da senha para login admin
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clientes da cantina - identificados por nome e telefone (sem senha)
 */
export const customers = pgTable("customers", {
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
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  category: varchar("category", { length: 100 }).default("geral").notNull(),
  flavors: jsonb("flavors").$type<string[]>(), // Array de sabores disponíveis
  available: boolean("available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Pedidos
 */
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  orderNumber: integer("order_number").notNull(), // Número sequencial do dia
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("pendente").notNull(),
  orderStatus: orderStatusEnum("order_status").default("aguardando_pagamento").notNull(),
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
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(), // Snapshot do nome
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(), // Snapshot do preço
  flavor: varchar("flavor", { length: 100 }), // Sabor escolhido
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * Dívidas (fiado) - cada pedido fiado gera uma dívida
 */
export const debts = pgTable("debts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  orderId: integer("order_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Debt = typeof debts.$inferSelect;
export type InsertDebt = typeof debts.$inferInsert;
