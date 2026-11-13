CREATE TABLE `event_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`closed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`question` text NOT NULL,
	`allow_share` integer DEFAULT false NOT NULL,
	`topping` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_submission_id_unique` ON `questions` (`submission_id`);--> statement-breakpoint
CREATE INDEX `questions_visitor_idx` ON `questions` (`visitor_hash`,`id`);