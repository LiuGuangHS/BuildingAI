import "./styles/index.css";

import { RootLayout } from "@buildingai/ui/layouts/extension/root/index";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { routeOption } from "./routes";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <RootLayout>
            <RouterProvider router={routeOption} />
        </RootLayout>
    </StrictMode>,
);
