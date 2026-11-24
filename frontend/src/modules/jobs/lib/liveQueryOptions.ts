/** TanStack Query defaults for hiring / placement lists that should stay in sync across roles. */
export const LIVE_LIST_QUERY_OPTIONS = {
  refetchOnWindowFocus: true,
  refetchOnMount: "always" as const,
  staleTime: 15_000,
  refetchInterval: 45_000,
};