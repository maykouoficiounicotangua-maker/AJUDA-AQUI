/** Esquemas Zod — fonte única de validação (formulários, server actions e route handlers). */
import { z } from "zod";
import { isInPast } from "@/lib/utils/time";

/** Remove caracteres de controle e normaliza espaços. React já escapa HTML; isto evita lixo invisível. */
export function sanitizeText(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

const text = (min: number, max: number, label: string) =>
  z.string({ error: `${label} é obrigatório` })
    .transform(sanitizeText)
    .pipe(z.string().min(min, `${label}: mínimo de ${min} caracteres`).max(max, `${label}: máximo de ${max} caracteres`));

const optionalText = (max: number, label: string) =>
  z.string().transform(sanitizeText).pipe(z.string().max(max, `${label}: máximo de ${max} caracteres`))
    .optional().transform((v) => (v ? v : undefined));

export const uuid = z.string().uuid("Identificador inválido");
export const phoneSchema = z.string().regex(/^\+?[0-9 ()\-]{8,20}$/, "Informe um telefone válido, com DDD");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

// ---------- AUTH ----------
export const passwordSchema = z.string()
  .min(8, "A senha precisa ter ao menos 8 caracteres")
  .max(72, "A senha pode ter no máximo 72 caracteres")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e números na senha");

export const signUpSchema = z.object({
  fullName: text(3, 120, "Nome completo").refine((v) => v.includes(" "), "Informe nome e sobrenome"),
  email: z.email("Informe um e-mail válido").max(254).transform((v) => v.toLowerCase().trim()),
  phone: phoneSchema,
  password: passwordSchema,
  state: text(2, 60, "Estado"),
  city: text(2, 120, "Cidade"),
  neighborhood: optionalText(120, "Bairro/região"),
  acceptTerms: z.literal(true, { error: "Você precisa aceitar os termos para continuar" }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email("Informe um e-mail válido").transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, "Informe sua senha"),
});

export const forgotPasswordSchema = z.object({ email: z.email("Informe um e-mail válido") });
export const resetPasswordSchema = z.object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não coincidem" });

// ---------- PERFIL ----------
export const profileUpdateSchema = z.object({
  fullName: text(3, 120, "Nome"),
  phone: phoneSchema.or(z.literal("")).optional(),
  bio: optionalText(500, "Sobre você"),
  state: text(2, 60, "Estado"),
  city: text(2, 120, "Cidade"),
  neighborhood: optionalText(120, "Bairro/região"),
  categoryIds: z.array(uuid).max(12),
});

export const helperPrefsSchema = z.object({
  description: optionalText(500, "Descrição"),
  maxDistanceKm: z.coerce.number().int().min(1).max(500),
  acceptsPaid: z.boolean(),
  acceptsFree: z.boolean(),
  acceptsExchange: z.boolean(),
  availableDays: z.array(z.number().int().min(0).max(6)).min(1, "Escolha ao menos um dia"),
  availabilityStart: timeSchema,
  availabilityEnd: timeSchema,
  active: z.boolean(),
}).refine((v) => v.availabilityEnd > v.availabilityStart, { path: ["availabilityEnd"], message: "O fim precisa ser depois do início" })
  .refine((v) => v.acceptsPaid || v.acceptsFree || v.acceptsExchange, { path: ["acceptsFree"], message: "Aceite ao menos um tipo de ajuda" });

export const privacySchema = z.object({
  profileVisibility: z.enum(["PUBLIC", "PRIVATE"]),
  showRating: z.boolean(),
  showHelpCount: z.boolean(),
});

// ---------- PEDIDO ----------
export const requestInputSchema = z.object({
  categoryId: uuid,
  title: text(5, 100, "Título"),
  description: text(10, 1000, "Descrição"),
  scheduledDate: dateSchema,
  scheduledTime: timeSchema,
  durationMinutes: z.coerce.number().int().min(5, "Duração mínima: 5 min").max(1440),
  state: text(2, 60, "Estado"),
  city: text(2, 120, "Cidade"),
  neighborhood: optionalText(120, "Bairro/região"),
  address: optionalText(300, "Endereço"),
  helpType: z.enum(["FREE", "PAID", "EXCHANGE"]),
  amountCents: z.coerce.number().int().min(100, "Valor mínimo: R$ 1,00").max(100_000_000).optional(),
  exchangeDescription: optionalText(300, "Descrição da troca"),
}).superRefine((v, ctx) => {
  if (v.helpType === "PAID" && !v.amountCents) ctx.addIssue({ code: "custom", path: ["amountCents"], message: "Informe o valor" });
  if (v.helpType === "EXCHANGE" && (!v.exchangeDescription || v.exchangeDescription.length < 3))
    ctx.addIssue({ code: "custom", path: ["exchangeDescription"], message: "Descreva a troca" });
  if (v.scheduledDate && v.scheduledTime && isInPast(v.scheduledDate, v.scheduledTime))
    ctx.addIssue({ code: "custom", path: ["scheduledDate"], message: "Escolha uma data e horário que ainda não passaram" });
});
export type RequestInput = z.infer<typeof requestInputSchema>;

/** Validação por etapa do wizard (mesmos campos do schema completo). */
export const WIZARD_STEP_FIELDS = [
  ["categoryId", "title"],
  ["description"],
  ["scheduledDate", "scheduledTime", "durationMinutes"],
  ["state", "city", "neighborhood", "address"],
  ["helpType", "amountCents", "exchangeDescription"],
] as const;

// ---------- INTERAÇÕES ----------
export const offerMessageSchema = z.object({ message: text(5, 500, "Mensagem") });
export const chatMessageSchema = z.object({ content: text(1, 2000, "Mensagem") });

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Escolha de 1 a 5 estrelas").max(5),
  comment: optionalText(500, "Comentário"),
  punctuality: z.coerce.number().int().min(1).max(5).optional(),
  respect: z.coerce.number().int().min(1).max(5).optional(),
  communication: z.coerce.number().int().min(1).max(5).optional(),
  fulfillment: z.coerce.number().int().min(1).max(5).optional(),
});

export const REPORT_REASONS = {
  INAPPROPRIATE_BEHAVIOR: "Comportamento inadequado",
  SCAM_ATTEMPT: "Tentativa de golpe",
  HARASSMENT: "Assédio",
  ILLEGAL_ACTIVITY: "Atividade ilegal",
  FALSE_INFORMATION: "Informação falsa",
  THREAT: "Ameaça",
  OTHER: "Outro",
} as const;

export const reportSchema = z.object({
  reportedUserId: uuid,
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS, ...(keyof typeof REPORT_REASONS)[]]),
  description: text(10, 1000, "Descrição"),
  requestId: uuid.optional(),
  conversationId: uuid.optional(),
});

export const disputeSchema = z.object({
  requestId: uuid,
  reason: text(3, 100, "Motivo"),
  description: text(10, 1000, "Descrição"),
});

// ---------- NOTIFICAÇÕES / PUSH ----------
export const notificationPrefsSchema = z.object({
  in_app_enabled: z.boolean(),
  push_enabled: z.boolean(),
  pref_matches: z.boolean(),
  pref_messages: z.boolean(),
  pref_offers: z.boolean(),
  pref_requests: z.boolean(),
  pref_reviews: z.boolean(),
  pref_system: z.boolean(),
}).partial();

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine((u) => u.startsWith("https://"), "Endpoint deve ser HTTPS"),
  keys: z.object({
    p256dh: z.string().min(10).max(256),
    auth: z.string().min(10).max(128),
  }),
  deviceType: z.enum(["desktop", "mobile", "tablet", "unknown"]).default("unknown"),
  browser: z.string().max(60).optional(),
});
export const pushUnsubscribeSchema = z.object({ endpoint: z.string().url().max(2048) });

// ---------- ADMIN ----------
export const categorySchema = z.object({
  name: text(2, 60, "Nome"),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens"),
  icon: z.string().min(1).max(40),
  description: optionalText(300, "Descrição"),
});

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
