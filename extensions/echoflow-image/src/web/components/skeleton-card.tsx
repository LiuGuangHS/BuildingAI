import { Card, CardContent } from "@buildingai/ui/components/ui/card";

export function SkeletonCard({ className = "" }: { className?: string }) {
    return (
        <Card className={`animate-pulse ${className}`}>
            <CardContent className="p-6">
                <div className="bg-muted mb-4 h-4 w-3/4 rounded" />
                <div className="bg-muted mb-2 h-3 w-full rounded" />
                <div className="bg-muted mb-4 h-3 w-1/2 rounded" />
                <div className="bg-muted h-48 w-full rounded-xl" />
            </CardContent>
        </Card>
    );
}

export function HistorySkeleton() {
    return (
        <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse flex gap-3 rounded-xl border bg-background p-3">
                    <div className="bg-muted size-20 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2 py-1">
                        <div className="bg-muted h-3 w-16 rounded" />
                        <div className="bg-muted h-4 w-3/4 rounded" />
                        <div className="bg-muted h-3 w-1/2 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ResultSkeleton() {
    return (
        <Card className="min-h-[520px]">
            <CardContent className="flex h-[480px] flex-col items-center justify-center">
                <div className="border-primary/20 border-t-primary mb-4 size-10 animate-spin rounded-full border-2" />
                <div className="bg-muted mb-2 h-5 w-32 animate-pulse rounded" />
                <div className="bg-muted h-4 w-48 animate-pulse rounded" />
            </CardContent>
        </Card>
    );
}
