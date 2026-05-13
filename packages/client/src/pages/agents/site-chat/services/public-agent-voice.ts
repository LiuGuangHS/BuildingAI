import type { SpeechOptions, TranscribeResult } from "@buildingai/types";
import { createHttpClient } from "@buildingai/utils/http-client";
import { isAxiosError } from "axios";

import { getApiBaseUrl } from "@/utils/api";

import { PublicApiRequestError } from "./public-http";

type PublicVoiceRequestBase = {
  accessToken: string;
  anonymousIdentifier?: string;
};

/**
 * Builds an HTTP client for site-embed voice routes (`/v1/audio-to-text`, `/v1/text-to-audio`).
 */
function createPublicVoiceClient(args: PublicVoiceRequestBase) {
  return createHttpClient({
    baseURL: getApiBaseUrl(),
    timeout: 120_000,
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      ...(args.anonymousIdentifier ? { "X-Anonymous-Identifier": args.anonymousIdentifier } : {}),
    },
  });
}

function unwrapTranscribePayload(payload: unknown): TranscribeResult {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: TranscribeResult }).data;
    if (data && typeof data === "object" && "text" in data) return data;
  }
  return payload as TranscribeResult;
}

function mapAxiosToPublicError(error: unknown): Error {
  if (isAxiosError(error)) {
    const data = error.response?.data as { code?: number; message?: string } | undefined;
    const code = typeof data?.code === "number" ? data.code : undefined;
    const message = data?.message || error.message || "Request failed";
    return new PublicApiRequestError(message, code);
  }
  const e = error as { message?: string };
  return new PublicApiRequestError(e?.message || "Request failed");
}

/**
 * Speech-to-text for a published agent accessed via site embed token.
 * Uses `POST /v1/audio-to-text` (rewrites to internal agent transcribe).
 */
export async function transcribePublicAgentAudio(
  args: PublicVoiceRequestBase & { audioBlob: Blob },
): Promise<TranscribeResult> {
  const client = createPublicVoiceClient(args);
  const formData = new FormData();
  formData.append("file", args.audioBlob, "audio.webm");
  try {
    const body = await client.post<unknown>("/v1/audio-to-text", formData);
    return unwrapTranscribePayload(body);
  } catch (error) {
    throw mapAxiosToPublicError(error);
  }
}

/**
 * Text-to-speech for a published agent accessed via site embed token.
 * Uses `POST /v1/text-to-audio` (rewrites to internal agent speech).
 */
export async function speakPublicAgentText(
  args: PublicVoiceRequestBase & { text: string; options?: SpeechOptions },
): Promise<Blob> {
  const client = createPublicVoiceClient(args);
  try {
    return await client.post<Blob>(
      "/v1/text-to-audio",
      {
        text: args.text,
        modelId: args.options?.modelId,
        voice: args.options?.voice,
        speed: args.options?.speed,
        responseFormat: args.options?.responseFormat ?? "mp3",
      },
      {
        responseType: "blob",
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    throw mapAxiosToPublicError(error);
  }
}
