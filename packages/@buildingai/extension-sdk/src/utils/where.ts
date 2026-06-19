export function buildDefinedWhere<TResult extends object>(
    values: Record<string, unknown>,
): TResult {
    return Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined),
    ) as TResult;
}
