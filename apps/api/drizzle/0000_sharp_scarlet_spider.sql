CREATE TABLE `test_results` (
	`test_id` text NOT NULL,
	`student_number` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`scanned_on` text NOT NULL,
	`marks_available` integer NOT NULL,
	`marks_obtained` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`test_id`, `student_number`)
);
--> statement-breakpoint
CREATE INDEX `test_results_test_id_idx` ON `test_results` (`test_id`);