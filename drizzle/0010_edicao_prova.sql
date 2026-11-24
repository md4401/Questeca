ALTER TABLE "assessment_items" ADD COLUMN "override" jsonb;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "layout" jsonb;