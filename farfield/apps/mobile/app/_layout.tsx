import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";

/**
 * Shared QueryClient for the entire app.
 *
 * Conservative defaults tuned for a remote-control app:
 *   - staleTime: 30 s  — data stays fresh for 30 s before a background refetch
 *   - gcTime: 5 min    — inactive cache entries are kept for 5 minutes
 *   - retry: 2         — transient network failures get 2 retries before surfacing an error
 *   - refetchOnWindowFocus: false — avoid aggressive refetching when switching app focus
 *   - refetchOnReconnect: true    — re-fetch when network connectivity is restored
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="thread/[threadId]"
          options={{ title: "Thread Detail" }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
