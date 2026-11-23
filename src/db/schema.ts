import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb, numeric, date,
  primaryKey, uniqueIndex, index, customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer; driverData: Buffer | string }>({
  dataType() { return "bytea"; },
  toDriver(v) { return v; },
  fromDriver(v) {
    if (Buffer.isBuffer(v)) return v;
    const s = String(v);
    return Buffer.from(s.startsWith("\\x") ? s.slice(2) : s, s.startsWith("\\x") ? "hex" : "binary");
  },
});

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ---------- Identidade e tenancy ---------- */
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  termsVersion: text("terms_version").notNull(),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
  isStaff: boolean("is_staff").notNull().default(false),
  prefs: jsonb("prefs").$type<{ notifyMarketing?: boolean; notifyCommunity?: boolean; largeFont?: boolean; mute?: string[]; theme?: "light" | "dark" | "system" }>().notNull().default({}),
  onboardingDraft: jsonb("onboarding_draft").$type<Record<string, unknown>>(),
  onboardingDoneAt: timestamp("onboarding_done_at", { withTimezone: true }),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex("users_email_uq").on(t.email)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 do token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activeOrgId: uuid("active_org_id"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const authTokens = pgTable("auth_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // verify | reset | email_change
  hash: text("hash").notNull(),
  payload: text("payload"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex("auth_tokens_hash_uq").on(t.hash)]);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export type OrgSettings = {
  header?: { schoolName?: string; subtitle?: string; teacherLabel?: string; instructions?: string; footer?: string; logoDataUrl?: string; fields?: string[] };
  grading?: {
    scaleMax: number; passMark: number; rounding: "none" | "half" | "tenth" | "up_half";
    absenceCounts: "zero" | "exclude"; notDeliveredCounts: "zero" | "exclude";
    recovery: "none" | "replace_if_higher" | "average" | "independent";
    periods: string[]; weights?: Record<string, number>;
  };
  calendar?: { year: number };
  /** Regras de comunicação definidas pela escola (aluno só fala com adultos se a política permitir). */
  chat?: { studentToStaff?: boolean; guardianToStaff?: boolean; classGroups?: boolean; hoursFrom?: string; hoursTo?: string };
  /** Gamificação por escola: pode ser desligada; ranking é opcional. */
  gamification?: { enabled?: boolean; leaderboard?: boolean };
  /** Faixas de alerta do painel pedagógico. */
  risk?: { minAttendance?: number; minAverage?: number; maxLateTasks?: number };
};

/** Catálogo público de escolas (Inep/Censo Escolar). Escolha de busca é só contexto: não concede acesso. */
export const schools = pgTable("schools", {
  id: id(),
  inepCode: text("inep_code"),
  name: text("name").notNull(),
  nameNorm: text("name_norm").notNull(),
  city: text("city").notNull(),
  cityNorm: text("city_norm").notNull(),
  uf: text("uf").notNull(),
  neighborhood: text("neighborhood"),
  dependency: text("dependency"),
  source: text("source").notNull(),
  sourceYear: integer("source_year"),
  createdAt: created(),
}, (t) => [
  uniqueIndex("schools_inep_uq").on(t.inepCode),
  index("schools_uf_city_idx").on(t.uf, t.cityNorm),
  index("schools_name_trgm").using("gin", sql`${t.nameNorm} gin_trgm_ops`),
]);

export const orgs = pgTable("orgs", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // school | personal
  schoolId: uuid("school_id").references(() => schools.id),
  city: text("city"),
  uf: text("uf"),
  schoolManual: boolean("school_manual").notNull().default(false),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  settings: jsonb("settings").$type<OrgSettings>().notNull().default({}),
  createdAt: created(),
});

export const memberships = pgTable("memberships", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // admin | coordinator | teacher
  status: text("status").notNull().default("active"), // active | removed
  createdAt: created(),
}, (t) => [uniqueIndex("memberships_uq").on(t.orgId, t.userId)]);

export const invitations = pgTable("invitations", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  classIds: jsonb("class_ids").$type<string[]>().notNull().default([]),
  tokenHash: text("token_hash").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | revoked
  invitedBy: uuid("invited_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("invitations_token_uq").on(t.tokenHash)]);

/* ---------- Turmas ---------- */
export const classes = pgTable("classes", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  grade: text("grade").notNull(), // 6, 7, 8, 9, em1, em2, em3
  subject: text("subject").notNull().default("matematica"),
  year: integer("year").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: created(),
}, (t) => [index("classes_org_idx").on(t.orgId)]);

export const classTeachers = pgTable("class_teachers", {
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.classId, t.userId] })]);

export const students = pgTable("students", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  registration: text("registration"),
  createdAt: created(),
}, (t) => [index("students_org_idx").on(t.orgId)]);

export const enrollments = pgTable("enrollments", {
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"), // active | transferred
}, (t) => [primaryKey({ columns: [t.classId, t.studentId] })]);

/* ---------- Acervo ---------- */
export const questions = pgTable("questions", {
  id: id(),
  institution: text("institution").notNull(), // Inep, Etec, Fuvest, Comvest, Questeca
  exam: text("exam").notNull(),
  year: integer("year").notNull(),
  phase: text("phase"),
  day: text("day"),
  booklet: text("booklet"),
  number: integer("number"),
  page: integer("page"),
  sourceUrl: text("source_url"),
  subject: text("subject").notNull().default("matematica"),
  title: text("title").notNull(),
  statement: text("statement"), // null quando só referência
  alternatives: jsonb("alternatives").$type<{ key: string; text: string }[]>().notNull().default([]),
  answer: text("answer"),
  answerSource: text("answer_source"),
  status: text("status").notNull().default("curation"), // curation | reference_only | released | in_review | blocked
  licenseNote: text("license_note"),
  assessed: jsonb("assessed").$type<string[]>().notNull().default([]),
  prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
  methods: jsonb("methods").$type<string[]>().notNull().default([]),
  difficulty: integer("difficulty").notNull().default(3),
  estSeconds: integer("est_seconds").notNull().default(180),
  stimulusId: text("stimulus_id"),
  voided: boolean("voided").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: created(),
}, (t) => [index("questions_status_idx").on(t.status), index("questions_subject_idx").on(t.subject)]);

export const questionFlags = pgTable("question_flags", {
  id: id(),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  detail: text("detail"),
  status: text("status").notNull().default("open"), // open | resolved | dismissed
  resolution: text("resolution"),
  createdAt: created(),
});

export const questionChanges = pgTable("question_changes", {
  id: id(),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id),
  kind: text("kind").notNull(), // answer_changed | status_changed | text_changed
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: created(),
});

/* ---------- Avaliações ---------- */
export type Scope = { willFall: string[]; prerequisite: string[]; notTaught: string[]; confirm: string[]; sources?: Record<string, string> };

export const assessments = pgTable("assessments", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"), // draft | applied
  scope: jsonb("scope").$type<Scope>().notNull(),
  totalPoints: numeric("total_points", { precision: 6, scale: 2 }).notNull().default("10"),
  durationMin: integer("duration_min").notNull().default(50),
  wantedCount: integer("wanted_count").notNull().default(8),
  filters: jsonb("filters").$type<{ institutions?: string[]; yearFrom?: number; yearTo?: number; difficulty?: number[] }>().notNull().default({}),
  parentId: uuid("parent_id"), // segunda chamada → original
  revision: integer("revision").notNull().default(1),
  quotaCounted: boolean("quota_counted").notNull().default(false),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("assessments_org_idx").on(t.orgId)]);

export const assessmentItems = pgTable("assessment_items", {
  id: id(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  position: integer("position").notNull(),
  points: numeric("points", { precision: 6, scale: 2 }).notNull().default("1"),
  pinned: boolean("pinned").notNull().default(false),
  reason: text("reason"),
  manual: boolean("manual").notNull().default(false),
  scopeAck: boolean("scope_ack").notNull().default(false),
}, (t) => [index("assessment_items_idx").on(t.assessmentId)]);

export const assessmentHistory = pgTable("assessment_history", {
  id: id(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  label: text("label"),
  createdAt: created(),
});

export const assessmentVersions = pgTable("assessment_versions", {
  id: id(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  snapshot: jsonb("snapshot").notNull(), // itens, gabarito, pontos, cabeçalho, escopo
  createdAt: created(),
}, (t) => [uniqueIndex("assessment_versions_uq").on(t.assessmentId, t.number)]);

export const applications = pgTable("applications", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  assessmentId: uuid("assessment_id").references(() => assessments.id, { onDelete: "set null" }),
  versionId: uuid("version_id").references(() => assessmentVersions.id),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("regular"), // regular | second | external
  title: text("title").notNull(),
  appliedOn: date("applied_on").notNull(),
  external: jsonb("external").$type<{ answerKey: string[]; points: number[]; rubrics?: Record<number, { name: string; points: number }[]>; format?: string; version?: string } | null>(),
  parentApplicationId: uuid("parent_application_id"),
  createdAt: created(),
}, (t) => [index("applications_class_idx").on(t.classId)]);

export const responses = pgTable("responses", {
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  value: text("value"),
  status: text("status").notNull().default("answered"), // answered | blank | pending
  points: numeric("points", { precision: 6, scale: 2 }),
  rubric: jsonb("rubric").$type<Record<string, number>>(),
}, (t) => [primaryKey({ columns: [t.applicationId, t.studentId, t.position] })]);

export const studentPresence = pgTable("student_presence", {
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  state: text("state").notNull(), // present | absent
}, (t) => [primaryKey({ columns: [t.applicationId, t.studentId] })]);

export const answerSheets = pgTable("answer_sheets", {
  id: id(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending_review"), // pending_review | confirmed | rejected
  image: bytea("image"),
  contentType: text("content_type"),
  imageHash: text("image_hash").notNull(),
  detected: jsonb("detected").$type<{ answers: (string | null)[]; confidence: number[] } | null>(),
  note: text("note"),
  createdAt: created(),
}, (t) => [uniqueIndex("answer_sheets_hash_uq").on(t.applicationId, t.imageHash)]);

/* ---------- Notas ---------- */
export const gradeItems = pgTable("grade_items", {
  id: id(),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull().default("prova"),
  period: text("period").notNull(),
  weight: numeric("weight", { precision: 6, scale: 2 }).notNull().default("1"),
  maxPoints: numeric("max_points", { precision: 6, scale: 2 }).notNull().default("10"),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "set null" }),
  recovery: boolean("recovery").notNull().default(false),
  createdAt: created(),
}, (t) => [index("grade_items_class_idx").on(t.classId)]);

export const grades = pgTable("grades", {
  gradeItemId: uuid("grade_item_id").notNull().references(() => gradeItems.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  value: numeric("value", { precision: 6, scale: 2 }),
  state: text("state").notNull().default("pending"), // value | zero | absent | not_delivered | pending
  source: text("source").notNull().default("manual"), // manual | import | application | cards
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.gradeItemId, t.studentId] })]);

export const gradeChanges = pgTable("grade_changes", {
  id: id(),
  gradeItemId: uuid("grade_item_id").notNull().references(() => gradeItems.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  actorId: uuid("actor_id"),
  source: text("source"),
  reason: text("reason"),
  createdAt: created(),
});

export const periodCloses = pgTable("period_closes", {
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  closedBy: uuid("closed_by").references(() => users.id),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
  reopenedAt: timestamp("reopened_at", { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.classId, t.period] })]);

/* ---------- Pedagógico ---------- */
export const observations = pgTable("observations", {
  id: id(),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  visibility: text("visibility").notNull().default("private"), // private | school
  observedOn: date("observed_on").notNull(),
  createdAt: created(),
});

export const lessonLogs = pgTable("lesson_logs", {
  id: id(),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  taughtOn: date("taught_on").notNull(),
  content: text("content").notNull(),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  planned: boolean("planned").notNull().default(true),
  createdAt: created(),
});

export const docTemplates = pgTable("doc_templates", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // plano | diario | andamento | relatorio | conselho | familia
  title: text("title").notNull(),
  body: text("body").notNull(),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: created(),
});

export const documents = pgTable("documents", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  evidence: jsonb("evidence").$type<{ label: string; source: string }[]>().notNull().default([]),
  openGaps: jsonb("open_gaps").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("draft"), // draft | in_review | approved | returned
  reviewNote: text("review_note"),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  authorId: uuid("author_id").notNull().references(() => users.id),
  dueOn: date("due_on"),
  version: integer("version").notNull().default(1),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Comunidade ---------- */
export const posts = pgTable("posts", {
  id: id(),
  authorId: uuid("author_id").notNull().references(() => users.id),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }), // null = mural geral
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("duvida"), // duvida | material | pratica | avaliacao
  subject: text("subject"),
  grade: text("grade"),
  attachment: bytea("attachment"),
  attachmentName: text("attachment_name"),
  attachmentType: text("attachment_type"),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: created(),
}, (t) => [index("posts_org_idx").on(t.orgId)]);

export const comments = pgTable("comments", {
  id: id(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: created(),
});

export const savedPosts = pgTable("saved_posts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.userId, t.postId] })]);

export const postFlags = pgTable("post_flags", {
  id: id(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"), // open | actioned | dismissed
  action: text("action"),
  createdAt: created(),
});

export const userBlocks = pgTable("user_blocks", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason"),
  blockedBy: uuid("blocked_by").references(() => users.id),
  createdAt: created(),
}, (t) => [primaryKey({ columns: [t.userId] })]);

export const materials = pgTable("materials", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("teoria"), // teoria | planejamento | prova_exportada | outro
  text: text("text"),
  file: bytea("file"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fromPostId: uuid("from_post_id"),
  description: text("description"),
  url: text("url"),
  subject: text("subject"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  visibility: text("visibility").notNull().default("private"), // private | class | school
  approval: text("approval").notNull().default("approved"), // approved | pending | rejected
  approvedBy: uuid("approved_by").references(() => users.id),
  downloads: integer("downloads").notNull().default(0),
  createdAt: created(),
});

/* ---------- SaaS ---------- */
export const subscriptions = pgTable("subscriptions", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"), // free | teacher | school
  status: text("status").notNull().default("active"), // active | pending | past_due | canceled | canceling
  periodStart: timestamp("period_start", { withTimezone: true }).notNull().defaultNow(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  graceUntil: timestamp("grace_until", { withTimezone: true }),
  provider: text("provider").notNull().default("manual"),
  providerRef: text("provider_ref"),
  limits: jsonb("limits").$type<{ assemblies?: number; classes?: number; cards?: number }>(), // contrato escola
  schoolSeats: integer("school_seats"),
  createdAt: created(),
}, (t) => [uniqueIndex("subscriptions_org_uq").on(t.orgId)]);

export const usage = pgTable("usage", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // assembly | card
  key: text("key").notNull(),
  cycleStart: timestamp("cycle_start", { withTimezone: true }).notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("usage_key_uq").on(t.orgId, t.kind, t.key)]);

export const billingEvents = pgTable("billing_events", {
  id: text("id").primaryKey(), // id do evento no provedor (idempotência)
  orgId: uuid("org_id"),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  createdAt: created(),
});

export const invoices = pgTable("invoices", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull(), // paid | open | failed
  description: text("description").notNull(),
  createdAt: created(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // seguranca | pagamento | correcao | comunidade | sistema
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  priority: text("priority").notNull().default("normal"), // normal | high
  groupKey: text("group_key"),
  count: integer("count").notNull().default(1),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("notifications_user_idx").on(t.userId, t.readAt)]);

export const tickets = pgTable("tickets", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  orgId: uuid("org_id").references(() => orgs.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recordRef: text("record_ref"),
  status: text("status").notNull().default("open"), // open | in_progress | resolved
  createdAt: created(),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: uuid("actor_id"),
  orgId: uuid("org_id"),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta"),
  createdAt: created(),
}, (t) => [index("audit_org_idx").on(t.orgId)]);

export const events = pgTable("events", {
  id: id(),
  userId: uuid("user_id"),
  orgId: uuid("org_id"),
  name: text("name").notNull(),
  meta: jsonb("meta"),
  createdAt: created(),
});

export const demoRequests = pgTable("demo_requests", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  school: text("school").notNull(),
  message: text("message"),
  createdAt: created(),
});

/* ---------- Aplicação digital (P2): link individual por aluno, sem conta ---------- */
export const digitalLinks = pgTable("digital_links", {
  id: id(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex("digital_links_token_uq").on(t.token), uniqueIndex("digital_links_app_student_uq").on(t.applicationId, t.studentId)]);

/* ---------- Portais (aluno e responsável) ---------- */
/** Conta de aluno: uma pessoa, um estudante. Criada por convite de acesso. */
export const studentAccounts = pgTable("student_accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  createdAt: created(),
}, (t) => [primaryKey({ columns: [t.userId, t.studentId] }), uniqueIndex("student_accounts_student_uq").on(t.studentId)]);

export const guardianLinks = pgTable("guardian_links", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  relation: text("relation"),
  createdAt: created(),
}, (t) => [primaryKey({ columns: [t.userId, t.studentId] })]);

export const accessInvites = pgTable("access_invites", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // student | guardian
  relation: text("relation"),
  tokenHash: text("token_hash").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: uuid("used_by").references(() => users.id),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex("access_invites_token_uq").on(t.tokenHash), index("access_invites_student_idx").on(t.studentId)]);

/* ---------- Fase 1: frequência, tarefas, agenda e horários ---------- */
export const attendanceSessions = pgTable("attendance_sessions", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  date: date("date").notNull(),
  lesson: text("lesson").notNull().default(""), // "1ª aula"; vazio = chamada única do dia
  takenBy: uuid("taken_by").notNull().references(() => users.id),
  createdAt: created(),
}, (t) => [uniqueIndex("attendance_sessions_uq").on(t.classId, t.date, t.lesson), index("attendance_sessions_class_idx").on(t.classId, t.date)]);

export const attendanceRecords = pgTable("attendance_records", {
  sessionId: uuid("session_id").notNull().references(() => attendanceSessions.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // present | absent | justified
  note: text("note"),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.sessionId, t.studentId] })]);

export const attendanceChanges = pgTable("attendance_changes", {
  id: id(),
  sessionId: uuid("session_id").notNull().references(() => attendanceSessions.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull(),
  before: text("before"),
  after: text("after").notNull(),
  reason: text("reason").notNull(),
  changedBy: uuid("changed_by").notNull().references(() => users.id),
  createdAt: created(),
});

export type TaskQuestion = { id: string; type: "mc" | "text"; prompt: string; options?: string[]; answer?: number; points: number };
export const tasks = pgTable("tasks", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  kind: text("kind").notNull().default("assignment"), // assignment | form | resource
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  points: numeric("points", { precision: 6, scale: 2 }).notNull().default("10"),
  status: text("status").notNull().default("draft"), // draft | published | closed
  allowLate: boolean("allow_late").notNull().default(true),
  allowResubmit: boolean("allow_resubmit").notNull().default(false),
  questions: jsonb("questions").$type<TaskQuestion[]>().notNull().default([]),
  resourceUrl: text("resource_url"),
  gradeItemId: uuid("grade_item_id").references(() => gradeItems.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("tasks_class_idx").on(t.classId, t.status)]);

export const taskSubmissions = pgTable("task_submissions", {
  id: id(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("draft"), // draft | submitted | late | graded
  answerText: text("answer_text"),
  answers: jsonb("answers").$type<Record<string, string | number>>().notNull().default({}),
  autoScore: numeric("auto_score", { precision: 6, scale: 2 }),
  grade: numeric("grade", { precision: 6, scale: 2 }),
  feedback: text("feedback"),
  version: integer("version").notNull().default(0),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
  gradedBy: uuid("graded_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("task_submissions_uq").on(t.taskId, t.studentId)]);

export const submissionVersions = pgTable("submission_versions", {
  id: id(),
  submissionId: uuid("submission_id").notNull().references(() => taskSubmissions.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  answerText: text("answer_text"),
  answers: jsonb("answers").$type<Record<string, string | number>>().notNull().default({}),
  late: boolean("late").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskAttachments = pgTable("task_attachments", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  submissionId: uuid("submission_id").references(() => taskSubmissions.id, { onDelete: "cascade" }),
  postId: uuid("post_id"),
  messageId: uuid("message_id"),
  name: text("name").notNull(),
  type: text("type").notNull(),
  data: bytea("data").notNull(),
  createdAt: created(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(), // school | class | personal
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("evento"), // prova | trabalho | evento | feriado | reuniao | atividade
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  allDay: boolean("all_day").notNull().default(false),
  recurrence: jsonb("recurrence").$type<{ freq: "daily" | "weekly" | "monthly"; interval?: number; until: string } | null>(),
  reminderMin: integer("reminder_min"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: created(),
}, (t) => [index("calendar_events_org_idx").on(t.orgId, t.startsAt)]);

export const timetableSlots = pgTable("timetable_slots", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
  weekday: integer("weekday").notNull(), // 1 = segunda … 7 = domingo
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(),
  room: text("room"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: created(),
}, (t) => [index("timetable_org_idx").on(t.orgId, t.weekday)]);

/* ---------- Fase 2: sala de aula, videoaulas, chat ---------- */
export const classPosts = pgTable("class_posts", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  kind: text("kind").notNull().default("aviso"), // aviso | atividade | recurso | formulario
  title: text("title"),
  body: text("body").notNull(),
  linkUrl: text("link_url"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: created(),
}, (t) => [index("class_posts_class_idx").on(t.classId, t.createdAt)]);

export const classComments = pgTable("class_comments", {
  id: id(),
  postId: uuid("post_id").notNull().references(() => classPosts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  parentId: uuid("parent_id"),
  body: text("body").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("class_comments_post_idx").on(t.postId)]);

export const contentReports = pgTable("content_reports", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // comment | message
  targetId: uuid("target_id").notNull(),
  reporterId: uuid("reporter_id").notNull().references(() => users.id),
  reason: text("reason"),
  status: text("status").notNull().default("open"), // open | removed | dismissed
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex("content_reports_uq").on(t.targetType, t.targetId, t.reporterId)]);

export const videoLessons = pgTable("video_lessons", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  subject: text("subject"),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  durationMin: integer("duration_min"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  published: boolean("published").notNull().default(false),
  views: integer("views").notNull().default(0),
  createdAt: created(),
}, (t) => [index("video_lessons_org_idx").on(t.orgId, t.published)]);

export const videoViews = pgTable("video_views", {
  videoId: uuid("video_id").notNull().references(() => videoLessons.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  count: integer("count").notNull().default(1),
  lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.videoId, t.userId] })]);

export const conversations = pgTable("conversations", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // direct | group | class
  classId: uuid("class_id").references(() => classes.id, { onDelete: "cascade" }),
  title: text("title"),
  directKey: text("direct_key"), // "<userA>:<userB>" ordenado: uma conversa direta por par
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: created(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("conversations_direct_uq").on(t.orgId, t.directKey)]);

export const conversationMembers = pgTable("conversation_members", {
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  muted: boolean("muted").notNull().default(false),
  leftAt: timestamp("left_at", { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conversation_members_user_idx").on(t.userId)]);

export const messages = pgTable("messages", {
  id: id(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  replyToId: uuid("reply_to_id"),
  pinned: boolean("pinned").notNull().default(false),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("messages_conv_idx").on(t.conversationId, t.createdAt)]);

export const messageReactions = pgTable("message_reactions", {
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
}, (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })]);

export const chatBlocks = pgTable("chat_blocks", {
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  blockerId: uuid("blocker_id").references(() => users.id, { onDelete: "cascade" }), // null = bloqueio institucional
  blockedId: uuid("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: created(),
}, (t) => [uniqueIndex("chat_blocks_uq").on(t.orgId, t.blockedId, t.blockerId)]);

/* ---------- Fase 3: quizzes e gamificação ---------- */
export type QuizItem = { id: string; type: "mc" | "tf" | "text" | "challenge"; prompt: string; options?: string[]; answer?: number | boolean | string[]; explanation?: string; points: number };
export const quizzes = pgTable("quizzes", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft | published | closed
  timeLimitMin: integer("time_limit_min"),
  maxAttempts: integer("max_attempts").notNull().default(1),
  dueAt: timestamp("due_at", { withTimezone: true }),
  explanations: text("explanations").notNull().default("after_submit"), // after_submit | after_due | never
  aiGenerated: boolean("ai_generated").notNull().default(false),
  reviewed: boolean("reviewed").notNull().default(true),
  items: jsonb("items").$type<QuizItem[]>().notNull().default([]),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("quizzes_class_idx").on(t.classId, t.status)]);

export const quizAttempts = pgTable("quiz_attempts", {
  id: id(),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  attemptNo: integer("attempt_no").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  status: text("status").notNull().default("in_progress"), // in_progress | submitted | expired
  answers: jsonb("answers").$type<Record<string, string | number | boolean>>().notNull().default({}),
  manualScores: jsonb("manual_scores").$type<Record<string, number>>().notNull().default({}),
  score: numeric("score", { precision: 7, scale: 2 }),
  maxScore: numeric("max_score", { precision: 7, scale: 2 }),
  needsReview: boolean("needs_review").notNull().default(false),
}, (t) => [uniqueIndex("quiz_attempts_uq").on(t.quizId, t.studentId, t.attemptNo)]);

/** Extrato de XP: cada linha explica uma recompensa. `refKey` torna o evento idempotente (sem XP duplicado por reenvio, refresh ou repetição). */
export const xpEvents = pgTable("xp_events", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  points: integer("points").notNull(),
  refKey: text("ref_key").notNull(),
  day: date("day").notNull(),
  label: text("label").notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("xp_events_uq").on(t.studentId, t.refKey), index("xp_events_student_idx").on(t.studentId, t.day)]);

export const achievementUnlocks = pgTable("achievement_unlocks", {
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id").notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.studentId, t.achievementId] })]);

export const missionClaims = pgTable("mission_claims", {
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  missionId: text("mission_id").notNull(),
  periodKey: text("period_key").notNull(), // dia (YYYY-MM-DD) ou segunda-feira da semana
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.studentId, t.missionId, t.periodKey] })]);
