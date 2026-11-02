CREATE TABLE `trading_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'paper' NOT NULL,
	`budget` integer DEFAULT 500000 NOT NULL,
	`max_loss_per_trade` integer DEFAULT 5000 NOT NULL,
	`max_position` integer DEFAULT 200000 NOT NULL,
	`max_order` integer DEFAULT 150000 NOT NULL,
	`cash_buffer` integer DEFAULT 50000 NOT NULL,
	`max_trades_per_day` integer DEFAULT 3 NOT NULL,
	`daily_loss_limit` integer DEFAULT 15000 NOT NULL,
	`entry_from` text DEFAULT '09:45' NOT NULL,
	`entry_to` text DEFAULT '15:30' NOT NULL,
	`flat_by` text DEFAULT '15:55' NOT NULL,
	`min_reward_risk` real DEFAULT 1 NOT NULL,
	`universe` text DEFAULT 'sp100' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `watchlist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watchlist_user_symbol_idx` ON `watchlist_items` (`user_id`,`symbol`);
--> statement-breakpoint
CREATE INDEX `watchlist_user_idx` ON `watchlist_items` (`user_id`);
--> statement-breakpoint
CREATE TABLE `trade_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`symbol` text NOT NULL,
	`setup_type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`entry_trigger` integer NOT NULL,
	`entry` integer,
	`stop` integer NOT NULL,
	`target` integer NOT NULL,
	`stop_rule` text NOT NULL,
	`target_rule` text NOT NULL,
	`r_multiple` real DEFAULT 2 NOT NULL,
	`risk_per_share` integer NOT NULL,
	`risk_amount` integer NOT NULL,
	`qty` integer NOT NULL,
	`or_high` integer,
	`or_low` integer,
	`or_minutes` integer,
	`flat_by` text DEFAULT '15:55' NOT NULL,
	`checks_json` text DEFAULT '[]' NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trade_plans_user_status_idx` ON `trade_plans` (`user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `paper_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text,
	`symbol` text NOT NULL,
	`side` text DEFAULT 'long' NOT NULL,
	`order_type` text DEFAULT 'bracket' NOT NULL,
	`qty` integer NOT NULL,
	`entry` integer NOT NULL,
	`stop` integer NOT NULL,
	`target` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`filled_at` text,
	`filled_price` integer,
	`closed_at` text,
	`closed_price` integer,
	`exit_reason` text,
	`risk_amount` integer DEFAULT 0 NOT NULL,
	`pnl` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `trade_plans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `paper_orders_user_status_idx` ON `paper_orders` (`user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `price_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`symbol` text NOT NULL,
	`kind` text NOT NULL,
	`level` integer,
	`pct` real,
	`label` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`triggered_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `price_alerts_user_active_idx` ON `price_alerts` (`user_id`,`is_active`);
