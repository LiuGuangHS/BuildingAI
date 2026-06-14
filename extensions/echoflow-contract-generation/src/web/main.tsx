import "./styles/index.css";

import { RootLayout } from "@buildingai/ui/layouts/extension/root/index";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { routeOption } from "./routes";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <RootLayout>
                <RouterProvider router={routeOption} />
            </RootLayout>
        </QueryClientProvider>
    </StrictMode>,
);
