import { Button } from "@buildingai/ui/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";

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
            <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-destructive/40 text-sm font-semibold leading-none"
            >
                !
            </span>
            <div className="flex-1">
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
            </div>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                    <span aria-hidden="true" className="text-xs leading-none">
                        retry
                    </span>
                    重试
                </Button>
            )}
        </Alert>
    );
}
