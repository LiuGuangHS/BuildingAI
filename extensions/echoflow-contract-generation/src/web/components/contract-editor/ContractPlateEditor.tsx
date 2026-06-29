import { useEffect, useRef } from "react";

import type { ContractSection } from "../../services/types";
import type { DocumentSection } from "./contract-document-model";

type ContractTextEditorProps = {
    documentId: string;
    editable: boolean;
    sections: DocumentSection[];
    sourceSections: ContractSection[];
    selectedSectionIndex: number;
    sectionAnnotations?: Array<{ label: string; level?: "low" | "medium" | "high"; issue?: string }>;
    onSelectSection?: (index: number) => void;
    onSectionsChange: (sections: ContractSection[]) => void;
};

export function ContractPlateEditor({ documentId, editable, sections, sourceSections, selectedSectionIndex, sectionAnnotations, onSelectSection, onSectionsChange }: ContractTextEditorProps) {
    const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);

    useEffect(() => {
        sectionRefs.current[selectedSectionIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [selectedSectionIndex]);

    function replaceSectionContent(index: number, content: string) {
        const nextSections = sections.map((section, sectionIndex) => {
            const previous = sourceSections[sectionIndex];
            return {
                id: previous?.id,
                title: section.title,
                content: sectionIndex === index ? content || "待补充条款内容。" : section.content,
                importance: previous?.importance ?? section.importance,
            };
        });
        onSectionsChange(nextSections);
    }

    return (
        <div className="grid gap-5">
            {sections.map((section, index) => (
                <section
                    key={`${documentId}:${section.id ?? index}:${section.title}`}
                    ref={(element) => {
                        sectionRefs.current[index] = element;
                    }}
                    className={index === selectedSectionIndex ? "contract-clause-block is-active rounded-lg px-3 py-3" : "contract-clause-block rounded-lg px-3 py-3"}
                    onClick={() => onSelectSection?.(index)}
                >
                    {sectionAnnotations?.[index]?.level && <span className="contract-clause-gutter" data-level={sectionAnnotations[index].level} aria-hidden="true" />}
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">第 {index + 1} 条</span>
                        <h3 className="text-base font-semibold tracking-normal">{section.title}</h3>
                        {sectionAnnotations?.[index] && (
                            <span className="contract-section-ai-marker" data-level={sectionAnnotations[index].level ?? "none"} title={sectionAnnotations[index].issue} aria-label={sectionAnnotations[index].issue ? `${sectionAnnotations[index].label}：${sectionAnnotations[index].issue}` : sectionAnnotations[index].label}>
                                {sectionAnnotations[index].label}
                            </span>
                        )}
                    </div>
                    <SectionTextEditor
                        key={`${documentId}:${section.id ?? index}:editor`}
                        documentId={`${documentId}:${section.id ?? index}`}
                        editable={editable}
                        content={section.content}
                        onChange={(content) => replaceSectionContent(index, content)}
                    />
                </section>
            ))}
        </div>
    );
}

function SectionTextEditor({ documentId, editable, content, onChange }: { documentId: string; editable: boolean; content: string; onChange: (content: string) => void }) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        textareaRef.current?.scrollTo({ top: 0 });
    }, [documentId]);

    return (
        <textarea
            ref={textareaRef}
            className="contract-text-editor"
            disabled={!editable}
            placeholder={editable ? "在这里编辑条款正文..." : "填写左侧合同信息后，可生成正式合同初稿。"}
            value={content}
            onChange={(event) => onChange(event.target.value)}
        />
    );
}
