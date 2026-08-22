CREATE TABLE `workout_checkins` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`groups` text NOT NULL,
	`checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `date`)
);
--> statement-breakpoint
CREATE INDEX `idx_workout_checkins_user_date` ON `workout_checkins` (`user_id`,`date`);