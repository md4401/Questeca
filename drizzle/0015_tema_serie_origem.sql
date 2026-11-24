ALTER TABLE "questions" ADD COLUMN "tema" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "series" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "origin" text DEFAULT 'banco' NOT NULL;