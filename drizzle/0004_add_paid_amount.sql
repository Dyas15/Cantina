-- Migration: Add paid_amount column for partial payments
ALTER TABLE `orders` ADD COLUMN `paid_amount` DECIMAL(10, 2) NOT NULL DEFAULT '0' AFTER `total_amount`;
