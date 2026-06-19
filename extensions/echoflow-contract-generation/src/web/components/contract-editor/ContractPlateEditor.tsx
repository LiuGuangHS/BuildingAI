import { useEffect, useMemo, useRef, useState } from "react";
import { Plate, PlateContainer, PlateContent, usePlateEditor } from "platejs/react";

import type { ContractSection } from "../../services/types";
import type { ContractPlateNode, DocumentSection } from "./contract-document-model";
import { plateValueToPlainText, sectionContentToPlateValue } from "./contract-document-model";

type ContractPlateEditorProps = {
    documentId: string;
    editable: boolean;
    sections: DocumentSection[];
    sourceSections: ContractSection[];
    selectedSectionIndex: number;
    onSectionsChange: (sections: ContractSection[]) => void;
};

export function ContractPlateEditor({ documentId, editable, sections, sourceSections, selectedSectionIndex, onSectionsChange }: ContractPlateEditorProps) {
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
        <div className="contract-section-editor-list">
            {sections.map((section, index) => (
                <section
                    key={`${documentId}:${section.id ?? index}:${section.title}`}
                    ref={(element) => {
                        sectionRefs.current[index] = element;
                    }}
                    className="contract-section-editor"
                    data-active={index === selectedSectionIndex ? "true" : "false"}
                >
                    <div className="contract-section-heading">
                        <span>第 {index + 1} 条</span>
                        <h3>{section.title}</h3>
                    </div>
                    <SectionPlateEditor
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

function SectionPlateEditor({ documentId, editable, content, onChange }: { documentId: string; editable: boolean; content: string; onChange: (content: string) => void }) {
    const skipNextChangeRef = useRef(true);
    const [editorKey, setEditorKey] = useState(documentId);
    const value = useMemo(() => sectionContentToPlateValue(content), [editorKey]);
    const editor = usePlateEditor({
        id: `contract-section-${editorKey}`,
        value,
    });

    useEffect(() => {
        skipNextChangeRef.current = true;
        setEditorKey(documentId);
    }, [documentId]);

    function handleValueChange({ value: nextValue }: { value: ContractPlateNode[] }) {
        if (!editable) return;
        if (skipNextChangeRef.current) {
            skipNextChangeRef.current = false;
            return;
        }
        onChange(plateValueToPlainText(nextValue));
    }

    return (
        <Plate editor={editor} onValueChange={handleValueChange}>
            <PlateContainer className="contract-plate-container" data-editable={editable ? "true" : "false"}>
                <PlateContent
                    className="contract-plate-editor"
                    disabled={!editable}
                    disableDefaultStyles
                    placeholder={editable ? "在这里编辑条款正文..." : "填写左侧合同信息后，可生成正式合同初稿。"}
                />
            </PlateContainer>
        </Plate>
    );
}
