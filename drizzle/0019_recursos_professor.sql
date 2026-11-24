CREATE TABLE "class_weeks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "author_id" uuid NOT NULL REFERENCES "users"("id"),
  "token" text NOT NULL,
  "week_of" date NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "homework" text DEFAULT '' NOT NULL,
  "links" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "class_weeks_token_idx" ON "class_weeks" ("token");
--> statement-breakpoint
CREATE UNIQUE INDEX "class_weeks_class_week_uq" ON "class_weeks" ("class_id","week_of");
--> statement-breakpoint
CREATE TABLE "live_quizzes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "orgs"("id") ON DELETE CASCADE,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "perguntas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "live_quizzes_owner_idx" ON "live_quizzes" ("owner_id");
--> statement-breakpoint
CREATE TABLE "live_games" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quiz_id" uuid NOT NULL REFERENCES "live_quizzes"("id") ON DELETE CASCADE,
  "host_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "state" text DEFAULT 'lobby' NOT NULL,
  "current" integer DEFAULT -1 NOT NULL,
  "question_started_at" timestamp with time zone,
  "perguntas" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "live_games_code_uq" ON "live_games" ("code");
--> statement-breakpoint
CREATE TABLE "live_players" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "game_id" uuid NOT NULL REFERENCES "live_games"("id") ON DELETE CASCADE,
  "nickname" text NOT NULL,
  "secret" text NOT NULL,
  "score" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "live_players_nick_uq" ON "live_players" ("game_id","nickname");
--> statement-breakpoint
CREATE TABLE "live_answers" (
  "game_id" uuid NOT NULL REFERENCES "live_games"("id") ON DELETE CASCADE,
  "player_id" uuid NOT NULL REFERENCES "live_players"("id") ON DELETE CASCADE,
  "q" integer NOT NULL,
  "choice" integer NOT NULL,
  "ms" integer NOT NULL,
  "correct" boolean NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY ("game_id","player_id","q")
);
--> statement-breakpoint
