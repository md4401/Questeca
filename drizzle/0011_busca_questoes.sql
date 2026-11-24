CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "search_norm" text;--> statement-breakpoint
CREATE INDEX "questions_search_trgm" ON "questions" USING gin ("search_norm" gin_trgm_ops);
--> statement-breakpoint
UPDATE "questions" SET "search_norm" = lower(translate(coalesce("title",'') || ' ' || coalesce("statement",'') || ' ' || "institution" || ' ' || "exam" || ' ' || "year", 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) WHERE "search_norm" IS NULL;
