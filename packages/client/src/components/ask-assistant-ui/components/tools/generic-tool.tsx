import {
  getStatusBadge,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@buildingai/ui/components/ai-elements/tool";
import { WrenchIcon } from "lucide-react";
import { memo } from "react";

interface ToolPartData {
  toolCallId: string;
  state: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  approval?: { id?: string; approved?: boolean };
}

export interface GenericToolProps {
  toolName: string;
  toolPart: ToolPartData;
  showDetails?: boolean;
}

export const GenericTool = memo(function GenericTool({
  toolName,
  toolPart,
  showDetails = true,
}: GenericToolProps) {
  if (!showDetails) {
    return (
      <div className="group not-prose mb-4 w-full rounded-md border">
        <div className="flex w-full items-center justify-between gap-4 p-3">
          <div className="flex items-center gap-2">
            <WrenchIcon className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">{toolName}</span>
            {getStatusBadge(toolPart.state as never)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Tool>
      <ToolHeader state={toolPart.state as never} title={toolName} type="tool-invocation" />
      <ToolContent>
        <ToolInput input={toolPart.input} />
        <ToolOutput errorText={toolPart.errorText} output={toolPart.output} />
      </ToolContent>
    </Tool>
  );
});
