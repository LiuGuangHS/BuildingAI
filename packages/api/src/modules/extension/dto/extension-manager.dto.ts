import { IsNotEmpty, IsOptional, IsSemVer, IsString, Matches, MaxLength } from "class-validator";

const EXTENSION_IDENTIFIER_PATTERN = /^(@[a-z0-9]([a-z0-9._-]*[a-z0-9])?\/)?[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
const ACTIVATION_CODE_PATTERN = /^[A-Z0-9]+$/;

export class ExtensionIdentifierParamDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(214)
    @Matches(EXTENSION_IDENTIFIER_PATTERN)
    identifier: string;
}

export class ActivationCodeParamDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(128)
    @Matches(ACTIVATION_CODE_PATTERN)
    activationCode: string;
}

/**
 * Download Extension DTO
 */
export class DownloadExtensionDto {
    /**
     * Extension version
     */
    @IsOptional()
    @IsString({ message: "Extension version must be a string" })
    @MaxLength(20)
    @IsSemVer()
    version?: string;
}

export class InstallByActivationCodeDto extends DownloadExtensionDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(214)
    @Matches(EXTENSION_IDENTIFIER_PATTERN)
    identifier: string;
}

/**
 * Set Platform Secret DTO
 */
export class SetPlatformSecretDto {
    /**
     * Platform secret (optional, can be empty string)
     */
    @IsOptional()
    @IsString({ message: "Platform secret must be a string" })
    platformSecret?: string;
}
