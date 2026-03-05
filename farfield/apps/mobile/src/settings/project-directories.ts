import AsyncStorage from "@react-native-async-storage/async-storage";

const CUSTOM_PROJECT_DIRECTORIES_KEY = "farfield.projectDirectories.custom.v1";

function normalizeProjectPath(path: string): string {
  return path.trim();
}

function sanitizeProjectDirectories(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];

  const deduped = new Set<string>();
  for (const raw of paths) {
    if (typeof raw !== "string") continue;
    const normalized = normalizeProjectPath(raw);
    if (!normalized) continue;
    deduped.add(normalized);
  }

  return Array.from(deduped);
}

async function writeCustomProjectDirectories(paths: string[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_PROJECT_DIRECTORIES_KEY, JSON.stringify(paths));
}

export async function loadCustomProjectDirectories(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(CUSTOM_PROJECT_DIRECTORIES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeProjectDirectories(parsed);
    if (sanitized.length > 0 || Array.isArray(parsed)) {
      return sanitized;
    }
    return [];
  } catch {
    return [];
  }
}

export async function addCustomProjectDirectory(path: string): Promise<string[]> {
  const normalized = normalizeProjectPath(path);
  if (!normalized) {
    return loadCustomProjectDirectories();
  }

  const current = await loadCustomProjectDirectories();
  const next = sanitizeProjectDirectories([...current, normalized]);
  await writeCustomProjectDirectories(next);
  return next;
}

export async function removeCustomProjectDirectory(path: string): Promise<string[]> {
  const normalized = normalizeProjectPath(path);
  const current = await loadCustomProjectDirectories();
  const next = sanitizeProjectDirectories(current.filter((entry) => entry !== normalized));
  await writeCustomProjectDirectories(next);
  return next;
}
