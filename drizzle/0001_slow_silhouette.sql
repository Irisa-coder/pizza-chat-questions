DROP INDEX `questions_visitor_idx`;--> statement-breakpoint
ALTER TABLE `questions` ADD `round` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `questions_round_visitor_idx` ON `questions` (`round`,`visitor_hash`,`id`);--> statement-breakpoint
ALTER TABLE `event_state` ADD `round` integer DEFAULT 1 NOT NULL;