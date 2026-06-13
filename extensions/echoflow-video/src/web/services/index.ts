import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
            refetchOnWindowFocus: false,
        },
    },
});

export * from "./console/generation";
export * from "./console/config";
export * from "./console/model-config";
export * from "./console/billing";
export * from "./console/policies";
export * from "./console/templates";
export * from "./web/billing";
export * from "./web/generation";
export * from "./web/templates";
export { QueryClient, QueryClientProvider } from "@tanstack/react-query";
