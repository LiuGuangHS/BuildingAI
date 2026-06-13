import { Logger } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:";
const KEY_SALT = "echoflow-video-encryption";

function deriveKey(): Buffer {
    const secret =
        process.env.EXTENSION_ENCRYPTION_KEY ||
        process.env.JWT_SECRET ||
        "echoflow-video-default-key-change-me";
    return scryptSync(secret, KEY_SALT, 32);
}

/**
 * Encrypt plaintext → "enc:ivHex:authTagHex:ciphertextHex"
 */
export function encryptApiKey(plaintext: string): string {
    const key = deriveKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${ENCRYPTED_PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt "enc:ivHex:authTagHex:ciphertextHex" → plaintext.
 * If the value does not start with "enc:", return as-is (plaintext backward compat).
 */
export function decryptApiKey(stored: string): string {
    if (!stored.startsWith(ENCRYPTED_PREFIX)) {
        return stored;
    }

    const payload = stored.slice(ENCRYPTED_PREFIX.length);
    const parts = payload.split(":");
    if (parts.length !== 3) {
        Logger.warn(`Invalid encrypted API key format, treating as plaintext`);
        return stored;
    }

    try {
        const iv = Buffer.from(parts[0], "hex");
        const authTag = Buffer.from(parts[1], "hex");
        const ciphertext = Buffer.from(parts[2], "hex");
        const key = deriveKey();
        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch (error) {
        Logger.error(`Failed to decrypt API key: ${(error as Error).message}`);
        return stored;
    }
}

/** Check whether a stored value is already encrypted */
export function isEncrypted(value: string): boolean {
    return value.startsWith(ENCRYPTED_PREFIX);
}
