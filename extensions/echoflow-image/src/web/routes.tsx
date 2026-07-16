import { defineRouteOption } from "@buildingai/web-core";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import packageJson from "./../../package.json";

const EchoflowImagePublicPage = lazy(() => import("./pages/index"));
const WebHistoryPage = lazy(() => import("./pages/history"));
const WebDetailPage = lazy(() => import("./pages/detail"));
const EchoflowImageConsolePage = lazy(() => import("./pages/console/index"));
const ConsoleModelsPage = lazy(() => import("./pages/console/models"));
const ConsolePoliciesPage = lazy(() => import("./pages/console/policies"));
const ConsoleTemplatesPage = lazy(() => import("./pages/console/templates"));
const ConsoleHistoryPage = lazy(() => import("./pages/console/history"));
const ConsoleDetailPage = lazy(() => import("./pages/console/detail"));

function LazyPage({ children }: { children: ReactNode }) {
    return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

function RouteLoading() {
    return (
        <div className="mx-auto grid w-full max-w-[1480px] gap-3 p-3 md:p-4" role="status" aria-live="polite">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
    );
}

function createDevRoutes(): RouteObject[] {
    if (!import.meta.env.DEV) return [];

    const DesignSandboxPage = lazy(() => import("./pages/dev/design-sandbox"));

    return [
        {
            path: "__design",
            element: <LazyPage><DesignSandboxPage /></LazyPage>,
        },
    ];
}

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <LazyPage><EchoflowImagePublicPage /></LazyPage>,
        },
        ...createDevRoutes(),
        {
            path: "history",
            element: <LazyPage><WebHistoryPage /></LazyPage>,
        },
        {
            path: "history/:id",
            element: <LazyPage><WebDetailPage /></LazyPage>,
        },
    ],
    consoleMenus: [
        {
            title: "运营概览",
            path: "/",
            icon: "bar-chart-3",
        },
        {
            title: "模型配置",
            path: "/models",
            icon: "settings-2",
        },
        {
            title: "风控限流",
            path: "/policies",
            icon: "shield",
        },
        {
            title: "模板预设",
            path: "/templates",
            icon: "sparkles",
        },
        {
            title: "生成历史",
            path: "/history",
            icon: "history",
        },
    ],
    consoleRoutes: [
        {
            index: true,
            element: <LazyPage><EchoflowImageConsolePage /></LazyPage>,
        },
        {
            path: "models",
            element: <LazyPage><ConsoleModelsPage /></LazyPage>,
        },
        {
            path: "policies",
            element: <LazyPage><ConsolePoliciesPage /></LazyPage>,
        },
        {
            path: "templates",
            element: <LazyPage><ConsoleTemplatesPage /></LazyPage>,
        },
        {
            path: "history",
            element: <LazyPage><ConsoleHistoryPage /></LazyPage>,
        },
        {
            path: "history/:id",
            element: <LazyPage><ConsoleDetailPage /></LazyPage>,
        },
    ],
});
