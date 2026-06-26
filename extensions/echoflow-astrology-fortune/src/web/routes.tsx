import { defineRouteOption } from "@buildingai/web-core";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { lazy, Suspense, type ReactNode } from "react";

import packageJson from "./../../package.json";

const AstrologyFortuneHomePage = lazy(() => import("./pages"));
const AstrologyFortuneConsolePage = lazy(() => import("./pages/console"));

function RouteLoading() {
    return (
        <div className="mx-auto grid w-full max-w-[1480px] gap-3 p-3 md:p-4" role="status" aria-live="polite">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
    );
}

function LazyPage({ children }: { children: ReactNode }) {
    return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

function ConsoleRoute({ section }: { section: "overview" | "settings" | "reports" | "tasks" | "profiles" }) {
    return (
        <LazyPage>
            <AstrologyFortuneConsolePage section={section} />
        </LazyPage>
    );
}

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <LazyPage><AstrologyFortuneHomePage /></LazyPage>,
        },
    ],
    consoleMenus: [
        {
            title: "运营概览",
            path: "/",
            icon: "bar-chart-3",
        },
        {
            title: "模型与价格",
            path: "/settings",
            icon: "settings",
        },
        {
            title: "报告记录",
            path: "/reports",
            icon: "file-text",
        },
        {
            title: "任务与退款",
            path: "/tasks",
            icon: "shield-check",
        },
        {
            title: "用户档案",
            path: "/profiles",
            icon: "users",
        },
    ],
    consoleRoutes: [
        {
            index: true,
            element: <ConsoleRoute section="overview" />,
        },
        {
            path: "settings",
            element: <ConsoleRoute section="settings" />,
        },
        {
            path: "reports",
            element: <ConsoleRoute section="reports" />,
        },
        {
            path: "tasks",
            element: <ConsoleRoute section="tasks" />,
        },
        {
            path: "profiles",
            element: <ConsoleRoute section="profiles" />,
        },
    ],
});
