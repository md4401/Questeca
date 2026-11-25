CREATE TABLE "question_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question_id" uuid NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "position" integer DEFAULT 0 NOT NULL,
  "mime" text DEFAULT 'image/png' NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "data" bytea NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "question_images_q_idx" ON "question_images" ("question_id","position");
