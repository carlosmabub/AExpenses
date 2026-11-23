CREATE TABLE `advances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`report_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer,
	`employee_id` integer,
	`source` text NOT NULL,
	`kind` text DEFAULT 'compra' NOT NULL,
	`payment_method` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`purchase_date` text,
	`merchant` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`category_id` integer,
	`suggested_category_id` integer,
	`description` text DEFAULT '' NOT NULL,
	`cost_center` text DEFAULT '' NOT NULL,
	`receipt_path` text,
	`receipt_mime` text,
	`report_id` integer,
	`saved_at` text,
	`inherited_from_id` integer,
	`review_status` text,
	`review_comment` text DEFAULT '' NOT NULL,
	`reviewed_at` text,
	`reviewed_by` integer,
	`available_at` text NOT NULL,
	`due_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`suggested_category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_transaction_id_unique` ON `expenses` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `expenses_employee` ON `expenses` (`employee_id`);--> statement-breakpoint
CREATE INDEX `expenses_report` ON `expenses` (`report_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`name` text NOT NULL,
	`cost_center` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'aberto' NOT NULL,
	`submitted_at` text,
	`approved_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reports_employee` ON `reports` (`employee_id`);--> statement-breakpoint
ALTER TABLE `categories` ADD `requires_receipt` integer DEFAULT true NOT NULL;--> statement-breakpoint
-- Dados: cada compra do banco já importada vira uma despesa, levando a classificação do primeiro piloto.
-- Prazo novo: fim do mês da compra (23:59 em Brasília), com no mínimo 5 dias desde a chegada no app.
INSERT INTO `expenses` (`transaction_id`, `source`, `kind`, `payment_method`, `amount_cents`, `purchase_date`, `merchant`, `city`,
  `category_id`, `suggested_category_id`, `description`, `cost_center`, `receipt_path`, `receipt_mime`, `saved_at`,
  `available_at`, `due_at`)
SELECT t.`id`, 'cartao', t.`kind`, 'cartao', t.`amount_cents`, t.`purchase_date`, t.`merchant`, t.`city`,
  c.`category_id`, t.`suggested_category_id`, coalesce(c.`description`, ''), coalesce(c.`cost_center`, ''), c.`receipt_path`, c.`receipt_mime`, c.`classified_at`,
  t.`available_at`,
  max(
    strftime('%Y-%m-%dT%H:%M:%S.000Z', coalesce(t.`purchase_date`, t.`available_at`), 'start of month', '+1 month', '+2 hours', '+59 minutes', '+59 seconds'),
    strftime('%Y-%m-%dT%H:%M:%S.000Z', t.`available_at`, '+5 days')
  )
FROM `transactions` t
LEFT JOIN `classifications` c ON c.`transaction_id` = t.`id`
WHERE NOT EXISTS (SELECT 1 FROM `expenses` e WHERE e.`transaction_id` = t.`id`);
--> statement-breakpoint
-- Tipos de despesa para fabricação de equipamentos (os existentes ficam; os nomes repetidos são ignorados)
INSERT OR IGNORE INTO `categories` (`name`, `icon`, `mccs`, `sort_order`) VALUES
  ('Matéria-prima e insumos', 'package', '5051,5085,5039', 20),
  ('Peças e componentes', 'cog', '5013,5065,5533', 21),
  ('Ferramentas e equipamentos', 'wrench', '5072,5251,5200', 22),
  ('EPIs', 'hard-hat', '5137,5699', 23),
  ('Manutenção de máquinas', 'settings', '7699,7692', 24),
  ('Manutenção de instalações', 'building', '1711,1731,1799,5211', 25),
  ('Frete e envio', 'truck', '4214,4215,9402', 26),
  ('Serviços técnicos de terceiros', 'briefcase', '7392,8911,8999', 27),
  ('Feiras e eventos', 'ticket', '7941,7991,7999', 28);
