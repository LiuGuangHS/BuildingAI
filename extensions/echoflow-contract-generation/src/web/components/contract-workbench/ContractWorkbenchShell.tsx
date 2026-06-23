import type { ReactNode } from "react";

import { ContractTaskBar } from "./ContractTaskBar";
import type { ContractWorkbenchState } from "./contract-workbench-view-model";

export function ContractWorkbenchShell(props: {
    state: ContractWorkbenchState;
    intake: ReactNode;
    document: ReactNode;
    inspector: ReactNode;
}) {
    return (
        <main className="contract-workbench grid min-h-full gap-2.5 bg-background p-2.5 text-foreground" data-surface="embedded-plugin">
            <ContractTaskBar state={props.state} />
            <section className="grid min-w-0 grid-cols-1 items-start gap-2.5 lg:grid-cols-[minmax(250px,300px)_minmax(0,1fr)] xl:grid-cols-[minmax(250px,300px)_minmax(430px,1fr)_minmax(270px,320px)]" aria-label="合同 AI 工作台">
                <aside className="grid min-w-0 gap-2">{props.intake}</aside>
                <section className="min-w-0">{props.document}</section>
                <aside className="min-w-0 lg:col-span-2 xl:col-span-1">{props.inspector}</aside>
            </section>
        </main>
    );
}
