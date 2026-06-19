export interface PublicHttpUrlOptions {
    label?: string;
}
export declare function isPrivateOrReservedIp(address: string): boolean;
export declare function normalizePublicHttpUrl(value: string, options?: PublicHttpUrlOptions): string;
export declare function assertPublicHttpUrl(value: string, options?: PublicHttpUrlOptions): Promise<string>;
//# sourceMappingURL=public-http-url.d.ts.map