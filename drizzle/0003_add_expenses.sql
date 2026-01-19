-- Migration: Add expenses table for financial management
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `description` varchar(255) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `category` varchar(100) NOT NULL DEFAULT 'geral',
  `date` timestamp NOT NULL,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Index for faster queries by date and category
CREATE INDEX `idx_expenses_date` ON `expenses` (`date`);
CREATE INDEX `idx_expenses_category` ON `expenses` (`category`);
