import "./styles/index.css";

import { I18nProvider } from "@buildingai/i18n";
import { RootLayout } from "@buildingai/ui/layouts/extension/root/index";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { defaultLocale, messages } from "./locales";
import { routeOption } from "./routes";
import { queryClient } from "./services";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <I18nProvider messages={messages} defaultLocale={defaultLocale}>
                <RootLayout>
                    <RouterProvider router={routeOption} />
                </RootLayout>
            </I18nProvider>
        </QueryClientProvider>
    </StrictMode>,
);
