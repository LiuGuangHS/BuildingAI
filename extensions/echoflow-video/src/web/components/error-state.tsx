import { Button } from "@buildingai/ui/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { RefreshCcw, AlertTriangle } from "lucide-react";

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export function ErrorState({
    title = "加载失败",
    message = "数据加载出错，请稍后重试",
    onRetry,
}: ErrorStateProps) {
    return (
        <Alert variant="destructive" className="flex-col items-start gap-4 sm:flex-row sm:items-center">
            <AlertTriangle className="size-5 shrink-0" />
            <div className="flex-1">
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
            </div>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                    <RefreshCcw className="size-4" />
                    重试
                </Button>
            )}
        </Alert>
    );
}
