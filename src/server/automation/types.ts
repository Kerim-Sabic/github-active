import { z } from "zod";

export const TrackSchema = z.enum([
  "frontend",
  "backend",
  "devops",
  "security",
  "ai",
  "data",
  "systems"
]);

export const CatchUpPolicySchema = z.enum(["skip", "limited", "full"]);
export const IntensitySchema = z.enum(["quiet", "steady", "active", "sprint"]);

export const ContentKindSchema = z.enum([
  "journal",
  "snippet",
  "resource",
  "config",
  "test",
  "project-log"
]);

export const AutomationConfigSchema = z.object({
  repo: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    fullName: z.string().min(3)
  }),
  branch: z.string().min(1).default("main"),
  timezone: z.string().min(1).default("UTC"),
  activeDays: z.array(z.number().int().min(0).max(6)).min(1).default([1, 2, 3, 4, 5]),
  quietHours: z
    .object({
      start: z.number().int().min(0).max(23),
      end: z.number().int().min(0).max(23)
    })
    .default({ start: 22, end: 7 }),
  intensity: IntensitySchema.default("steady"),
  maxDailyCommits: z.number().int().min(1).max(12).default(4),
  contentMix: z
    .partialRecord(ContentKindSchema, z.number().min(0).max(1))
    .default({ journal: 0.34, snippet: 0.24, resource: 0.16, config: 0.08, test: 0.1, "project-log": 0.08 }),
  tracks: z.array(TrackSchema).min(1).default(["frontend", "backend"]),
  catchUpPolicy: CatchUpPolicySchema.default("limited"),
  authorName: z.string().min(1),
  authorEmail: z.string().email()
});

export const ScheduleInputSchema = z.object({
  name: z.string().min(1).max(80).default("Developer journal"),
  repositoryId: z.string().uuid().optional(),
  installationId: z.string().uuid().optional(),
  config: AutomationConfigSchema
});

export const PatchScheduleSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  config: AutomationConfigSchema.optional()
});

export const PauseScheduleSchema = z.object({
  paused: z.boolean()
});

export const PreviewCommitSchema = z.object({
  config: AutomationConfigSchema,
  seed: z.string().optional()
});

export const RunNowSchema = z.object({
  scheduleId: z.string().uuid()
});

export const GeneratedCommitSchema = z.object({
  path: z.string().min(1),
  message: z.string().min(1),
  content: z.string().min(1),
  kind: ContentKindSchema,
  track: TrackSchema,
  idempotencyKey: z.string().min(1)
});

export type Track = z.infer<typeof TrackSchema>;
export type ContentKind = z.infer<typeof ContentKindSchema>;
export type AutomationConfig = z.infer<typeof AutomationConfigSchema>;
export type ScheduleInput = z.infer<typeof ScheduleInputSchema>;
export type GeneratedCommit = z.infer<typeof GeneratedCommitSchema>;
