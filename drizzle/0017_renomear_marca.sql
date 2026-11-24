-- Nova marca: Questeca → Segunda Lousa; questões criadas pela IA → GizIA.
UPDATE "questions" SET "institution" = 'GizIA', "exam" = 'Questão criada pela GizIA' WHERE "institution" = 'Questeca IA';--> statement-breakpoint
UPDATE "questions" SET "institution" = 'Segunda Lousa' WHERE "institution" = 'Questeca';--> statement-breakpoint
UPDATE "questions" SET "exam" = replace("exam", 'Questeca', 'Segunda Lousa') WHERE "exam" LIKE '%Questeca%';--> statement-breakpoint
UPDATE "questions" SET "license_note" = replace("license_note", 'Questeca', 'Segunda Lousa') WHERE "license_note" LIKE '%Questeca%';--> statement-breakpoint
UPDATE "questions" SET "answer_source" = replace("answer_source", 'Questeca', 'Segunda Lousa') WHERE "answer_source" LIKE '%Questeca%';--> statement-breakpoint
UPDATE "questions" SET "search_norm" = replace(replace("search_norm", 'questeca ia', 'gizia'), 'questeca', 'segunda lousa') WHERE "search_norm" LIKE '%questeca%';
