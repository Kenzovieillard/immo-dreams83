import { z } from "zod";

export const commercialPipelineStages = [
  "BUYER_NEW",
  "BUYER_QUALIFIED",
  "BUYER_VISIT",
  "BUYER_OFFER",
  "BUYER_COMPROMISE",
  "BUYER_FINALIZED",
  "SELLER_NEW",
  "SELLER_CONTACT",
  "SELLER_ESTIMATE_SCHEDULED",
  "SELLER_ESTIMATE_DONE",
  "SELLER_MANDATE_PROPOSED",
  "SELLER_MANDATE_SIGNED",
  "SELLER_MARKETED",
] as const;

export const commercialPipelineKinds = ["BUYER", "SELLER"] as const;
export const commercialPriorities = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;
export const commercialTaskStatuses = [
  "TODO",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export const commercialVisitStatuses = [
  "TO_CONFIRM",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const commercialVisitNextActions = [
  "CREATE_OFFER",
  "PLAN_SECOND_VISIT",
  "FOLLOW_UP_LATER",
  "NO_FOLLOW_UP",
] as const;
export const commercialOfferStatuses = [
  "DRAFT",
  "TO_BE_SIGNED",
  "SIGNED_BY_BUYER",
  "SENT_TO_SELLER",
  "NEGOTIATING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
] as const;

const optionalUuid = z.string().uuid().nullable().optional();

export const pipelineMoveSchema = z.object({
  action: z.literal("move-stage"),
  id: z.string().uuid(),
  stage: z.enum(commercialPipelineStages),
});

export const pipelineCaseCreateSchema = z.object({
  action: z.literal("create-case"),
  contactId: z.string().uuid(),
  pipelineType: z.enum(commercialPipelineKinds),
  assignedTo: optionalUuid,
  propertyId: optionalUuid,
  estimationId: optionalUuid,
  priority: z.enum(commercialPriorities).default("normal"),
  title: z.string().trim().min(2).max(180),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export const pipelineMandateCreateSchema = z.object({
  action: z.literal("create-mandate"),
  leadId: z.string().uuid(),
  propertyId: z.string().uuid(),
  mandateType: z.enum(["simple", "exclusive", "semi-exclusive"]),
  status: z.enum(["draft", "proposed", "signed"]).default("draft"),
  signedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const pipelineTaskCreateSchema = z.object({
  action: z.literal("create-task"),
  leadId: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(commercialPriorities).default("normal"),
  assignedTo: optionalUuid,
  appointmentId: optionalUuid,
  offerId: optionalUuid,
});

export const pipelineTaskUpdateSchema = z.object({
  action: z.literal("update-task"),
  id: z.string().uuid(),
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(commercialPriorities).optional(),
  assignedTo: optionalUuid,
  status: z.enum(commercialTaskStatuses).optional(),
});

export const pipelineTaskArchiveSchema = z.object({
  action: z.literal("archive-task"),
  id: z.string().uuid(),
});

export const pipelineMutationSchema = z.discriminatedUnion("action", [
  pipelineMoveSchema,
  pipelineCaseCreateSchema,
  pipelineMandateCreateSchema,
  pipelineTaskCreateSchema,
  pipelineTaskUpdateSchema,
  pipelineTaskArchiveSchema,
]);

export const estimationCreateSchema = z.object({
  action: z.literal("create"),
  contactId: z.string().uuid(),
  assignedTo: z.string().uuid(),
  propertyAddress: z.string().trim().min(3).max(300),
  city: z.string().trim().min(2).max(120),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/),
  propertyType: z.string().trim().min(2).max(80),
  surface: z.number().positive().max(100000),
  rooms: z.number().int().positive().max(100).nullable().optional(),
  constructionYear: z
    .number()
    .int()
    .min(1500)
    .max(new Date().getFullYear() + 2)
    .nullable()
    .optional(),
  propertyCondition: z.string().trim().max(120).nullable().optional(),
  appointmentAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480),
  appointmentLocation: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export const estimationUpdateSchema = estimationCreateSchema
  .omit({ action: true, contactId: true })
  .partial()
  .extend({
    action: z.literal("update"),
    id: z.string().uuid(),
    contactId: z.string().uuid().optional(),
    commercialStatus: z
      .enum([
        "NEW_REQUEST",
        "TO_CONTACT",
        "SCHEDULED",
        "COMPLETED",
        "REPORT_SENT",
        "NO_FOLLOW_UP",
        "FINISHED",
      ])
      .optional(),
    estimatedValue: z.number().positive().nullable().optional(),
    estimateLow: z.number().positive().nullable().optional(),
    estimateHigh: z.number().positive().nullable().optional(),
  });

export const estimationTransformSchema = z.object({
  action: z.literal("transform"),
  id: z.string().uuid(),
  listingPrice: z.number().positive(),
  mandateType: z.enum(["simple", "exclusive", "semi-exclusive"]),
});

export const estimationGenerateReportSchema = z.object({
  action: z.literal("generate-report"),
  id: z.string().uuid(),
});

export const estimationMutationSchema = z.discriminatedUnion("action", [
  estimationCreateSchema,
  estimationUpdateSchema,
  estimationTransformSchema,
  estimationGenerateReportSchema,
]);

export const visitCreateSchema = z
  .object({
    action: z.literal("create"),
    propertyId: z.string().uuid(),
    contactId: z.string().uuid(),
    leadId: z.string().uuid().nullable().optional(),
    assignedTo: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().optional(),
    location: z.string().trim().max(300).nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => !value.endsAt || value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "La fin de visite doit être postérieure au début.",
  });

export const visitStatusSchema = z.object({
  action: z.literal("set-status"),
  id: z.string().uuid(),
  status: z.enum(commercialVisitStatuses),
});

export const visitRescheduleSchema = z
  .object({
    action: z.literal("reschedule"),
    id: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().optional(),
  })
  .refine((value) => !value.endsAt || value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "La fin de visite doit être postérieure au début.",
  });

export const visitReportSchema = z
  .object({
    action: z.literal("submit-report"),
    id: z.string().uuid(),
    generalImpression: z.enum(["POSITIVE", "MIXED", "NEGATIVE"]),
    positivePoints: z.array(z.string().trim().min(1).max(120)).max(30),
    blockingPoints: z.array(z.string().trim().min(1).max(120)).max(30),
    interestLevel: z.number().int().min(1).max(5),
    comments: z.string().trim().min(4).max(4000),
    nextAction: z.enum(commercialVisitNextActions),
    followUpAt: z.string().datetime().nullable().optional(),
  })
  .refine(
    (value) =>
      value.nextAction !== "FOLLOW_UP_LATER" || Boolean(value.followUpAt),
    {
      path: ["followUpAt"],
      message: "La date de relance est obligatoire pour relancer plus tard.",
    },
  );

export const visitMutationSchema = z.discriminatedUnion("action", [
  visitCreateSchema,
  visitStatusSchema,
  visitRescheduleSchema,
  visitReportSchema,
]);

export const offerCreateSchema = z
  .object({
    action: z.literal("create"),
    submission: z.enum(["draft", "create"]),
    propertyId: z.string().uuid(),
    buyerDossierId: z.string().uuid(),
    buyerContactId: z.string().uuid(),
    visitId: z.string().uuid().nullable().optional(),
    responsibleUserId: z.string().uuid(),
    amount: z.number().positive(),
    offerDate: z.string().date(),
    validUntil: z.string().date(),
    financingType: z.enum(["CASH", "LOAN", "MIXED", "UNKNOWN"]),
    downPaymentAmount: z.number().nonnegative().nullable().optional(),
    loanAmount: z.number().nonnegative().nullable().optional(),
    suspensiveConditions: z.string().trim().max(4000).nullable().optional(),
    includedFurniture: z.string().trim().max(4000).nullable().optional(),
    negotiationComment: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => value.validUntil >= value.offerDate, {
    path: ["validUntil"],
    message: "La date de validité doit suivre la date de l'offre.",
  });

export const offerStatusSchema = z.object({
  action: z.literal("set-status"),
  id: z.string().uuid(),
  status: z.enum(commercialOfferStatuses),
  reason: z.string().trim().max(1000).nullable().optional(),
});

export const offerMutationSchema = z.discriminatedUnion("action", [
  offerCreateSchema,
  offerStatusSchema,
]);

export function normalizeCommercialPrefill(params: URLSearchParams) {
  const propertyId = params.get("bien_id") ?? params.get("bien");
  const contactId = params.get("contact_id") ?? params.get("acq");
  const visitId = params.get("visite_id");
  const uuid = z.string().uuid();
  return {
    propertyId: uuid.safeParse(propertyId).success ? propertyId : null,
    contactId: uuid.safeParse(contactId).success ? contactId : null,
    visitId: uuid.safeParse(visitId).success ? visitId : null,
  };
}
