ALTER TABLE `employees` ADD `leader_id` integer;--> statement-breakpoint
ALTER TABLE `employees` ADD `terminated_at` text;--> statement-breakpoint
-- Dono fixo: as compras do cartão passam a guardar quem era o dono do cartão, para que
-- passar o cartão para outra pessoa (ou desligar alguém) não leve o histórico junto.
UPDATE `expenses` SET `employee_id` = (
  SELECT c.`employee_id` FROM `transactions` t JOIN `cards` c ON c.`id` = t.`card_id` WHERE t.`id` = `expenses`.`transaction_id`
)
WHERE `employee_id` IS NULL AND `transaction_id` IS NOT NULL;
