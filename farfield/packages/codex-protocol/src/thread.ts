import { z } from "zod";
import {
  JsonValueSchema,
  NonEmptyStringSchema,
  NonNegativeIntSchema,
  NullableNonEmptyStringSchema,
  NullableStringSchema
} from "./common.js";
import { ProtocolValidationError } from "./errors.js";
import { ToolRequestUserInputResponseSchema } from "./generated/app-server/index.js";

export const CollaborationModeSettingsSchema = z
  .object({
    model: NullableStringSchema.optional(),
    reasoning_effort: NullableStringSchema.optional(),
    developer_instructions: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const CollaborationModeSchema = z
  .object({
    mode: NonEmptyStringSchema,
    settings: CollaborationModeSettingsSchema
  })
  .passthrough();

export const InputTextPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
    text_elements: z.array(JsonValueSchema).optional()
  })
  .passthrough();

export const InputImagePartSchema = z
  .object({
    type: z.literal("image"),
    url: z.string()
  })
  .passthrough();

export const InputPartSchema = z.union([InputTextPartSchema, InputImagePartSchema]);

export const TurnStartParamsSchema = z
  .object({
    threadId: NonEmptyStringSchema,
    input: z.array(InputPartSchema),
    cwd: NonEmptyStringSchema.optional(),
    model: NullableStringSchema.optional(),
    effort: NullableStringSchema.optional(),
    approvalPolicy: NonEmptyStringSchema.optional(),
    sandboxPolicy: z.object({ type: NonEmptyStringSchema }).passthrough().optional(),
    summary: z.string().optional(),
    attachments: z.array(JsonValueSchema).optional(),
    collaborationMode: z.union([CollaborationModeSchema, z.null()]).optional(),
    personality: z.union([JsonValueSchema, z.null()]).optional(),
    outputSchema: z.union([JsonValueSchema, z.null()]).optional()
  })
  .passthrough();

export const UserMessageContentPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
    text_elements: z.array(JsonValueSchema).optional()
  })
  .passthrough();

export const UserMessageImageContentPartSchema = z
  .object({
    type: z.literal("image"),
    url: z.string()
  })
  .passthrough();

export const UserMessagePartSchema = z.union([
  UserMessageContentPartSchema,
  UserMessageImageContentPartSchema
]);

export const UserMessageItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("userMessage"),
    content: z.array(UserMessagePartSchema)
  })
  .passthrough();

export const SteeringUserMessageItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("steeringUserMessage"),
    content: z.array(UserMessagePartSchema),
    attachments: z.array(JsonValueSchema).optional()
  })
  .passthrough();

export const AgentMessageItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("agentMessage"),
    text: z.string()
  })
  .passthrough();

export const ErrorItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("error"),
    message: z.string(),
    willRetry: z.boolean().optional(),
    errorInfo: z.union([z.string(), z.null()]).optional(),
    additionalDetails: z.union([JsonValueSchema, z.null()]).optional()
  })
  .passthrough();

export const ReasoningItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("reasoning"),
    summary: z.array(z.string()).optional(),
    content: z.array(JsonValueSchema).optional(),
    text: z.string().optional()
  })
  .passthrough();

export const PlanItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("plan"),
    text: z.string()
  })
  .passthrough();

export const PlanImplementationItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("planImplementation"),
    turnId: NonEmptyStringSchema,
    planContent: z.string(),
    isCompleted: z.boolean().optional()
  })
  .passthrough();

export const UserInputAnsweredQuestionSchema = z
  .object({
    id: NonEmptyStringSchema,
    header: z.string().optional(),
    question: z.string().optional()
  })
  .passthrough();

export const UserInputResponseItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    type: z.literal("userInputResponse"),
    requestId: NonNegativeIntSchema,
    turnId: NonEmptyStringSchema,
    questions: z.array(UserInputAnsweredQuestionSchema),
    answers: z.record(z.array(z.string())),
    completed: z.boolean().optional()
  })
  .passthrough();

export const CommandActionSchema = z
  .object({
    type: NonEmptyStringSchema,
    command: z.string().optional(),
    name: z.string().optional(),
    path: z.union([z.string(), z.null()]).optional(),
    query: z.string().optional()
  })
  .passthrough();

export const CommandExecutionItemSchema = z
  .object({
    type: z.literal("commandExecution"),
    id: NonEmptyStringSchema,
    command: z.string(),
    cwd: z.string().optional(),
    processId: z.string().optional(),
    status: NonEmptyStringSchema,
    commandActions: z.array(CommandActionSchema).optional(),
    aggregatedOutput: z.union([z.string(), z.null()]).optional(),
    exitCode: z.union([z.number().int(), z.null()]).optional(),
    durationMs: z.union([NonNegativeIntSchema, z.null()]).optional()
  })
  .passthrough();

export const FileChangeKindSchema = z
  .object({
    type: NonEmptyStringSchema,
    move_path: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const FileChangeEntrySchema = z
  .object({
    path: z.string(),
    kind: FileChangeKindSchema,
    diff: z.string().optional()
  })
  .passthrough();

export const FileChangeItemSchema = z
  .object({
    type: z.literal("fileChange"),
    id: NonEmptyStringSchema,
    changes: z.array(FileChangeEntrySchema),
    status: NonEmptyStringSchema
  })
  .passthrough();

export const ContextCompactionItemSchema = z
  .object({
    type: z.literal("contextCompaction"),
    id: NonEmptyStringSchema,
    completed: z.boolean().optional()
  })
  .passthrough();

export const WebSearchActionSchema = z
  .object({
    type: NonEmptyStringSchema,
    query: z.string().optional(),
    queries: z.array(z.string()).optional()
  })
  .passthrough();

export const WebSearchItemSchema = z
  .object({
    type: z.literal("webSearch"),
    id: NonEmptyStringSchema,
    query: z.string(),
    action: WebSearchActionSchema
  })
  .passthrough();

export const ModelChangedItemSchema = z
  .object({
    type: z.literal("modelChanged"),
    id: NonEmptyStringSchema,
    fromModel: NullableStringSchema.optional(),
    toModel: NullableStringSchema.optional()
  })
  .passthrough();

export const McpToolCallStatusSchema = z.enum(["inProgress", "completed", "failed"]);

export const McpToolCallResultSchema = z
  .object({
    content: z.array(JsonValueSchema),
    structuredContent: z.union([JsonValueSchema, z.null()]).optional()
  })
  .passthrough();

export const McpToolCallErrorSchema = z
  .object({
    message: z.string()
  })
  .passthrough();

export const McpToolCallItemSchema = z
  .object({
    type: z.literal("mcpToolCall"),
    id: NonEmptyStringSchema,
    server: z.string(),
    tool: z.string(),
    status: McpToolCallStatusSchema,
    arguments: JsonValueSchema,
    result: z.union([McpToolCallResultSchema, z.null()]).optional(),
    error: z.union([McpToolCallErrorSchema, z.null()]).optional(),
    durationMs: z.union([NonNegativeIntSchema, z.null()]).optional()
  })
  .passthrough();

export const CollabAgentToolSchema = z.enum([
  "spawnAgent",
  "sendInput",
  "resumeAgent",
  "wait",
  "closeAgent"
]);

export const CollabAgentStatusSchema = z.enum([
  "pendingInit",
  "running",
  "completed",
  "errored",
  "shutdown",
  "notFound"
]);

export const CollabAgentStateSchema = z
  .object({
    status: CollabAgentStatusSchema,
    message: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const CollabAgentToolCallStatusSchema = z.enum(["inProgress", "completed", "failed"]);

export const CollabAgentToolCallItemSchema = z
  .object({
    type: z.literal("collabAgentToolCall"),
    id: NonEmptyStringSchema,
    tool: CollabAgentToolSchema,
    status: CollabAgentToolCallStatusSchema,
    senderThreadId: z.string(),
    receiverThreadIds: z.array(z.string()),
    prompt: z.union([z.string(), z.null()]).optional(),
    agentsStates: z.record(CollabAgentStateSchema)
  })
  .passthrough();

export const ImageViewItemSchema = z
  .object({
    type: z.literal("imageView"),
    id: NonEmptyStringSchema,
    path: z.string()
  })
  .passthrough();

export const EnteredReviewModeItemSchema = z
  .object({
    type: z.literal("enteredReviewMode"),
    id: NonEmptyStringSchema,
    review: z.string()
  })
  .passthrough();

export const ExitedReviewModeItemSchema = z
  .object({
    type: z.literal("exitedReviewMode"),
    id: NonEmptyStringSchema,
    review: z.string()
  })
  .passthrough();

export const TurnItemSchema = z.discriminatedUnion("type", [
  UserMessageItemSchema,
  SteeringUserMessageItemSchema,
  AgentMessageItemSchema,
  ErrorItemSchema,
  ReasoningItemSchema,
  PlanItemSchema,
  PlanImplementationItemSchema,
  UserInputResponseItemSchema,
  CommandExecutionItemSchema,
  FileChangeItemSchema,
  ContextCompactionItemSchema,
  WebSearchItemSchema,
  McpToolCallItemSchema,
  CollabAgentToolCallItemSchema,
  ImageViewItemSchema,
  EnteredReviewModeItemSchema,
  ExitedReviewModeItemSchema,
  ModelChangedItemSchema
]);

export const UserInputOptionSchema = z
  .object({
    label: z.string(),
    description: z.string()
  })
  .passthrough();

export const UserInputQuestionSchema = z
  .object({
    id: NonEmptyStringSchema,
    header: z.string(),
    question: z.string(),
    isOther: z.boolean(),
    isSecret: z.boolean(),
    options: z.array(UserInputOptionSchema)
  })
  .passthrough();

export const UserInputRequestParamsSchema = z
  .object({
    threadId: NonEmptyStringSchema,
    turnId: NonEmptyStringSchema,
    itemId: NonEmptyStringSchema,
    questions: z.array(UserInputQuestionSchema)
  })
  .passthrough();

export const UserInputRequestSchema = z
  .object({
    method: z.literal("item/tool/requestUserInput"),
    id: NonNegativeIntSchema,
    params: UserInputRequestParamsSchema,
    completed: z.boolean().optional()
  })
  .passthrough();

export const CommandExecutionApprovalRequestParamsSchema = z
  .object({
    threadId: NonEmptyStringSchema,
    turnId: NonEmptyStringSchema,
    itemId: NonEmptyStringSchema,
    approvalId: z.union([z.string(), z.null()]).optional(),
    reason: z.union([z.string(), z.null()]).optional(),
    command: z.union([z.string(), z.null()]).optional(),
    cwd: z.union([z.string(), z.null()]).optional(),
    commandActions: z.union([z.array(CommandActionSchema), z.null()]).optional(),
    proposedExecpolicyAmendment: z.union([z.array(z.string()), z.null()]).optional()
  })
  .passthrough();

export const CommandExecutionApprovalRequestSchema = z
  .object({
    method: z.literal("item/commandExecution/requestApproval"),
    id: NonNegativeIntSchema,
    params: CommandExecutionApprovalRequestParamsSchema
  })
  .passthrough();

export const FileChangeApprovalRequestParamsSchema = z
  .object({
    threadId: NonEmptyStringSchema,
    turnId: NonEmptyStringSchema,
    itemId: NonEmptyStringSchema,
    reason: z.union([z.string(), z.null()]).optional(),
    grantRoot: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const FileChangeApprovalRequestSchema = z
  .object({
    method: z.literal("item/fileChange/requestApproval"),
    id: NonNegativeIntSchema,
    params: FileChangeApprovalRequestParamsSchema
  })
  .passthrough();

export const LegacyExecCommandApprovalRequestParamsSchema = z
  .object({
    callId: NonEmptyStringSchema,
    conversationId: NonEmptyStringSchema,
    command: z.array(z.string()),
    cwd: z.string(),
    parsedCmd: z.array(JsonValueSchema),
    approvalId: z.union([z.string(), z.null()]).optional(),
    reason: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const LegacyExecCommandApprovalRequestSchema = z
  .object({
    method: z.literal("execCommandApproval"),
    id: NonNegativeIntSchema,
    params: LegacyExecCommandApprovalRequestParamsSchema
  })
  .passthrough();

export const LegacyApplyPatchApprovalRequestParamsSchema = z
  .object({
    callId: NonEmptyStringSchema,
    conversationId: NonEmptyStringSchema,
    fileChanges: z.record(JsonValueSchema),
    grantRoot: z.union([z.string(), z.null()]).optional(),
    reason: z.union([z.string(), z.null()]).optional()
  })
  .passthrough();

export const LegacyApplyPatchApprovalRequestSchema = z
  .object({
    method: z.literal("applyPatchApproval"),
    id: NonNegativeIntSchema,
    params: LegacyApplyPatchApprovalRequestParamsSchema
  })
  .passthrough();

export const ThreadRequestSchema = z.discriminatedUnion("method", [
  UserInputRequestSchema,
  CommandExecutionApprovalRequestSchema,
  FileChangeApprovalRequestSchema,
  LegacyExecCommandApprovalRequestSchema,
  LegacyApplyPatchApprovalRequestSchema
]);

export const ThreadTurnSchema = z
  .object({
    params: TurnStartParamsSchema.optional(),
    turnId: z.union([NonEmptyStringSchema, z.null()]).optional(),
    id: NonEmptyStringSchema.optional(),
    status: NonEmptyStringSchema,
    turnStartedAtMs: z.union([NonNegativeIntSchema, z.null()]).optional(),
    finalAssistantStartedAtMs: z.union([NonNegativeIntSchema, z.null()]).optional(),
    error: z.union([JsonValueSchema, z.null()]).optional(),
    diff: z.union([JsonValueSchema, z.null()]).optional(),
    items: z.array(TurnItemSchema)
  })
  .passthrough();

export const ThreadConversationStateSchema = z
  .object({
    id: NonEmptyStringSchema,
    turns: z.array(ThreadTurnSchema),
    requests: z.array(ThreadRequestSchema).default([]),
    createdAt: NonNegativeIntSchema.optional(),
    updatedAt: NonNegativeIntSchema.optional(),
    title: NullableStringSchema.optional(),
    latestModel: NullableStringSchema.optional(),
    latestReasoningEffort: NullableStringSchema.optional(),
    previousTurnModel: NullableStringSchema.optional(),
    latestCollaborationMode: z.union([CollaborationModeSchema, z.null()]).optional(),
    hasUnreadTurn: z.boolean().optional(),
    rolloutPath: z.string().optional(),
    cwd: z.string().optional(),
    gitInfo: z.union([JsonValueSchema, z.null()]).optional(),
    resumeState: z.string().optional(),
    latestTokenUsageInfo: JsonValueSchema.optional(),
    source: z.string().optional()
  })
  .passthrough();

export const ThreadStreamPatchPathSegmentSchema = z.union([
  NonNegativeIntSchema,
  NonEmptyStringSchema
]);

export const ThreadStreamPatchSchema = z
  .object({
    op: z.enum(["add", "replace", "remove"]),
    path: z.array(ThreadStreamPatchPathSegmentSchema).min(1),
    value: JsonValueSchema.optional()
  })
  .passthrough()
  .superRefine((patch, ctx) => {
    const hasValue = Object.prototype.hasOwnProperty.call(patch, "value");

    if (patch.op === "remove" && hasValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "remove patches must not include value"
      });
    }

    if (patch.op !== "remove" && !hasValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${patch.op} patches must include value`
      });
    }
  });

export const ThreadStreamSnapshotChangeSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"snapshot">;
    conversationState: typeof ThreadConversationStateSchema;
  },
  "passthrough"
> = z
  .object({
    type: z.literal("snapshot"),
    conversationState: ThreadConversationStateSchema
  })
  .passthrough();

export const ThreadStreamPatchesChangeSchema: z.ZodObject<
  {
    type: z.ZodLiteral<"patches">;
    patches: z.ZodArray<typeof ThreadStreamPatchSchema>;
  },
  "passthrough"
> = z
  .object({
    type: z.literal("patches"),
    patches: z.array(ThreadStreamPatchSchema)
  })
  .passthrough();

export const ThreadStreamChangeSchema: z.ZodUnion<
  [typeof ThreadStreamSnapshotChangeSchema, typeof ThreadStreamPatchesChangeSchema]
> = z.union([ThreadStreamSnapshotChangeSchema, ThreadStreamPatchesChangeSchema]);

export const ThreadStreamStateChangedParamsSchema: z.ZodObject<
  {
    conversationId: typeof NonEmptyStringSchema;
    change: typeof ThreadStreamChangeSchema;
    version: typeof NonNegativeIntSchema;
    type: z.ZodLiteral<"thread-stream-state-changed">;
  },
  "passthrough"
> = z
  .object({
    conversationId: NonEmptyStringSchema,
    change: ThreadStreamChangeSchema,
    version: NonNegativeIntSchema,
    type: z.literal("thread-stream-state-changed")
  })
  .passthrough();

export type CollaborationMode = z.infer<typeof CollaborationModeSchema>;
export type TurnStartParams = z.infer<typeof TurnStartParamsSchema>;
export type UserInputRequest = z.infer<typeof UserInputRequestSchema>;
export type ThreadRequest = z.infer<typeof ThreadRequestSchema>;
export type ThreadConversationState = z.infer<typeof ThreadConversationStateSchema>;
export type ThreadStreamPatch = z.infer<typeof ThreadStreamPatchSchema>;
export type ThreadStreamStateChangedParams = z.infer<typeof ThreadStreamStateChangedParamsSchema>;

export function parseThreadConversationState(value: unknown): ThreadConversationState {
  const result = ThreadConversationStateSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("ThreadConversationState", result.error);
  }
  return result.data;
}

export function parseThreadStreamStateChangedParams(
  value: unknown
): ThreadStreamStateChangedParams {
  const result = ThreadStreamStateChangedParamsSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("ThreadStreamStateChangedParams", result.error);
  }
  return result.data;
}

export const UserInputAnswerSchema = z
  .object({
    answers: z.array(z.string())
  })
  .passthrough();

export const UserInputResponsePayloadSchema = ToolRequestUserInputResponseSchema.passthrough();

export type UserInputResponsePayload = z.infer<typeof UserInputResponsePayloadSchema>;

export const CommandExecutionApprovalDecisionSchema = z.union([
  z.literal("accept"),
  z.literal("acceptForSession"),
  z.object({
    acceptWithExecpolicyAmendment: z
      .object({
        execpolicy_amendment: z.array(z.string())
      })
      .strict()
  }),
  z.literal("decline"),
  z.literal("cancel")
]);

export const CommandExecutionApprovalResponsePayloadSchema = z
  .object({
    decision: CommandExecutionApprovalDecisionSchema
  })
  .strict();

export const FileChangeApprovalDecisionSchema = z.union([
  z.literal("accept"),
  z.literal("acceptForSession"),
  z.literal("decline"),
  z.literal("cancel")
]);

export const FileChangeApprovalResponsePayloadSchema = z
  .object({
    decision: FileChangeApprovalDecisionSchema
  })
  .strict();

export const LegacyReviewDecisionSchema = z.union([
  z.literal("approved"),
  z.object({
    approved_execpolicy_amendment: z
      .object({
        proposed_execpolicy_amendment: z.array(z.string())
      })
      .strict()
  }),
  z.literal("approved_for_session"),
  z.literal("denied"),
  z.literal("abort")
]);

export const LegacyExecCommandApprovalResponsePayloadSchema = z
  .object({
    decision: LegacyReviewDecisionSchema
  })
  .strict();

export const LegacyApplyPatchApprovalResponsePayloadSchema = z
  .object({
    decision: LegacyReviewDecisionSchema
  })
  .strict();

export const ThreadRequestResponsePayloadSchema = z.union([
  UserInputResponsePayloadSchema,
  CommandExecutionApprovalResponsePayloadSchema,
  FileChangeApprovalResponsePayloadSchema,
  LegacyExecCommandApprovalResponsePayloadSchema,
  LegacyApplyPatchApprovalResponsePayloadSchema
]);

export type ThreadRequestResponsePayload = z.infer<typeof ThreadRequestResponsePayloadSchema>;

export function parseUserInputResponsePayload(value: unknown): UserInputResponsePayload {
  const result = UserInputResponsePayloadSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("UserInputResponsePayload", result.error);
  }
  return result.data;
}

export function parseThreadRequestResponsePayload(value: unknown): ThreadRequestResponsePayload {
  const result = ThreadRequestResponsePayloadSchema.safeParse(value);
  if (!result.success) {
    throw ProtocolValidationError.fromZod("ThreadRequestResponsePayload", result.error);
  }
  return result.data;
}
