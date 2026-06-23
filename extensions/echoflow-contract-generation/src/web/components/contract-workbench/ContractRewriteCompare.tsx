import { Button } from "@buildingai/ui/components/ui/button";

export function ContractRewriteCompare(props: {
    original?: string;
    preview: { content: string; reason: string } | null;
    onApply: () => void;
    onCancel: () => void;
}) {
    if (!props.preview) return null;
    return (
        <section className="grid gap-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold tracking-normal">AI 改写对比</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{props.preview.reason}</p>
                </div>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
                <div className="rounded-lg border bg-muted/25 p-2.5">
                    <strong>原条款</strong>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{props.original || "未选择条款"}</p>
                </div>
                <div className="rounded-lg border bg-muted/25 p-2.5">
                    <strong>建议条款</strong>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{props.preview.content}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button size="sm" onClick={props.onApply}>应用改写</Button>
                <Button size="sm" variant="outline" onClick={props.onCancel}>放弃</Button>
            </div>
        </section>
    );
}
