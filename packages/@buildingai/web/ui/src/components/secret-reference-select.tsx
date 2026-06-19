import { Label } from "@buildingai/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@buildingai/ui/components/ui/select";

const EMPTY_SECRET_VALUE = "__empty_secret__";

export type SecretReferenceOption = {
  id: string;
  name: string;
};

export type SecretReferenceSelectProps = {
  id?: string;
  label?: string;
  value?: string;
  secretName?: string;
  loading?: boolean;
  options: SecretReferenceOption[];
  emptyLabel?: string;
  placeholder?: string;
  helperText?: string;
  onChange: (secretId: string | undefined, secretName: string | undefined) => void;
};

export function SecretReferenceSelect({
  id,
  label = "主站密钥",
  value,
  secretName,
  loading = false,
  options,
  emptyLabel = "未选择主站密钥",
  placeholder,
  helperText = "从主站密钥管理选择；插件只保存 Secret 引用，不保存密钥值。",
  onChange,
}: SecretReferenceSelectProps) {
  const selectedValue = value?.trim() || "";
  const selectedExists = options.some((item) => item.id === selectedValue);

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select
        value={selectedValue || EMPTY_SECRET_VALUE}
        onValueChange={(next) => {
          if (next === EMPTY_SECRET_VALUE) {
            onChange(undefined, undefined);
            return;
          }
          const selected = options.find((item) => item.id === next);
          onChange(next, selected?.name ?? secretName ?? next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder ?? (loading ? "加载主站密钥..." : "选择主站密钥")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_SECRET_VALUE}>{emptyLabel}</SelectItem>
          {options.map((secret) => (
            <SelectItem key={secret.id} value={secret.id}>
              {secret.name}
            </SelectItem>
          ))}
          {selectedValue && !selectedExists ? (
            <SelectItem value={selectedValue}>{secretName || selectedValue}</SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      {helperText ? <p className="text-muted-foreground text-xs">{helperText}</p> : null}
    </div>
  );
}
