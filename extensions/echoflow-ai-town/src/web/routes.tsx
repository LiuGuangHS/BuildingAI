import { defineRouteOption } from "@buildingai/web-core";
import { lazy, Suspense } from "react";

import packageJson from "./../../package.json";

const TownIndexPage = lazy(() => import("./pages/index"));
const TownConsolePage = lazy(() => import("./pages/console/saves/list"));
const TownAiConfigPage = lazy(() => import("./pages/console/ai-config"));

function LazyPage({ children }: { children: React.ReactNode }) {
    return <Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}>{children}</Suspense>;
}

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <LazyPage><TownIndexPage /></LazyPage>,
        },
    ],
    consoleMenus: [
        {
            title: "小镇存档",
            path: "/",
            icon: "landmark",
        },
        {
            title: "AI 配置",
            path: "/ai-config",
            icon: "bot",
        },
    ],
    consoleRoutes: [
        {
            index: true,
            element: <LazyPage><TownConsolePage /></LazyPage>,
        },
        {
            path: "ai-config",
            element: <LazyPage><TownAiConfigPage /></LazyPage>,
        },
    ],
});
