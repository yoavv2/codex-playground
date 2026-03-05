import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewToken,
} from "react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useThreads } from "@/src/hooks/useThreads";
import { useAgents } from "@/src/hooks/useAgents";
import { useCreateThread } from "@/src/hooks/useThreadMutations";
import type { ThreadListItem } from "@/src/api/threads";
import { readThread } from "@/src/api/threads";
import {
  NoServerUrlError,
  RequestTimeoutError,
  ServerUnreachableError,
  UnauthorizedError,
} from "@/src/api/errors";
import { useLiveUpdates } from "@/src/live/useLiveUpdates";
import type { SseStatus } from "@/src/hooks/useSseConnection";
import {
  addCustomProjectDirectory,
  loadCustomProjectDirectories,
  removeCustomProjectDirectory,
} from "@/src/settings/project-directories";

/**
 * Threads screen — directory-style project groups + thread list.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortMode = "lastTouched" | "name" | "project";

interface ProjectGroup {
  key: string;
  label: string;
  projectPath: string | null;
  latestUpdatedAt: number;
  isCustom: boolean;
  threads: ThreadListItem[];
}

function normalizeEpochToMs(value: number | undefined): number | undefined {
  if (!value || !Number.isFinite(value)) return undefined;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function formatRelativeTime(epoch: number | undefined): string {
  const epochMs = normalizeEpochToMs(epoch);
  if (!epochMs) return "";

  const delta = Date.now() - epochMs;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function basenameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return "Unknown";
  const parts = normalized.split("/").filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? normalized;
}

function getThreadPreview(thread: ThreadListItem): string {
  if ("preview" in thread && typeof thread.preview === "string") {
    return thread.preview;
  }
  return "";
}

function getThreadSource(thread: ThreadListItem): string {
  if ("source" in thread && typeof thread.source === "string" && thread.source.length > 0) {
    return thread.source;
  }
  return "codex";
}

function getThreadProjectPath(thread: ThreadListItem): string | null {
  const cwd = "cwd" in thread && typeof thread.cwd === "string" ? thread.cwd.trim() : "";
  if (cwd.length > 0) return cwd;

  const path = "path" in thread && typeof thread.path === "string" ? thread.path.trim() : "";
  if (path.length > 0) return path;

  return null;
}

function getThreadUpdatedAtMs(thread: ThreadListItem): number {
  const updatedAt = "updatedAt" in thread ? (thread.updatedAt as number | undefined) : undefined;
  return normalizeEpochToMs(updatedAt) ?? 0;
}

function fallbackThreadName(thread: ThreadListItem): string {
  const preview = getThreadPreview(thread).trim();
  if (preview.length > 0) return preview;
  return `thread ${thread.id.slice(0, 8)}`;
}

function threadDisplayName(thread: ThreadListItem, titleByThreadId: Record<string, string>): string {
  const loadedTitle = titleByThreadId[thread.id];
  if (typeof loadedTitle === "string" && loadedTitle.trim().length > 0) {
    return loadedTitle.trim();
  }
  return fallbackThreadName(thread);
}

function groupSortValue(group: ProjectGroup, sortMode: SortMode): string | number {
  switch (sortMode) {
    case "name":
      return group.label.toLowerCase();
    case "project":
      return (group.projectPath ?? "").toLowerCase();
    case "lastTouched":
    default:
      return group.latestUpdatedAt;
  }
}

function buildProjectGroups(
  threads: ThreadListItem[],
  agentProjectDirectories: string[],
  customProjectDirectories: string[]
): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();
  const customSet = new Set(customProjectDirectories);

  function getGroupKey(projectPath: string | null): string {
    return projectPath ? `project:${projectPath}` : "project:unknown";
  }

  function ensureGroup(projectPath: string | null, latestUpdatedAt = 0): ProjectGroup {
    const key = getGroupKey(projectPath);
    const existing = groups.get(key);
    if (existing) {
      if (latestUpdatedAt > existing.latestUpdatedAt) {
        existing.latestUpdatedAt = latestUpdatedAt;
      }
      if (projectPath && customSet.has(projectPath)) {
        existing.isCustom = true;
      }
      return existing;
    }

    const next: ProjectGroup = {
      key,
      label: projectPath ? basenameFromPath(projectPath) : "Unknown",
      projectPath,
      latestUpdatedAt,
      isCustom: projectPath ? customSet.has(projectPath) : false,
      threads: [],
    };

    groups.set(key, next);
    return next;
  }

  for (const thread of threads) {
    const projectPath = getThreadProjectPath(thread);
    const updatedAt = getThreadUpdatedAtMs(thread);
    const group = ensureGroup(projectPath, updatedAt);
    group.threads.push(thread);
  }

  for (const path of agentProjectDirectories) {
    const normalized = path.trim();
    if (!normalized) continue;
    ensureGroup(normalized, 0);
  }

  for (const path of customProjectDirectories) {
    const normalized = path.trim();
    if (!normalized) continue;
    ensureGroup(normalized, 0);
  }

  return Array.from(groups.values());
}

function filterAndSortThreads(
  threads: ThreadListItem[],
  sortMode: SortMode,
  projectPath: string | null,
  filter: string,
  titleByThreadId: Record<string, string>
): ThreadListItem[] {
  const query = filter.trim().toLowerCase();

  const filtered = threads.filter((thread) => {
    if (!query) return true;

    const name = threadDisplayName(thread, titleByThreadId).toLowerCase();
    const preview = getThreadPreview(thread).toLowerCase();
    const id = thread.id.toLowerCase();
    const project = (projectPath ?? "").toLowerCase();

    return (
      name.includes(query) ||
      preview.includes(query) ||
      id.includes(query) ||
      project.includes(query)
    );
  });

  return [...filtered].sort((left, right) => {
    if (sortMode === "name") {
      const byName = threadDisplayName(left, titleByThreadId).localeCompare(
        threadDisplayName(right, titleByThreadId),
        undefined,
        { sensitivity: "base" }
      );
      if (byName !== 0) return byName;
      return getThreadUpdatedAtMs(right) - getThreadUpdatedAtMs(left);
    }

    if (sortMode === "project") {
      const leftProject = getThreadProjectPath(left) ?? "";
      const rightProject = getThreadProjectPath(right) ?? "";
      const byProject = leftProject.localeCompare(rightProject, undefined, {
        sensitivity: "base",
      });
      if (byProject !== 0) return byProject;
      return getThreadUpdatedAtMs(right) - getThreadUpdatedAtMs(left);
    }

    return getThreadUpdatedAtMs(right) - getThreadUpdatedAtMs(left);
  });
}

// ---------------------------------------------------------------------------
// Connection banner helpers
// ---------------------------------------------------------------------------

type ConnectionStatus =
  | "live-connected"
  | "connected"
  | "live-reconnecting"
  | "live-error"
  | "auth-failed"
  | "server-unreachable"
  | "timeout"
  | "configure-server"
  | "unknown-error"
  | "idle";

function deriveConnectionStatus(
  isError: boolean,
  error: Error | null,
  hasData: boolean,
  sseStatus: SseStatus
): ConnectionStatus {
  if (isError) {
    if (error instanceof NoServerUrlError) return "configure-server";
    if (error instanceof UnauthorizedError) return "auth-failed";
    if (error instanceof ServerUnreachableError) return "server-unreachable";
    if (error instanceof RequestTimeoutError) return "timeout";
    return "unknown-error";
  }

  if (sseStatus === "connected") return "live-connected";
  if (sseStatus === "reconnecting") return "live-reconnecting";
  if (sseStatus === "error") return "live-error";

  return hasData ? "connected" : "idle";
}

function connectionBannerProps(
  status: ConnectionStatus,
  retryAt: number | null
): { color: string; label: string } | null {
  switch (status) {
    case "live-connected":
      return { color: "#34C759", label: "Live — connected" };
    case "connected":
      return { color: "#34C759", label: "Connected" };
    case "live-reconnecting": {
      if (retryAt !== null) {
        const secsUntil = Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000));
        const retryLabel =
          secsUntil <= 0 ? "now" : secsUntil === 1 ? "in 1s" : `in ${secsUntil}s`;
        return { color: "#FF9500", label: `Reconnecting ${retryLabel} — pull to refresh` };
      }
      return { color: "#FF9500", label: "Reconnecting — pull to refresh" };
    }
    case "live-error":
      return { color: "#FF9500", label: "Live updates disconnected — pull to refresh" };
    case "auth-failed":
      return { color: "#FF3B30", label: "Auth failed — check your token in Settings" };
    case "server-unreachable":
      return { color: "#FF9500", label: "Server unreachable — check URL and network" };
    case "timeout":
      return { color: "#FF9500", label: "Request timed out — server may be slow" };
    case "configure-server":
      return { color: "#8E8E93", label: "No server configured — go to Settings" };
    case "unknown-error":
      return { color: "#FF3B30", label: "Could not reach server" };
    case "idle":
      return null;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectionBanner({
  status,
  retryAt,
}: {
  status: ConnectionStatus;
  retryAt: number | null;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "live-reconnecting" || retryAt === null) return;
    const id = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, [status, retryAt]);

  const props = connectionBannerProps(status, retryAt);
  if (!props) return null;

  return (
    <View style={[styles.banner, { backgroundColor: props.color }]}> 
      <Text style={styles.bannerText}>{props.label}</Text>
    </View>
  );
}

function SortModeSelector({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}) {
  const options: Array<{ key: SortMode; label: string }> = [
    { key: "lastTouched", label: "Last touched" },
    { key: "name", label: "Name" },
    { key: "project", label: "Project" },
  ];

  return (
    <View style={styles.sortControl}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.sortOption, active && styles.sortOptionActive]}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${option.label}`}
          >
            <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{source}</Text>
    </View>
  );
}

function ErrorState({ error }: { error: Error | null }) {
  function getMessage() {
    if (!error) return "An unknown error occurred.";
    if (error instanceof NoServerUrlError) {
      return "No server URL configured. Please set one in Settings.";
    }
    return error.message;
  }

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Could not load threads</Text>
      <Text style={styles.errorBody}>{getMessage()}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ThreadsScreen() {
  const {
    sortedThreads,
    isFirstLoad,
    isRefreshing,
    isEmpty,
    isError,
    error,
    refetch,
  } = useThreads();

  const {
    enabledAgents,
    defaultAgentId,
    refetch: refetchAgents,
  } = useAgents();

  const { status: sseStatus, retryAt } = useLiveUpdates();

  const createThreadMutation = useCreateThread();

  const [filter, setFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("lastTouched");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [customProjectDirectories, setCustomProjectDirectories] = useState<string[]>([]);
  const [isLoadingCustomProjects, setIsLoadingCustomProjects] = useState(true);

  const [addProjectModalVisible, setAddProjectModalVisible] = useState(false);
  const [addProjectDraft, setAddProjectDraft] = useState("");
  const [addProjectError, setAddProjectError] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);

  const [agentPickerProjectPath, setAgentPickerProjectPath] = useState<string | null>(null);

  const [threadTitleById, setThreadTitleById] = useState<Record<string, string>>({});
  const titleByIdRef = useRef<Record<string, string>>({});
  const titleFetchInFlightRef = useRef<Set<string>>(new Set());

  const [visibleGroupKeys, setVisibleGroupKeys] = useState<string[]>([]);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;

  useEffect(() => {
    titleByIdRef.current = threadTitleById;
  }, [threadTitleById]);

  useEffect(() => {
    let active = true;
    loadCustomProjectDirectories()
      .then((paths) => {
        if (!active) return;
        setCustomProjectDirectories(paths);
      })
      .finally(() => {
        if (!active) return;
        setIsLoadingCustomProjects(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const agentProjectDirectories = useMemo(() => {
    const all = new Set<string>();
    for (const agent of enabledAgents ?? []) {
      for (const directory of agent.projectDirectories) {
        const normalized = directory.trim();
        if (!normalized) continue;
        all.add(normalized);
      }
    }
    return Array.from(all);
  }, [enabledAgents]);

  const baseGroups = useMemo(() => {
    const threads = sortedThreads ?? [];
    return buildProjectGroups(threads, agentProjectDirectories, customProjectDirectories);
  }, [agentProjectDirectories, customProjectDirectories, sortedThreads]);

  const projectFilterOptions = useMemo(() => {
    const options = [{ key: "all", label: "All" }];

    const groupsWithPath = baseGroups
      .filter((group) => group.projectPath)
      .sort((left, right) =>
        (left.projectPath ?? "").localeCompare(right.projectPath ?? "", undefined, {
          sensitivity: "base",
        })
      );

    for (const group of groupsWithPath) {
      options.push({ key: group.key, label: group.label });
    }

    if (baseGroups.some((group) => group.projectPath === null)) {
      options.push({ key: "project:unknown", label: "Unknown" });
    }

    return options;
  }, [baseGroups]);

  useEffect(() => {
    if (selectedProjectFilter === "all") return;
    const exists = projectFilterOptions.some((option) => option.key === selectedProjectFilter);
    if (!exists) {
      setSelectedProjectFilter("all");
    }
  }, [projectFilterOptions, selectedProjectFilter]);

  const displayGroups = useMemo(() => {
    const nextGroups: ProjectGroup[] = [];
    const query = filter.trim().toLowerCase();

    for (const group of baseGroups) {
      if (selectedProjectFilter !== "all" && group.key !== selectedProjectFilter) {
        continue;
      }

      const visibleThreads = filterAndSortThreads(
        group.threads,
        sortMode,
        group.projectPath,
        query,
        threadTitleById
      );

      if (query.length > 0 && visibleThreads.length === 0) {
        continue;
      }

      nextGroups.push({
        ...group,
        threads: visibleThreads,
      });
    }

    return nextGroups.sort((left, right) => {
      const leftValue = groupSortValue(left, sortMode);
      const rightValue = groupSortValue(right, sortMode);

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        if (leftValue !== rightValue) return rightValue - leftValue;
      } else {
        const byLabel = String(leftValue).localeCompare(String(rightValue), undefined, {
          sensitivity: "base",
        });
        if (byLabel !== 0) return byLabel;
      }

      return right.latestUpdatedAt - left.latestUpdatedAt;
    });
  }, [baseGroups, filter, selectedProjectFilter, sortMode, threadTitleById]);

  const hasData = !!(sortedThreads && sortedThreads.length > 0);
  const hasFilter = filter.trim().length > 0;
  const connectionStatus = deriveConnectionStatus(isError, error, hasData, sseStatus);

  const isListEmpty = displayGroups.length === 0;
  const totalVisibleThreads = displayGroups.reduce((sum, group) => sum + group.threads.length, 0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<ProjectGroup>> }) => {
      const keys = viewableItems
        .map((entry) => entry.item?.key)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      setVisibleGroupKeys(keys);
    }
  ).current;

  const fetchThreadTitle = useCallback(async (threadId: string) => {
    if (titleByIdRef.current[threadId]) return;
    if (titleFetchInFlightRef.current.has(threadId)) return;

    titleFetchInFlightRef.current.add(threadId);

    try {
      const detail = await readThread(threadId, { includeTurns: false });
      const title =
        typeof detail.thread.title === "string" && detail.thread.title.trim().length > 0
          ? detail.thread.title.trim()
          : "";

      if (title) {
        setThreadTitleById((prev) => {
          if (prev[threadId] === title) return prev;
          return {
            ...prev,
            [threadId]: title,
          };
        });
      }
    } catch {
      // Keep preview fallback when title fetch fails.
    } finally {
      titleFetchInFlightRef.current.delete(threadId);
    }
  }, []);

  useEffect(() => {
    if (displayGroups.length === 0) return;

    const visibleKeys =
      visibleGroupKeys.length > 0
        ? new Set(visibleGroupKeys)
        : new Set(displayGroups.slice(0, 3).map((group) => group.key));

    for (const group of displayGroups) {
      if (!visibleKeys.has(group.key)) continue;
      if (collapsedGroups[group.key]) continue;

      for (const thread of group.threads) {
        void fetchThreadTitle(thread.id);
      }
    }
  }, [collapsedGroups, displayGroups, fetchThreadTitle, visibleGroupKeys]);

  function handleRefresh() {
    refetch();
    refetchAgents();
  }

  async function handleAddProject() {
    const path = addProjectDraft.trim();
    if (!path) {
      setAddProjectError("Project path is required.");
      return;
    }

    setIsSavingProject(true);
    setAddProjectError(null);

    try {
      const next = await addCustomProjectDirectory(path);
      setCustomProjectDirectories(next);
      setAddProjectDraft("");
      setAddProjectModalVisible(false);
    } catch (storageError) {
      const message =
        storageError instanceof Error ? storageError.message : "Could not save project path.";
      setAddProjectError(message);
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleRemoveCustomProject(projectPath: string) {
    const next = await removeCustomProjectDirectory(projectPath);
    setCustomProjectDirectories(next);

    if (selectedProjectFilter === `project:${projectPath}`) {
      setSelectedProjectFilter("all");
    }
  }

  function openThread(threadId: string) {
    router.push(`/thread/${threadId}`);
  }

  function setGroupCollapsed(groupKey: string, nextValue: boolean) {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: nextValue,
    }));
  }

  function resolveAgentId(agentId: string | null | undefined): "codex" | "opencode" | undefined {
    if (agentId === "codex" || agentId === "opencode") {
      return agentId;
    }
    return undefined;
  }

  function createThreadForProject(projectPath: string, agentId?: string) {
    const normalizedAgentId = resolveAgentId(agentId);
    createThreadMutation.mutate(
      {
        body: {
          cwd: projectPath,
          ...(normalizedAgentId ? { agentId: normalizedAgentId } : {}),
        },
      },
      {
        onSuccess: (result) => {
          setAgentPickerProjectPath(null);
          router.push(`/thread/${result.threadId}`);
        },
      }
    );
  }

  function handleCreateThreadPress(projectPath: string | null) {
    if (!projectPath || createThreadMutation.isPending) return;

    const availableAgents = enabledAgents ?? [];
    if (availableAgents.length === 0) return;

    if (availableAgents.length === 1) {
      createThreadForProject(projectPath, availableAgents[0]?.id);
      return;
    }

    setAgentPickerProjectPath(projectPath);
  }

  function renderGroup({ item: group }: { item: ProjectGroup }) {
    const isCollapsed = !!collapsedGroups[group.key];

    return (
      <View style={styles.groupCard}>
        <View style={styles.groupHeaderRow}>
          <TouchableOpacity
            style={styles.groupHeaderButton}
            onPress={() => setGroupCollapsed(group.key, !isCollapsed)}
            accessibilityRole="button"
            accessibilityLabel={`${isCollapsed ? "Expand" : "Collapse"} ${group.label}`}
          >
            <Text style={styles.groupChevron}>{isCollapsed ? "▸" : "▾"}</Text>
            <View style={styles.groupLabelWrap}>
              <Text style={styles.groupTitle} numberOfLines={1}>
                {group.label}
              </Text>
              <Text style={styles.groupPath} numberOfLines={1}>
                {group.projectPath ?? "Unknown project"}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.groupActions}>
            {group.projectPath && group.isCustom ? (
              <TouchableOpacity
                style={styles.groupActionSecondary}
                onPress={() => handleRemoveCustomProject(group.projectPath as string)}
                disabled={createThreadMutation.isPending}
              >
                <Text style={styles.groupActionSecondaryText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.groupActionPrimary}
              onPress={() => handleCreateThreadPress(group.projectPath)}
              disabled={!group.projectPath || createThreadMutation.isPending}
            >
              <Text style={styles.groupActionPrimaryText}>New thread</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isCollapsed ? (
          <View style={styles.groupBody}>
            {group.threads.length === 0 ? (
              <Text style={styles.groupEmptyText}>No threads yet.</Text>
            ) : (
              group.threads.map((thread) => {
                const displayName = threadDisplayName(thread, threadTitleById);
                const preview = getThreadPreview(thread).trim();
                const showPreview = preview.length > 0 && preview !== displayName;
                const source = getThreadSource(thread);
                const updatedAt = "updatedAt" in thread ? (thread.updatedAt as number | undefined) : undefined;

                return (
                  <TouchableOpacity
                    key={thread.id}
                    style={styles.threadRow}
                    onPress={() => openThread(thread.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.threadRowHeader}>
                      <Text style={styles.threadTitle} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text style={styles.threadTime}>{formatRelativeTime(updatedAt)}</Text>
                    </View>

                    {showPreview ? (
                      <Text style={styles.threadPreview} numberOfLines={2}>
                        {preview}
                      </Text>
                    ) : null}

                    <View style={styles.threadMetaRow}>
                      <Text style={styles.threadIdHint} numberOfLines={1}>
                        {thread.id}
                      </Text>
                      <SourceBadge source={source} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : null}
      </View>
    );
  }

  if (isFirstLoad || isLoadingCustomProjects) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading threads…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Threads</Text>

      <ConnectionBanner status={connectionStatus} retryAt={retryAt} />

      {isError && !hasData ? (
        <ErrorState error={error} />
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search threads…"
              placeholderTextColor="#8E8E93"
              value={filter}
              onChangeText={setFilter}
              clearButtonMode="while-editing"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.addProjectButton}
              onPress={() => {
                setAddProjectError(null);
                setAddProjectModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Add project directory"
            >
              <Text style={styles.addProjectButtonText}>+ Project</Text>
            </TouchableOpacity>
          </View>

          <SortModeSelector value={sortMode} onChange={setSortMode} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsScrollContent}
            style={styles.filterChipsScroll}
          >
            {projectFilterOptions.map((option) => {
              const active = selectedProjectFilter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.projectChip, active && styles.projectChipActive]}
                  onPress={() => setSelectedProjectFilter(option.key)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[styles.projectChipText, active && styles.projectChipTextActive]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {sortedThreads && sortedThreads.length > 0 ? (
            <Text style={styles.subtitle}>
              {hasFilter
                ? `${totalVisibleThreads} of ${sortedThreads.length} ${
                    sortedThreads.length === 1 ? "thread" : "threads"
                  }`
                : `${totalVisibleThreads} ${totalVisibleThreads === 1 ? "thread" : "threads"}`}
            </Text>
          ) : null}

          <FlatList
            data={displayGroups}
            keyExtractor={(item) => item.key}
            renderItem={renderGroup}
            contentContainerStyle={isListEmpty ? styles.emptyList : styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>{isEmpty && !hasFilter ? "No threads yet" : "No results"}</Text>
                <Text style={styles.emptyBody}>
                  {isEmpty && !hasFilter
                    ? "Start a new Codex session on your Mac to see threads here."
                    : `No threads match \"${filter}\".`}
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing || createThreadMutation.isPending}
                onRefresh={handleRefresh}
                tintColor="#007AFF"
              />
            }
          />
        </>
      )}

      <Modal
        visible={addProjectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddProjectModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddProjectModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Add Project Directory</Text>
            <TextInput
              style={styles.modalInput}
              value={addProjectDraft}
              onChangeText={setAddProjectDraft}
              placeholder="/Users/you/project"
              placeholderTextColor="#8E8E93"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {addProjectError ? <Text style={styles.modalError}>{addProjectError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setAddProjectModalVisible(false)}
                disabled={isSavingProject}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonPrimary}
                onPress={handleAddProject}
                disabled={isSavingProject}
              >
                <Text style={styles.modalButtonPrimaryText}>
                  {isSavingProject ? "Saving…" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={agentPickerProjectPath !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAgentPickerProjectPath(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAgentPickerProjectPath(null)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Select Agent</Text>
            <Text style={styles.modalSubTitle} numberOfLines={2}>
              Create new thread in {agentPickerProjectPath ?? "project"}
            </Text>

            <View style={styles.agentPickerList}>
              {(enabledAgents ?? []).map((agent) => (
                <TouchableOpacity
                  key={agent.id}
                  style={styles.agentOption}
                  onPress={() => {
                    if (!agentPickerProjectPath) return;
                    createThreadForProject(agentPickerProjectPath, agent.id);
                  }}
                  disabled={createThreadMutation.isPending}
                >
                  <Text style={styles.agentOptionText}>{agent.label}</Text>
                  {defaultAgentId === agent.id ? <Text style={styles.agentDefault}>Default</Text> : null}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalButtonSecondary}
              onPress={() => setAgentPickerProjectPath(null)}
              disabled={createThreadMutation.isPending}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color: "#1C1C1E",
  },
  subtitle: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  banner: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  bannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  searchRow: {
    marginBottom: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  addProjectButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addProjectButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  sortControl: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D6D6DB",
    backgroundColor: "#FFFFFF",
    padding: 4,
    marginBottom: 8,
  },
  sortOption: {
    flex: 1,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
    paddingHorizontal: 8,
  },
  sortOptionActive: {
    backgroundColor: "#0A84FF",
  },
  sortOptionText: {
    fontSize: 12,
    color: "#3A3A3C",
    fontWeight: "600",
  },
  sortOptionTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  filterChipsScroll: {
    marginBottom: 10,
  },
  filterChipsScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingRight: 16,
  },
  projectChip: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D1D6",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    maxWidth: 220,
  },
  projectChipActive: {
    borderColor: "#007AFF",
    backgroundColor: "#E7F1FF",
  },
  projectChipText: {
    fontSize: 12,
    color: "#3A3A3C",
    fontWeight: "600",
  },
  projectChipTextActive: {
    color: "#0052CC",
    fontWeight: "600",
  },
  list: {
    paddingBottom: 20,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  separator: {
    height: 10,
  },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E8ED",
    overflow: "hidden",
  },
  groupHeaderRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  groupHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  groupChevron: {
    fontSize: 12,
    color: "#636366",
    marginRight: 8,
    width: 10,
    textAlign: "center",
  },
  groupLabelWrap: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  groupPath: {
    fontSize: 11,
    color: "#8E8E93",
    marginTop: 2,
  },
  groupActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupActionPrimary: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupActionPrimaryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  groupActionSecondary: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#F2F2F7",
  },
  groupActionSecondaryText: {
    color: "#636366",
    fontSize: 12,
    fontWeight: "600",
  },
  groupBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  groupEmptyText: {
    fontSize: 13,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  threadRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ECECF1",
    padding: 10,
    backgroundColor: "#FAFAFC",
  },
  threadRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  threadTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1C1E",
    flex: 1,
    marginRight: 8,
  },
  threadTime: {
    fontSize: 11,
    color: "#8E8E93",
  },
  threadPreview: {
    fontSize: 13,
    color: "#3A3A3C",
    lineHeight: 18,
    marginBottom: 6,
  },
  threadMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  threadIdHint: {
    flex: 1,
    fontSize: 10,
    color: "#B0B0B7",
    fontFamily: "monospace" as const,
  },
  badge: {
    backgroundColor: "#E5E5EA",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#3A3A3C",
    textTransform: "lowercase" as const,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 10,
  },
  modalSubTitle: {
    fontSize: 13,
    color: "#636366",
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1C1C1E",
  },
  modalError: {
    marginTop: 8,
    fontSize: 12,
    color: "#C0342B",
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalButtonSecondary: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
  },
  modalButtonSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3A3A3C",
  },
  modalButtonPrimary: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#007AFF",
    alignItems: "center",
  },
  modalButtonPrimaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  agentPickerList: {
    gap: 8,
    marginBottom: 14,
  },
  agentOption: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FAFAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  agentOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  agentDefault: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0052CC",
  },
});
