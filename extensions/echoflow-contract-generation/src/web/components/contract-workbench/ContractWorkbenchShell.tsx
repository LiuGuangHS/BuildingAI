import type { ReactNode } from "react";

import { ContractTaskBar } from "./ContractTaskBar";
import type { ContractWorkbenchState } from "./contract-workbench-view-model";

export function ContractWorkbenchShell(props: {
    state: ContractWorkbenchState;
    topTools?: ReactNode;
    intake: ReactNode;
    document: ReactNode;
    inspector: ReactNode;
}) {
    return (
        <main className="contract-workbench grid min-h-full gap-4 p-4 text-foreground" data-surface="embedded-plugin">
            <ContractTaskBar state={props.state} tools={props.topTools} />
            <section className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,320px)_minmax(620px,1fr)_minmax(300px,360px)]" aria-label="合同 AI 工作台">
                <aside className="contract-intake-column grid min-w-0 gap-3">{props.intake}</aside>
                <section className="contract-document-column min-w-0">{props.document}</section>
                <aside className="contract-review-column min-w-0 lg:col-span-2 xl:col-span-1">{props.inspector}</aside>
            </section>
        </main>
    );
}
