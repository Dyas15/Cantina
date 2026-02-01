CREATE TABLE `expenses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`description` varchar(500) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`category` varchar(100) NOT NULL DEFAULT 'geral',
	`date` timestamp NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`gateway_transaction_id` varchar(255),
	`payment_method` enum('pix','dinheiro','cartao','fiado') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`pix_code` text,
	`pix_qr_code_base64` text,
	`pix_expires_at` timestamp,
	`saved_card_id` int,
	`gateway_response` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_cards` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`customer_id` int NOT NULL,
	`gateway_card_id` varchar(255) NOT NULL,
	`last_four_digits` varchar(4) NOT NULL,
	`brand` varchar(50) NOT NULL,
	`expiration_month` int NOT NULL,
	`expiration_year` int NOT NULL,
	`holder_name` varchar(255) NOT NULL,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `customers` MODIFY COLUMN `id` serial AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` MODIFY COLUMN `id` serial AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` MODIFY COLUMN `id` serial AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `id` serial AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `products` MODIFY COLUMN `id` serial AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `id` serial AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `total_spent` decimal(10,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `total_debt` decimal(10,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `customer_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `order_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `is_paid` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `paid_at` timestamp;--> statement-breakpoint
ALTER TABLE `debts` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `debts` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `order_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `product_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `product_name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `unit_price` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `order_number` int NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `total_amount` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_method` enum('pix','dinheiro','cartao','fiado') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_status` enum('pendente','pago','cancelado') DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `order_status` enum('aguardando_pagamento','em_preparo','pronto','entregue','cancelado') DEFAULT 'aguardando_pagamento' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `is_presencial` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `products` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `open_id` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `login_method` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_signed_in` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_open_id_unique` UNIQUE(`open_id`);--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `totalSpent`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `totalDebt`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `debts` DROP COLUMN `customerId`;--> statement-breakpoint
ALTER TABLE `debts` DROP COLUMN `orderId`;--> statement-breakpoint
ALTER TABLE `debts` DROP COLUMN `isPaid`;--> statement-breakpoint
ALTER TABLE `debts` DROP COLUMN `paidAt`;--> statement-breakpoint
ALTER TABLE `debts` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `debts` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `order_items` DROP COLUMN `orderId`;--> statement-breakpoint
ALTER TABLE `order_items` DROP COLUMN `productId`;--> statement-breakpoint
ALTER TABLE `order_items` DROP COLUMN `productName`;--> statement-breakpoint
ALTER TABLE `order_items` DROP COLUMN `unitPrice`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `customerId`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `orderNumber`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `totalAmount`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `paymentMethod`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `paymentStatus`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `orderStatus`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `isPresencial`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `imageUrl`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `passwordHash`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `createdAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lastSignedIn`;