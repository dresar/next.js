import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Hard Cache: Jangan pernah fetch ulang otomatis saat pindah page
      refetchOnWindowFocus: false, // Jangan fetch ulang walau pindah tab browser
      retry: 1,
    },
  },
});
