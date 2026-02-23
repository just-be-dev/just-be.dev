CREATE TABLE `micro_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text(280) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`syndicated_to` text DEFAULT '[]'
);
