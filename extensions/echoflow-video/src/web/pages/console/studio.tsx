import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { Clapperboard, Clock } from "lucide-react";

import { ConsolePage } from "../../components/console-page";

export default function ConsoleStudioReservedPage() {
    useDocumentHead({ title: "短视频制作 - 视频生成管理" });

    return (
        <ConsolePage>
            <div className="max-w-3xl space-y-4">
                <Badge variant="secondary">预留入口</Badge>
                <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                    <Clapperboard className="size-6 text-primary" />
                    短视频制作
                </h1>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <Clock className="size-5 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            后续将作为独立项目式工作流管理脚本、分镜、素材、配音、字幕和合成队列。
                        </p>
                    </CardContent>
                </Card>
            </div>
        </ConsolePage>
    );
}
