-- Script de criação do banco de dados para Supabase PostgreSQL
-- Execute este script no SQL Editor do Supabase

-- Criar tipos ENUM
CREATE TYPE role AS ENUM ('user', 'admin');
CREATE TYPE payment_method AS ENUM ('pix', 'dinheiro', 'cartao', 'fiado');
CREATE TYPE payment_status AS ENUM ('pendente', 'pago', 'cancelado');
CREATE TYPE order_status AS ENUM ('aguardando_pagamento', 'em_preparo', 'pronto', 'entregue', 'cancelado');

-- Tabela de usuários (admin)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  open_id VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  password_hash VARCHAR(255),
  login_method VARCHAR(64),
  role role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_signed_in TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de clientes
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  total_spent DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_debt DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de produtos
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'geral',
  flavors JSONB,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de pedidos
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_number INTEGER NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pendente',
  order_status order_status NOT NULL DEFAULT 'aguardando_pagamento',
  is_presencial BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de itens do pedido
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  flavor VARCHAR(100),
  subtotal DECIMAL(10, 2) NOT NULL
);

-- Tabela de dívidas (fiado)
CREATE TABLE debts (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id INTEGER NOT NULL REFERENCES orders(id),
  amount DECIMAL(10, 2) NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de despesas (opcional, para gestão financeira)
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_debts_customer_id ON debts(customer_id);
CREATE INDEX idx_debts_is_paid ON debts(is_paid);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir usuário admin padrão (senha: admin123)
-- IMPORTANTE: Altere a senha após o primeiro login!
INSERT INTO users (open_id, name, email, password_hash, login_method, role)
VALUES (
  'admin_default',
  'Administrador',
  'admin@cantina.com',
  '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u', -- senha: admin123
  'password',
  'admin'
);
