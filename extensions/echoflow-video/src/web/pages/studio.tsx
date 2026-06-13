import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { ArrowLeft, Clapperboard, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WebStudioReservedPage() {
    useDocumentHead({ title: "短视频制作 - AI视频工作台" });
    const navigate = useNavigate();

    return (
        <div className="min-h-screen space-y-6 p-4 md:p-6">
            <Button variant="ghost" className="w-fit" onClick={() => navigate("/")}>
                <ArrowLeft className="size-4" />
                返回工作台
            </Button>
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
                            该入口已预留，当前版本优先完成 HappyHorse 通用视频生成工作台。
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
