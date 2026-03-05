import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import { useThread } from "@/src/hooks/useThread";
import { useThreadLiveState } from "@/src/hooks/useThreadLiveState";
import { useCollaborationModes } from "@/src/hooks/useCollaborationModes";
import {
  useSendMessage,
  useSetCollaborationMode,
  useSubmitUserInput,
} from "@/src/hooks/useThreadMutations";
import { useLiveUpdates } from "@/src/live/useLiveUpdates";
import type { PendingApproval } from "@/src/api/approvals";
import type {
  PendingUserInputRequest,
  UserInputQuestion,
} from "@/src/api/live-state";
import type { CollaborationModeListItem } from "@/src/api/collaboration";
import { FarfieldClientError } from "@/src/api/errors";
import type { ThreadDetailEnvelope } from "@/src/api/threads";
import type { SseStatus } from "@/src/hooks/useSseConnection";

/**
 * Thread Detail screen — MVP chat surface with Phase 07 collaboration controls.
 *
 * Reads:
 *   - GET /api/threads/:id
 *   - GET /api/threads/:id/pending-approvals
 *   - GET /api/threads/:id/live-state
 *   - GET /api/collaboration-modes
 *
 * Mutations:
 *   - POST /api/threads/:id/messages
 *   - POST /api/threads/:id/collaboration-mode
 *   - POST /api/threads/:id/user-input
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(epochMs: number | undefined): string {
  if (!epochMs) return "";
  const delta = Date.now() - epochMs;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function extractTurnText(turn: ThreadDetailEnvelope["thread"]["turns"][number]): string {
  const parts: string[] = [];
  for (const item of turn.items) {
    if (item.type === "userMessage" || item.type === "steeringUserMessage") {
      for (const part of item.content ?? []) {
        if (part.type === "text" && typeof part.text === "string") {
          parts.push(part.text);
        }
      }
    } else if (item.type === "agentMessage" && typeof item.text === "string") {
      parts.push(item.text);
    } else if (item.type === "plan" && typeof item.text === "string") {
      parts.push(`[Plan] ${item.text}`);
    } else if (item.type === "error" && typeof item.message === "string") {
      parts.push(`[Error] ${item.message}`);
    }
  }
  return parts.join("\n\n").trim();
}

function isUserTurn(turn: ThreadDetailEnvelope["thread"]["turns"][number]): boolean {
  return turn.items.some(
    (item) => item.type === "userMessage" || item.type === "steeringUserMessage"
  );
}

function approvalTypeLabel(type: PendingApproval["type"]): string {
  switch (type) {
    case "command":
      return "Command";
    case "file-change":
      return "File Change";
    case "apply-patch":
      return "Apply Patch";
  }
}

function formatModeLabel(mode: string | null | undefined): string {
  if (!mode || mode.trim().length === 0) return "Unknown";
  return mode;
}

function toModePayload(
  preset: CollaborationModeListItem,
  fallbackMode: string
): {
  mode: string;
  settings: {
    model?: string | null;
    reasoning_effort?: string | null;
    developer_instructions?: string | null;
  };
} {
  const mode =
    typeof preset.mode === "string" && preset.mode.trim().length > 0
      ? preset.mode
      : fallbackMode;

  return {
    mode,
    settings: {
      model: preset.model ?? null,
      reasoning_effort: preset.reasoning_effort ?? null,
      developer_instructions: preset.developer_instructions ?? null,
    },
  };
}

function liveSyncChipProps(status: SseStatus): { color: string; label: string } | null {
  switch (status) {
    case "connected":
      return { color: "#34C759", label: "Live" };
    case "reconnecting":
      return { color: "#FF9500", label: "Reconnecting — pull to refresh" };
    case "paused":
      return { color: "#8E8E93", label: "Paused" };
    case "error":
      return { color: "#FF9500", label: "Disconnected — pull to refresh" };
    case "connecting":
      return { color: "#8E8E93", label: "Connecting…" };
    case "idle":
    default:
      return null;
  }
}

interface QuestionDraft {
  selectedOption: string | null;
  otherText: string;
}

function emptyQuestionDraft(): QuestionDraft {
  return { selectedOption: null, otherText: "" };
}

function questionAnswers(question: UserInputQuestion, draft: QuestionDraft): string[] {
  const other = draft.otherText.trim();
  if (question.isOther && other.length > 0) {
    return [other];
  }

  if (draft.selectedOption && draft.selectedOption.trim().length > 0) {
    return [draft.selectedOption];
  }

  return [];
}

function requestIsReady(
  request: PendingUserInputRequest,
  draftMap: Record<string, QuestionDraft> | undefined
): boolean {
  return request.questions.every((question) => {
    const draft = draftMap?.[question.id] ?? emptyQuestionDraft();
    return questionAnswers(question, draft).length > 0;
  });
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof FarfieldClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type Turn = ThreadDetailEnvelope["thread"]["turns"][number];

function TurnCard({ turn }: { turn: Turn }) {
  const text = extractTurnText(turn);
  const startedAt =
    typeof turn.turnStartedAtMs === "number" ? turn.turnStartedAtMs : undefined;
  const fromUser = isUserTurn(turn);

  return (
    <View style={[styles.turnCard, fromUser ? styles.turnCardUser : styles.turnCardAgent]}>
      <View style={styles.turnCardHeader}>
        <Text style={[styles.turnRole, fromUser ? styles.turnRoleUser : styles.turnRoleAgent]}>
          {fromUser ? "You" : "Agent"}
        </Text>
        <View style={styles.turnMeta}>
          {startedAt ? (
            <Text style={styles.turnTime}>{formatRelativeTime(startedAt)}</Text>
          ) : null}
          <View
            style={[
              styles.turnStatusBadge,
              turn.status === "completed"
                ? styles.statusCompleted
                : turn.status === "inProgress"
                  ? styles.statusInProgress
                  : styles.statusOther,
            ]}
          >
            <Text style={styles.turnStatusText}>{turn.status}</Text>
          </View>
        </View>
      </View>
      {text ? (
        <Text style={styles.turnText}>{text}</Text>
      ) : (
        <Text style={styles.turnEmpty}>(no text content)</Text>
      )}
    </View>
  );
}

function ApprovalCard({ approval }: { approval: PendingApproval }) {
  return (
    <View style={styles.approvalCard}>
      <View style={styles.approvalHeader}>
        <View style={styles.approvalTypeBadge}>
          <Text style={styles.approvalTypeBadgeText}>{approvalTypeLabel(approval.type)}</Text>
        </View>
      </View>
      <Text style={styles.approvalSummary}>{approval.summary}</Text>
      {approval.detail.command ? (
        <Text style={styles.approvalDetail} numberOfLines={3}>
          {String(approval.detail.command)}
        </Text>
      ) : null}
      {approval.detail.reason ? (
        <Text style={styles.approvalReason}>{String(approval.detail.reason)}</Text>
      ) : null}
      <Text style={styles.approvalNote}>Approve/deny controls available in Phase 06.</Text>
    </View>
  );
}

function LiveSyncChip({ status }: { status: SseStatus }) {
  const props = liveSyncChipProps(status);
  if (!props) return null;
  return (
    <View style={[styles.liveSyncChip, { backgroundColor: props.color }]}> 
      <Text style={styles.liveSyncChipText}>{props.label}</Text>
    </View>
  );
}

interface ComposerProps {
  threadId: string;
  onSent: () => void;
}

function Composer({ threadId, onSent }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const sendMutation = useSendMessage();
  const isPending = sendMutation.isPending;

  function handleSend() {
    const text = draft.trim();
    if (!text || isPending) return;

    sendMutation.mutate(
      { threadId, body: { text } },
      {
        onSuccess: () => {
          setDraft("");
          onSent();
        },
      }
    );
  }

  return (
    <View style={styles.composerContainer}>
      {sendMutation.isError ? (
        <Text style={styles.sendError} numberOfLines={2}>
          {errorMessage(sendMutation.error, "Failed to send. Please try again.")}
        </Text>
      ) : null}
      <View style={styles.composerRow}>
        <TextInput
          style={styles.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor="#C7C7CC"
          multiline
          maxLength={4000}
          editable={!isPending}
          returnKeyType="default"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || isPending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || isPending}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface UserInputCardProps {
  request: PendingUserInputRequest;
  draftMap: Record<string, QuestionDraft> | undefined;
  isSubmitting: boolean;
  errorText: string | null;
  onSelectOption: (requestId: number, questionId: string, optionLabel: string) => void;
  onOtherTextChange: (requestId: number, questionId: string, text: string) => void;
  onSubmit: (request: PendingUserInputRequest) => void;
}

function UserInputRequestCard({
  request,
  draftMap,
  isSubmitting,
  errorText,
  onSelectOption,
  onOtherTextChange,
  onSubmit,
}: UserInputCardProps) {
  const ready = requestIsReady(request, draftMap);

  return (
    <View style={styles.userInputCard}>
      <View style={styles.userInputHeader}>
        <Text style={styles.userInputTitle}>Request #{request.requestId}</Text>
        <Text style={styles.userInputMeta}>Turn {request.turnId}</Text>
      </View>

      {request.questions.map((question) => {
        const draft = draftMap?.[question.id] ?? emptyQuestionDraft();

        return (
          <View key={question.id} style={styles.userInputQuestionBlock}>
            <Text style={styles.userInputQuestionHeader}>{question.header}</Text>
            <Text style={styles.userInputQuestionText}>{question.question}</Text>

            <View style={styles.userInputOptionsWrap}>
              {question.options.map((option) => {
                const selected = draft.selectedOption === option.label;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.userInputOption,
                      selected && styles.userInputOptionSelected,
                    ]}
                    onPress={() => onSelectOption(request.requestId, question.id, option.label)}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel={`Select option ${option.label}`}
                  >
                    <Text
                      style={[
                        styles.userInputOptionLabel,
                        selected && styles.userInputOptionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.userInputOptionDescription}>{option.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {question.isOther ? (
              <TextInput
                style={styles.userInputOtherInput}
                value={draft.otherText}
                onChangeText={(text) => onOtherTextChange(request.requestId, question.id, text)}
                placeholder="Other answer"
                placeholderTextColor="#8E8E93"
                editable={!isSubmitting}
                secureTextEntry={question.isSecret}
              />
            ) : null}
          </View>
        );
      })}

      {errorText ? <Text style={styles.userInputError}>{errorText}</Text> : null}

      <TouchableOpacity
        style={[
          styles.userInputSubmitButton,
          (!ready || isSubmitting) && styles.userInputSubmitButtonDisabled,
        ]}
        onPress={() => onSubmit(request)}
        disabled={!ready || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={`Submit answers for request ${request.requestId}`}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.userInputSubmitButtonText}>Submit response</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen list item types
// ---------------------------------------------------------------------------

type ListItem =
  | { kind: "turn"; turn: Turn }
  | { kind: "approval"; approval: PendingApproval }
  | { kind: "user-input-request"; request: PendingUserInputRequest }
  | { kind: "empty-turns" }
  | { kind: "empty-approvals" }
  | { kind: "empty-user-input" }
  | { kind: "approvals-header" }
  | { kind: "user-input-header" };

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ThreadDetailScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const safeThreadId = threadId ?? "";

  const flatListRef = useRef<FlatList<ListItem>>(null);

  const {
    threadDetail,
    pendingApprovals,
    isLoading,
    isRefreshing,
    isError,
    error,
    refetch: refetchThread,
  } = useThread(safeThreadId);

  const {
    pendingUserInputRequests,
    supportsLiveState,
    refetch: refetchLiveState,
  } = useThreadLiveState(safeThreadId);

  const {
    collaborationModes,
    isLoading: isLoadingModes,
    isError: isModesError,
    error: modesError,
    refetch: refetchModes,
  } = useCollaborationModes();

  const { status: sseStatus } = useLiveUpdates();

  const setModeMutation = useSetCollaborationMode();
  const submitUserInputMutation = useSubmitUserInput();

  const [modePendingKey, setModePendingKey] = useState<string | null>(null);
  const [modeErrorText, setModeErrorText] = useState<string | null>(null);

  const [requestDrafts, setRequestDrafts] = useState<
    Record<number, Record<string, QuestionDraft>>
  >({});
  const [requestPendingId, setRequestPendingId] = useState<number | null>(null);
  const [requestErrors, setRequestErrors] = useState<Record<number, string>>({});

  const thread = threadDetail?.thread;
  const turns: Turn[] = thread?.turns ?? [];
  const agentId = threadDetail?.agentId;
  const title =
    typeof thread?.title === "string" && thread.title.length > 0
      ? thread.title
      : null;

  const currentMode = formatModeLabel(thread?.latestCollaborationMode?.mode ?? null);

  function scrollToBottom() {
    flatListRef.current?.scrollToEnd({ animated: true });
  }

  function handleRefresh() {
    refetchThread();
    refetchLiveState();
    refetchModes();
  }

  function patchQuestionDraft(
    requestId: number,
    questionId: string,
    patch: (prev: QuestionDraft) => QuestionDraft
  ) {
    setRequestDrafts((prev) => {
      const requestMap = prev[requestId] ?? {};
      const current = requestMap[questionId] ?? emptyQuestionDraft();
      return {
        ...prev,
        [requestId]: {
          ...requestMap,
          [questionId]: patch(current),
        },
      };
    });
  }

  function handleSelectOption(requestId: number, questionId: string, optionLabel: string) {
    patchQuestionDraft(requestId, questionId, (prev) => ({
      ...prev,
      selectedOption: optionLabel,
    }));
  }

  function handleOtherTextChange(requestId: number, questionId: string, text: string) {
    patchQuestionDraft(requestId, questionId, (prev) => ({
      ...prev,
      otherText: text,
      selectedOption: text.trim().length > 0 ? null : prev.selectedOption,
    }));
  }

  function handleSetMode(preset: CollaborationModeListItem) {
    if (!safeThreadId) return;

    const modeKey = `${preset.name}:${preset.mode ?? "default"}`;
    const payload = toModePayload(preset, thread?.latestCollaborationMode?.mode ?? "default");

    setModePendingKey(modeKey);
    setModeErrorText(null);

    setModeMutation.mutate(
      {
        threadId: safeThreadId,
        body: {
          collaborationMode: payload,
        },
      },
      {
        onError: (mutationError) => {
          setModeErrorText(
            errorMessage(mutationError, "Failed to set collaboration mode.")
          );
        },
        onSettled: () => {
          setModePendingKey(null);
        },
      }
    );
  }

  function handleSubmitUserInput(request: PendingUserInputRequest) {
    if (!safeThreadId) return;

    const draftMap = requestDrafts[request.requestId];
    if (!requestIsReady(request, draftMap)) {
      setRequestErrors((prev) => ({
        ...prev,
        [request.requestId]: "Answer all questions before submitting.",
      }));
      return;
    }

    const answers = request.questions.reduce<Record<string, { answers: string[] }>>(
      (acc, question) => {
        const draft = draftMap?.[question.id] ?? emptyQuestionDraft();
        acc[question.id] = {
          answers: questionAnswers(question, draft),
        };
        return acc;
      },
      {}
    );

    setRequestPendingId(request.requestId);
    setRequestErrors((prev) => ({
      ...prev,
      [request.requestId]: "",
    }));

    submitUserInputMutation.mutate(
      {
        threadId: safeThreadId,
        body: {
          requestId: request.requestId,
          response: { answers },
        },
      },
      {
        onSuccess: () => {
          setRequestDrafts((prev) => {
            const next = { ...prev };
            delete next[request.requestId];
            return next;
          });
          setRequestErrors((prev) => {
            const next = { ...prev };
            delete next[request.requestId];
            return next;
          });
        },
        onError: (mutationError) => {
          setRequestErrors((prev) => ({
            ...prev,
            [request.requestId]: errorMessage(
              mutationError,
              "Failed to submit response. Try again."
            ),
          }));
        },
        onSettled: () => {
          setRequestPendingId(null);
        },
      }
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading thread…</Text>
      </View>
    );
  }

  if (isError && !threadDetail) {
    const message = errorMessage(error, "An unknown error occurred.");

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.errorScreen}>
          <View style={styles.header}>
            <Text style={styles.label}>Thread ID</Text>
            <Text style={styles.threadId}>{safeThreadId}</Text>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Could not load thread</Text>
            <Text style={styles.errorBody}>{message}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const listItems: ListItem[] = [];

  if (turns.length === 0) {
    listItems.push({ kind: "empty-turns" });
  } else {
    for (const turn of turns) {
      listItems.push({ kind: "turn", turn });
    }
  }

  listItems.push({ kind: "user-input-header" });

  if (pendingUserInputRequests.length === 0) {
    listItems.push({ kind: "empty-user-input" });
  } else {
    for (const request of pendingUserInputRequests) {
      listItems.push({ kind: "user-input-request", request });
    }
  }

  listItems.push({ kind: "approvals-header" });

  if (pendingApprovals.length === 0) {
    listItems.push({ kind: "empty-approvals" });
  } else {
    for (const approval of pendingApprovals) {
      listItems.push({ kind: "approval", approval });
    }
  }

  function renderItem({ item }: { item: ListItem }) {
    switch (item.kind) {
      case "turn":
        return <TurnCard turn={item.turn} />;
      case "approval":
        return <ApprovalCard approval={item.approval} />;
      case "user-input-request":
        return (
          <UserInputRequestCard
            request={item.request}
            draftMap={requestDrafts[item.request.requestId]}
            isSubmitting={requestPendingId === item.request.requestId}
            errorText={requestErrors[item.request.requestId] ?? null}
            onSelectOption={handleSelectOption}
            onOtherTextChange={handleOtherTextChange}
            onSubmit={handleSubmitUserInput}
          />
        );
      case "empty-turns":
        return (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No conversation turns yet.</Text>
          </View>
        );
      case "user-input-header":
        return (
          <Text style={styles.sectionTitle}>
            User Input Requests
            {pendingUserInputRequests.length > 0
              ? ` (${pendingUserInputRequests.length})`
              : ""}
          </Text>
        );
      case "empty-user-input":
        return (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {supportsLiveState
                ? "No pending user-input requests."
                : "Live-state not supported for this agent."}
            </Text>
          </View>
        );
      case "approvals-header":
        return (
          <Text style={styles.sectionTitle}>
            Pending Approvals
            {pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ""}
          </Text>
        );
      case "empty-approvals":
        return (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending approvals.</Text>
          </View>
        );
    }
  }

  const ListHeader = (
    <View>
      <View style={styles.header}>
        {title ? <Text style={styles.threadTitle}>{title}</Text> : null}
        <Text style={styles.label}>Thread ID</Text>
        <Text style={styles.threadId}>{safeThreadId}</Text>
        {agentId ? (
          <>
            <Text style={[styles.label, styles.labelSpaced]}>Agent</Text>
            <Text style={styles.agentId}>{agentId}</Text>
          </>
        ) : null}

        <Text style={[styles.label, styles.labelSpaced]}>Collaboration Mode</Text>
        <Text style={styles.modeCurrentText}>Current: {currentMode}</Text>

        {isLoadingModes ? (
          <View style={styles.modeLoadingRow}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.modeLoadingText}>Loading modes…</Text>
          </View>
        ) : null}

        {isModesError ? (
          <View style={styles.modeErrorBox}>
            <Text style={styles.modeErrorText}>
              {errorMessage(modesError, "Failed to load collaboration modes.")}
            </Text>
            <TouchableOpacity
              style={styles.modeRetryButton}
              onPress={refetchModes}
              accessibilityRole="button"
            >
              <Text style={styles.modeRetryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!isLoadingModes && !isModesError ? (
          collaborationModes.length > 0 ? (
            <View style={styles.modeOptionsWrap}>
              {collaborationModes.map((preset) => {
                const modeKey = `${preset.name}:${preset.mode ?? "default"}`;
                const active =
                  !!preset.mode && preset.mode === thread?.latestCollaborationMode?.mode;
                const pending = modePendingKey === modeKey;
                const disabled = pending || setModeMutation.isPending || !safeThreadId;

                return (
                  <TouchableOpacity
                    key={modeKey}
                    style={[
                      styles.modeOption,
                      active && styles.modeOptionActive,
                      disabled && styles.modeOptionDisabled,
                    ]}
                    onPress={() => handleSetMode(preset)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`Set collaboration mode ${preset.name}`}
                  >
                    <Text
                      style={[
                        styles.modeOptionName,
                        active && styles.modeOptionNameActive,
                      ]}
                    >
                      {preset.name}
                    </Text>
                    <Text style={styles.modeOptionMeta}>mode: {preset.mode ?? "default"}</Text>
                    {pending ? <Text style={styles.modeOptionMeta}>Applying…</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.modeEmptyText}>No collaboration modes available.</Text>
          )
        ) : null}

        {modeErrorText ? <Text style={styles.modeErrorText}>{modeErrorText}</Text> : null}

        <LiveSyncChip status={sseStatus} />
      </View>

      <Text style={styles.sectionTitle}>
        Conversation
        {turns.length > 0 ? ` (${turns.length} turn${turns.length === 1 ? "" : "s"})` : ""}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <FlatList
        ref={flatListRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={listItems}
        keyExtractor={(item, i) => {
          if (item.kind === "turn") return item.turn.id ?? `turn-${i}`;
          if (item.kind === "approval") return `approval-${item.approval.requestId}`;
          if (item.kind === "user-input-request") {
            return `user-input-${item.request.requestId}`;
          }
          return item.kind;
        }}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#007AFF" />
        }
        showsVerticalScrollIndicator
      />
      <Composer threadId={safeThreadId} onSent={scrollToBottom} />
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  list: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  errorScreen: {
    flex: 1,
    padding: 16,
  },
  header: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  threadTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  labelSpaced: {
    marginTop: 12,
  },
  threadId: {
    fontSize: 13,
    color: "#1C1C1E",
    fontFamily: "monospace" as const,
  },
  agentId: {
    fontSize: 14,
    color: "#1C1C1E",
  },
  modeCurrentText: {
    fontSize: 14,
    color: "#1C1C1E",
    marginBottom: 8,
  },
  modeLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  modeLoadingText: {
    fontSize: 13,
    color: "#8E8E93",
  },
  modeErrorBox: {
    backgroundColor: "#FFF3F2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD4CF",
    padding: 10,
    marginBottom: 8,
  },
  modeErrorText: {
    fontSize: 12,
    color: "#C0342B",
  },
  modeRetryButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#007AFF",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modeRetryButtonText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  modeOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  modeOption: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D8FF",
    backgroundColor: "#F4F8FF",
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 120,
  },
  modeOptionActive: {
    borderColor: "#007AFF",
    backgroundColor: "#E7F1FF",
  },
  modeOptionDisabled: {
    opacity: 0.6,
  },
  modeOptionName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A3D91",
    marginBottom: 2,
  },
  modeOptionNameActive: {
    color: "#0052CC",
  },
  modeOptionMeta: {
    fontSize: 11,
    color: "#3A3A3C",
  },
  modeEmptyText: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 10,
    marginTop: 4,
  },
  turnCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  turnCardUser: {
    backgroundColor: "#D6EDFF",
    alignSelf: "flex-end",
    maxWidth: "90%",
  },
  turnCardAgent: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    maxWidth: "90%",
    width: "100%",
  },
  turnCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  turnRole: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  turnRoleUser: {
    color: "#0A84FF",
  },
  turnRoleAgent: {
    color: "#636366",
  },
  turnMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  turnTime: {
    fontSize: 11,
    color: "#C7C7CC",
  },
  turnStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: "#D1F0D5",
  },
  statusInProgress: {
    backgroundColor: "#FFF3CC",
  },
  statusOther: {
    backgroundColor: "#F2F2F7",
  },
  turnStatusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#3A3A3C",
  },
  turnText: {
    fontSize: 14,
    color: "#1C1C1E",
    lineHeight: 20,
  },
  turnEmpty: {
    fontSize: 13,
    color: "#C7C7CC",
    fontStyle: "italic",
  },
  approvalCard: {
    backgroundColor: "#FFF8EC",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FFD060",
  },
  approvalHeader: {
    flexDirection: "row",
    marginBottom: 8,
  },
  approvalTypeBadge: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  approvalTypeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  approvalSummary: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 6,
  },
  approvalDetail: {
    fontSize: 12,
    color: "#3A3A3C",
    fontFamily: "monospace" as const,
    backgroundColor: "#F2F2F7",
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  approvalReason: {
    fontSize: 13,
    color: "#8E8E93",
    fontStyle: "italic",
    marginBottom: 6,
  },
  approvalNote: {
    fontSize: 12,
    color: "#C7C7CC",
    marginTop: 4,
  },
  userInputCard: {
    backgroundColor: "#ECF7FF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#9ACDFF",
  },
  userInputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  userInputTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#003E73",
  },
  userInputMeta: {
    fontSize: 11,
    color: "#316B9D",
  },
  userInputQuestionBlock: {
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
  },
  userInputQuestionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0061A8",
    marginBottom: 4,
  },
  userInputQuestionText: {
    fontSize: 14,
    color: "#1C1C1E",
    marginBottom: 8,
    lineHeight: 20,
  },
  userInputOptionsWrap: {
    gap: 8,
  },
  userInputOption: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D1D6",
    padding: 8,
    backgroundColor: "#FAFAFA",
  },
  userInputOptionSelected: {
    borderColor: "#0A84FF",
    backgroundColor: "#E8F2FF",
  },
  userInputOptionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  userInputOptionLabelSelected: {
    color: "#0052CC",
  },
  userInputOptionDescription: {
    fontSize: 12,
    color: "#636366",
  },
  userInputOtherInput: {
    marginTop: 8,
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1C1C1E",
  },
  userInputSubmitButton: {
    marginTop: 4,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  userInputSubmitButtonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  userInputSubmitButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  userInputError: {
    fontSize: 12,
    color: "#C0342B",
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  errorContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF3B30",
    marginBottom: 6,
  },
  errorBody: {
    fontSize: 14,
    color: "#3A3A3C",
    lineHeight: 20,
  },
  composerContainer: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C6C6C8",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    backgroundColor: "#F2F2F7",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 15,
    color: "#1C1C1E",
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    borderRadius: 18,
    height: 36,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  sendButtonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  sendError: {
    fontSize: 12,
    color: "#FF3B30",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  liveSyncChip: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 10,
  },
  liveSyncChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
});
