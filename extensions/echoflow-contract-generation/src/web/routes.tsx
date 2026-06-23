import { defineRouteOption } from "@buildingai/web-core";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { lazy, Suspense, type ReactNode } from "react";

import packageJson from "./../../package.json";

const ContractGenerationHomePage = lazy(() => import("./pages"));
const ContractGenerationConfigPage = lazy(() => import("./pages/console/config"));
const ContractTemplatesConsolePage = lazy(() => import("./pages/console/templates"));
const ContractTasksConsolePage = lazy(() => import("./pages/console/tasks"));

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

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <LazyPage><ContractGenerationHomePage /></LazyPage>,
        },
    ],
    consoleMenus: [
        {
            title: "模型配置",
            path: "/",
            icon: "settings-2",
        },
        {
            title: "合同模板",
            path: "/templates",
            icon: "file-text",
        },
        {
            title: "生成任务",
            path: "/tasks",
            icon: "list-checks",
        },
    ],
    consoleRoutes: [
        {
            index: true,
            element: <LazyPage><ContractGenerationConfigPage /></LazyPage>,
        },
        {
            path: "templates",
            element: <LazyPage><ContractTemplatesConsolePage /></LazyPage>,
        },
        {
            path: "tasks",
            element: <LazyPage><ContractTasksConsolePage /></LazyPage>,
        },
    ],
});
