CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inep_code" text,
	"name" text NOT NULL,
	"name_norm" text NOT NULL,
	"city" text NOT NULL,
	"city_norm" text NOT NULL,
	"uf" text NOT NULL,
	"neighborhood" text,
	"dependency" text,
	"source" text NOT NULL,
	"source_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "school_id" uuid;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "uf" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "school_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_draft" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_done_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "schools_inep_uq" ON "schools" USING btree ("inep_code");--> statement-breakpoint
CREATE INDEX "schools_uf_city_idx" ON "schools" USING btree ("uf","city_norm");--> statement-breakpoint
CREATE INDEX "schools_name_trgm" ON "schools" USING gin ("name_norm" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;