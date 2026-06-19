import { defineRouteOption } from "@buildingai/web-core";

import packageJson from "./../../package.json";
import ProviderConfigPage from "./pages/console/config";
import ConsoleDetailPage from "./pages/console/detail";
import HistoryPage from "./pages/console/history";
import AIVideoConsolePage from "./pages/console/index";
import ConsoleVideoModelsPage from "./pages/console/models";
import ConsoleVideoPoliciesPage from "./pages/console/policies";
import ConsoleStudioReservedPage from "./pages/console/studio";
import ConsoleVideoTemplatesPage from "./pages/console/templates";
import WebDetailPage from "./pages/detail";
import WebHistoryPage from "./pages/history";
import AIVideoIndexPage from "./pages/index";
import WebStudioReservedPage from "./pages/studio";

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    // Web-facing routes (public user)
    routes: [
        {
            index: true,
            element: <AIVideoIndexPage />,
        },
        {
            path: "history",
            element: <WebHistoryPage />,
        },
        {
            path: "studio",
            element: <WebStudioReservedPage />,
        },
        {
            path: ":id",
            element: <WebDetailPage />,
        },
    ],
    // Console routes (admin management)
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
        {
            title: "LLM 与回调",
            path: "/config",
            icon: "settings",
        },
        {
            title: "短视频制作",
            path: "/studio",
            icon: "clapperboard",
        },
    ],
    consoleRoutes: [
        {
            index: true,
            element: <AIVideoConsolePage />,
        },
        {
            path: "models",
            element: <ConsoleVideoModelsPage />,
        },
        {
            path: "policies",
            element: <ConsoleVideoPoliciesPage />,
        },
        {
            path: "templates",
            element: <ConsoleVideoTemplatesPage />,
        },
        {
            path: "config",
            element: <ProviderConfigPage />,
        },
        {
            path: "history",
            element: <HistoryPage />,
        },
        {
            path: "history/:id",
            element: <ConsoleDetailPage />,
        },
        {
            path: "studio",
            element: <ConsoleStudioReservedPage />,
        },
    ],
});
