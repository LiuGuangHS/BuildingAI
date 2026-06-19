import { defineRouteOption } from "@buildingai/web-core";

import packageJson from "./../../package.json";
import AstrologyFortuneConsolePage from "./pages/console";
import AstrologyFortuneHomePage from "./pages";

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <AstrologyFortuneHomePage />,
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
            element: <AstrologyFortuneConsolePage section="overview" />,
        },
        {
            path: "settings",
            element: <AstrologyFortuneConsolePage section="settings" />,
        },
        {
            path: "reports",
            element: <AstrologyFortuneConsolePage section="reports" />,
        },
        {
            path: "tasks",
            element: <AstrologyFortuneConsolePage section="tasks" />,
        },
        {
            path: "profiles",
            element: <AstrologyFortuneConsolePage section="profiles" />,
        },
    ],
});
