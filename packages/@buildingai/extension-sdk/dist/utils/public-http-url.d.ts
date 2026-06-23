export interface PublicHttpUrlOptions {
    label?: string;
}
export interface ResolvedPublicHttpUrl {
    normalized: string;
    url: URL;
    address: string;
    family: 4 | 6;
}
export { isPrivateOrReservedIp } from "@buildingai/utils";
export declare function normalizePublicHttpUrl(value: string, options?: PublicHttpUrlOptions): string;
export declare function resolvePublicHttpUrl(value: string, options?: PublicHttpUrlOptions): Promise<ResolvedPublicHttpUrl>;
export declare function assertPublicHttpUrl(value: string, options?: PublicHttpUrlOptions): Promise<string>;
//# sourceMappingURL=public-http-url.d.ts.map