import { uploadFileAuto } from "@buildingai/services/shared";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { cn } from "@buildingai/ui/lib/utils";
import { Brush, RotateCcw, Upload } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Point = { x: number; y: number };
type Stroke = { points: Point[]; size: number };

interface MaskCanvasProps {
    referenceImageUrl?: string;
    disabled?: boolean;
    onMaskGenerated: (url: string, fileId: string) => void;
}

export function MaskCanvas({ referenceImageUrl, disabled, onMaskGenerated }: MaskCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const strokesRef = useRef<Stroke[]>([]);
    const activeStrokeRef = useRef<Stroke | null>(null);
    const [brushSize, setBrushSize] = useState(44);
    const [imageSize, setImageSize] = useState({ width: 1024, height: 1024 });
    const [hasMask, setHasMask] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        strokesRef.current = [];
        activeStrokeRef.current = null;
        setHasMask(false);
        clearOverlay();
    }, [referenceImageUrl]);

    const clearOverlay = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        context?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const redrawOverlay = () => {
        clearOverlay();
        const context = canvasRef.current?.getContext("2d");
        if (!context) return;

        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = "rgba(239, 68, 68, 0.55)";
        context.fillStyle = "rgba(239, 68, 68, 0.55)";

        for (const stroke of strokesRef.current) {
            drawStroke(context, stroke);
        }
    };

    const getPoint = (event: PointerEvent<HTMLCanvasElement>): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * canvas.width,
            y: ((event.clientY - rect.top) / rect.height) * canvas.height,
        };
    };

    const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        if (disabled || !referenceImageUrl) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.setPointerCapture(event.pointerId);
        const stroke = { points: [getPoint(event)], size: brushSize };
        activeStrokeRef.current = stroke;
        strokesRef.current.push(stroke);
        setHasMask(true);
        redrawOverlay();
    };

    const draw = (event: PointerEvent<HTMLCanvasElement>) => {
        const stroke = activeStrokeRef.current;
        if (!stroke) return;
        stroke.points.push(getPoint(event));
        redrawOverlay();
    };

    const stopDrawing = () => {
        activeStrokeRef.current = null;
    };

    const reset = () => {
        strokesRef.current = [];
        activeStrokeRef.current = null;
        setHasMask(false);
        clearOverlay();
    };

    const exportMask = async () => {
        if (!hasMask) return;
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = imageSize.width;
        maskCanvas.height = imageSize.height;
        const context = maskCanvas.getContext("2d");
        if (!context) return;

        context.fillStyle = "black";
        context.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        context.globalCompositeOperation = "destination-out";
        for (const stroke of strokesRef.current) {
            drawStroke(context, stroke);
        }

        setUploading(true);
        try {
            const blob = await new Promise<Blob | null>((resolve) => maskCanvas.toBlob(resolve, "image/png"));
            if (!blob) throw new Error("遮罩生成失败");
            const file = new File([blob], `echoflow-mask-${Date.now()}.png`, { type: "image/png" });
            const result = await uploadFileAuto(file, {
                description: "Echoflow Image mask image",
                extensionId: "echoflow-image",
            });
            onMaskGenerated(result.url, result.id);
            toast.success("遮罩图已生成");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "遮罩上传失败");
        } finally {
            setUploading(false);
        }
    };

    if (!referenceImageUrl) return null;

    return (
        <div className="space-y-3 rounded-xl border border-border/60 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Brush className="size-4 text-primary" />
                    局部重绘画布
                </div>
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">画笔</Label>
                    <Input
                        type="range"
                        min={12}
                        max={120}
                        value={brushSize}
                        disabled={disabled}
                        onChange={(event) => setBrushSize(Number(event.target.value))}
                        className="h-8 w-28"
                    />
                </div>
            </div>

            <div className="relative overflow-hidden rounded-lg border bg-muted">
                <img
                    src={referenceImageUrl}
                    alt="局部重绘参考图"
                    className="block max-h-[360px] w-full object-contain"
                    onLoad={(event) => {
                        const img = event.currentTarget;
                        setImageSize({ width: img.naturalWidth || 1024, height: img.naturalHeight || 1024 });
                    }}
                />
                <canvas
                    ref={canvasRef}
                    width={imageSize.width}
                    height={imageSize.height}
                    className={cn(
                        "absolute inset-0 size-full touch-none",
                        disabled ? "cursor-not-allowed" : "cursor-crosshair",
                    )}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                    onPointerLeave={stopDrawing}
                />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" size="sm" disabled={disabled || uploading || !hasMask} onClick={reset}>
                    <RotateCcw className="size-3.5" />
                    清除遮罩
                </Button>
                <Button type="button" size="sm" disabled={disabled || uploading || !hasMask} loading={uploading} onClick={exportMask}>
                    <Upload className="size-3.5" />
                    生成遮罩
                </Button>
            </div>
        </div>
    );
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
    context.lineWidth = stroke.size;
    if (stroke.points.length === 1) {
        const point = stroke.points[0];
        context.beginPath();
        context.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
        context.fill();
        return;
    }

    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (const point of stroke.points.slice(1)) {
        context.lineTo(point.x, point.y);
    }
    context.stroke();
}
