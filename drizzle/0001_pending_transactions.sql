CREATE TABLE `pending_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`date` text NOT NULL,
	`raw_subject` text,
	`raw_from` text,
	`confidence` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_user_external_idx` ON `pending_transactions` (`user_id`,`external_id`);
--> statement-breakpoint
CREATE INDEX `pending_user_status_idx` ON `pending_transactions` (`user_id`,`status`);
