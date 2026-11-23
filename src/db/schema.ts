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
  prefs: jsonb("prefs").$type<{ notifyMarketing?: boolean; notifyCommunity?: boolean; largeFont?: boolean }>().notNull().default({}),
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
};

export const orgs = pgTable("orgs", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // school | personal
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
  external: jsonb("external").$type<{ answerKey: string[]; points: number[]; format?: string; version?: string } | null>(),
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
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: created(),
});

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
