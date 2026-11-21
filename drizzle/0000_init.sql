CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fingerprint` text NOT NULL,
	`last4` text NOT NULL,
	`holder_name` text NOT NULL,
	`bank_cost_center` text DEFAULT '' NOT NULL,
	`is_billing_account` integer DEFAULT false NOT NULL,
	`employee_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_fingerprint_unique` ON `cards` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT '🧾' NOT NULL,
	`mccs` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `classifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaction_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`description` text NOT NULL,
	`cost_center` text DEFAULT '' NOT NULL,
	`receipt_path` text,
	`receipt_mime` text,
	`inherited_from_id` integer,
	`classified_by` integer,
	`classified_at` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`classified_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classifications_transaction_id_unique` ON `classifications` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'funcionario' NOT NULL,
	`cost_center` text DEFAULT '' NOT NULL,
	`card_holder_name` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`processing_date` text,
	`due_date` text,
	`trailer_transactions` integer,
	`trailer_total_cents` integer,
	`read_entries` integer NOT NULL,
	`read_total_cents` integer NOT NULL,
	`check_ok` integer NOT NULL,
	`problems` text DEFAULT '[]' NOT NULL,
	`new_transactions` integer NOT NULL,
	`duplicate_transactions` integer NOT NULL,
	`ignored_entries` integer NOT NULL,
	`simulated` integer NOT NULL,
	`imported_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`imported_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`card_id` integer NOT NULL,
	`reference` text NOT NULL,
	`kind` text NOT NULL,
	`transaction_code` text NOT NULL,
	`purchase_date` text,
	`posting_date` text,
	`installment` integer DEFAULT 0 NOT NULL,
	`installments_total` integer DEFAULT 0 NOT NULL,
	`group_key` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`original_amount_millis` integer NOT NULL,
	`original_currency` text NOT NULL,
	`merchant` text NOT NULL,
	`merchant_cnpj` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`mcc` text DEFAULT '' NOT NULL,
	`activity_description` text DEFAULT '' NOT NULL,
	`authorization_code` text DEFAULT '' NOT NULL,
	`suggested_category_id` integer,
	`available_at` text NOT NULL,
	`due_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`suggested_category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_dedup` ON `transactions` (`card_id`,`reference`,`installment`,`kind`);--> statement-breakpoint
CREATE INDEX `transactions_card` ON `transactions` (`card_id`);--> statement-breakpoint
CREATE INDEX `transactions_group` ON `transactions` (`group_key`);