import { defineRouteOption } from "@buildingai/web-core";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@buildingai/ui/components/ui/card";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { lazy, Suspense, type ReactNode } from "react";

import packageJson from "./../../package.json";

const AIVideoIndexPage = lazy(() => import("./pages/index"));
const WebHistoryPage = lazy(() => import("./pages/history"));
const WebStudioReservedPage = lazy(() => import("./pages/studio"));
const WebDetailPage = lazy(() => import("./pages/detail"));
const AIVideoConsolePage = lazy(() => import("./pages/console/index"));
const ConsoleVideoModelsPage = lazy(() => import("./pages/console/models"));
const ConsoleVideoPoliciesPage = lazy(() => import("./pages/console/policies"));
const ConsoleVideoTemplatesPage = lazy(() => import("./pages/console/templates"));
const ProviderConfigPage = lazy(() => import("./pages/console/config"));
const HistoryPage = lazy(() => import("./pages/console/history"));
const ConsoleDetailPage = lazy(() => import("./pages/console/detail"));
const ConsoleStudioReservedPage = lazy(() => import("./pages/console/studio"));

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

function RouteError() {
    return (
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 p-3 md:p-4">
            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <span className="flex size-5 items-center justify-center rounded-sm border text-xs text-muted-foreground" aria-hidden="true">
                            !
                        </span>
                        页面暂时不可达
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                        当前视频工作台页面没有加载完成。请刷新后重试；如果仍然失败，保留当前任务状态后稍后再回来查看。
                    </p>
                    <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                        <span aria-hidden="true">↻</span>
                        重新加载
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

function routeErrorElement() {
    return <RouteError />;
}

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    // Web-facing routes (public user)
    routes: [
        {
            index: true,
            element: <LazyPage><AIVideoIndexPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: "history",
            element: <LazyPage><WebHistoryPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: "studio",
            element: <LazyPage><WebStudioReservedPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: ":id",
            element: <LazyPage><WebDetailPage /></LazyPage>,
            errorElement: routeErrorElement(),
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
            element: <LazyPage><AIVideoConsolePage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: "models",
            element: <LazyPage><ConsoleVideoModelsPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: "policies",
            element: <LazyPage><ConsoleVideoPoliciesPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: "templates",
            element: <LazyPage><ConsoleVideoTemplatesPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: "config",
            element: <LazyPage><ProviderConfigPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: "history",
            element: <LazyPage><HistoryPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: "history/:id",
            element: <LazyPage><ConsoleDetailPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
        {
            path: "studio",
            element: <LazyPage><ConsoleStudioReservedPage /></LazyPage>,
            errorElement: routeErrorElement(),
        },
    ],
});
