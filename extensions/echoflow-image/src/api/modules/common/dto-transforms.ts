export function emptyStringToUndefined({ value }: { value: unknown }) {
    return value === "" ? undefined : value;
}
