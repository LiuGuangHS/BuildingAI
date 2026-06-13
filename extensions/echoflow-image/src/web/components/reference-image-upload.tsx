import { ImageUpload } from "@buildingai/ui/components/ui/image-upload";
import type { UploadFileResult } from "@buildingai/services/shared";
import { ImagePlus } from "lucide-react";

interface ReferenceImageUploadProps {
    value?: string;
    onChange: (url?: string, fileId?: string) => void;
    disabled?: boolean;
    helperText?: string;
    label?: string;
    description?: string;
}

export function ReferenceImageUpload({ value, onChange, disabled, helperText, label = "上传参考图", description = "Echoflow Image reference image" }: ReferenceImageUploadProps) {
    return (
        <div className="space-y-2">
            <ImageUpload
                value={value}
                size="xl"
                accept="image/*"
                maxSize={10 * 1024 * 1024}
                disabled={disabled}
                params={{ description, extensionId: "echoflow-image" }}
                placeholder={
                    <div className="text-muted-foreground flex flex-col items-center gap-2 text-xs">
                        <ImagePlus className="size-7" />
                        <span>{label}</span>
                    </div>
                }
                onChange={(url, result?: UploadFileResult) => onChange(url, result?.id)}
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
                {helperText || "上传参考图后将使用图生图模式。"}
            </p>
        </div>
    );
}
