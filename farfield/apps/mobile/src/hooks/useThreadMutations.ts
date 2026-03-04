/**
 * TanStack Query mutation hooks for all MVP thread write operations.
 *
 * This module is the single import Phase 05 needs to perform thread mutations.
 * It owns the cache invalidation contract so UI code never calls queryClient
 * directly for write-side concerns.
 *
 * Exported hooks:
 *   useSendMessage()         — POST /api/threads/:id/messages
 *   useInterruptThread()     — POST /api/threads/:id/interrupt
 *   useSetCollaborationMode() — POST /api/threads/:id/collaboration-mode
 *   useRespondToApproval()   — POST /api/threads/:id/pending-approvals/respond
 *
 * Cache invalidation rules (applied after each successful mutation):
 *   - Send message          → invalidate thread detail + thread list
 *   - Interrupt             → invalidate thread detail + thread list
 *   - Collaboration mode    → invalidate thread detail + collaboration modes
 *   - Approval response     → invalidate pending approvals + thread detail
 *
 * Error handling:
 *   Errors are FarfieldClientError subclasses (NoServerUrlError,
 *   UnauthorizedError, HttpError, …). Callers inspect `mutation.error`
 *   or the `onError` callback; this hook adds no UI-specific handling.
 *
 * No UI assumptions:
 *   Hooks do not render anything, reference router, or touch navigation.
 *   Phase 05 wires these to controls.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  sendMessage,
  type SendMessageBody,
  type SendMessageResponse,
} from "@/src/api/messages";
import {
  interruptThread,
  setCollaborationMode,
  respondToApproval,
  type InterruptBody,
  type InterruptResponse,
  type SetCollaborationModeBody,
  type SetCollaborationModeResponse,
  type RespondToApprovalBody,
  type RespondToApprovalResponse,
} from "@/src/api/thread-actions";
import { queryKeys } from "@/src/api/queryKeys";

// ---------------------------------------------------------------------------
// useSendMessage
// ---------------------------------------------------------------------------

/** Arguments accepted by useSendMessage's mutate function. */
export interface SendMessageArgs {
  threadId: string;
  body: SendMessageBody;
}

/**
 * Mutation hook for sending a message to a thread.
 *
 * Invalidates on success:
 *   - Thread detail (so turn list refreshes)
 *   - Thread list  (so preview text updates)
 *
 * @example
 * const mutation = useSendMessage();
 * mutation.mutate({ threadId: "abc", body: { text: "Hello" } });
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<SendMessageResponse, Error, SendMessageArgs>({
    mutationFn: ({ threadId, body }) => sendMessage(threadId, body),
    onSuccess: (_data, { threadId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.threads.detail(threadId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.threads.list(),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useInterruptThread
// ---------------------------------------------------------------------------

/** Arguments accepted by useInterruptThread's mutate function. */
export interface InterruptThreadArgs {
  threadId: string;
  body?: InterruptBody;
}

/**
 * Mutation hook for interrupting an in-progress thread turn.
 *
 * Invalidates on success:
 *   - Thread detail (so turn status refreshes)
 *   - Thread list  (so list-level status badges update)
 *
 * @example
 * const mutation = useInterruptThread();
 * mutation.mutate({ threadId: "abc" });
 */
export function useInterruptThread() {
  const queryClient = useQueryClient();

  return useMutation<InterruptResponse, Error, InterruptThreadArgs>({
    mutationFn: ({ threadId, body }) => interruptThread(threadId, body ?? {}),
    onSuccess: (_data, { threadId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.threads.detail(threadId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.threads.list(),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useSetCollaborationMode
// ---------------------------------------------------------------------------

/** Arguments accepted by useSetCollaborationMode's mutate function. */
export interface SetCollaborationModeArgs {
  threadId: string;
  body: SetCollaborationModeBody;
}

/**
 * Mutation hook for changing a thread's collaboration mode.
 *
 * Invalidates on success:
 *   - Thread detail (so latestCollaborationMode reflects the change)
 *   - Collaboration modes for the thread (forThread key)
 *
 * @example
 * const mutation = useSetCollaborationMode();
 * mutation.mutate({
 *   threadId: "abc",
 *   body: { collaborationMode: { mode: "auto", settings: {} } },
 * });
 */
export function useSetCollaborationMode() {
  const queryClient = useQueryClient();

  return useMutation<SetCollaborationModeResponse, Error, SetCollaborationModeArgs>({
    mutationFn: ({ threadId, body }) => setCollaborationMode(threadId, body),
    onSuccess: (_data, { threadId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.threads.detail(threadId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.collaborationModes.forThread(threadId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// useRespondToApproval
// ---------------------------------------------------------------------------

/** Arguments accepted by useRespondToApproval's mutate function. */
export interface RespondToApprovalArgs {
  threadId: string;
  body: RespondToApprovalBody;
}

/**
 * Mutation hook for submitting an approve/deny decision on a pending approval.
 *
 * Invalidates on success:
 *   - Pending approvals for the thread (approval resolved)
 *   - Thread detail (turn state may advance after approval)
 *
 * @example
 * const mutation = useRespondToApproval();
 * mutation.mutate({
 *   threadId: "abc",
 *   body: { requestId: 1, decision: "approve" },
 * });
 */
export function useRespondToApproval() {
  const queryClient = useQueryClient();

  return useMutation<RespondToApprovalResponse, Error, RespondToApprovalArgs>({
    mutationFn: ({ threadId, body }) => respondToApproval(threadId, body),
    onSuccess: (_data, { threadId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.approvals.pending(threadId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.threads.detail(threadId),
      });
    },
  });
}
