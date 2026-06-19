/// <reference path="../../../jest-globals.d.ts" />

import { HttpError } from "@buildingai/errors";

import { VideoRequestLimiterService } from "../../../../../src/api/modules/generation/services/video-request-limiter.service";

const redisService = {
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
};

function makeService() {
    return new VideoRequestLimiterService(redisService as any);
}

beforeEach(() => {
    jest.clearAllMocks();
    redisService.ttl.mockResolvedValue(8);
});

describe("VideoRequestLimiterService", () => {
    it("allows requests inside both rate limit windows", async () => {
        redisService.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

        await makeService().assertAllowed("generation", "user-1");

        expect(redisService.incr).toHaveBeenCalledWith("echoflow-video:rate:generation:short:user-1");
        expect(redisService.incr).toHaveBeenCalledWith("echoflow-video:rate:generation:minute:user-1");
        expect(redisService.expire).toHaveBeenCalledWith("echoflow-video:rate:generation:short:user-1", 10);
        expect(redisService.expire).toHaveBeenCalledTimes(1);
    });

    it("throws 429 when a rate limit window is exceeded", async () => {
        redisService.incr.mockResolvedValueOnce(6);
        const promise = makeService().assertAllowed("generation", "user-1");

        await expect(promise).rejects.toMatchObject({
            httpStatus: 429,
            businessCode: 40700,
        });
        await expect(promise).rejects.toBeInstanceOf(HttpError);
    });

    it("does not block the business flow when Redis is unavailable", async () => {
        redisService.incr.mockRejectedValueOnce(new Error("redis down")).mockResolvedValueOnce(1);

        await expect(makeService().assertAllowed("prompt-optimization", "user-1")).resolves.toBeUndefined();

        expect(redisService.incr).toHaveBeenCalledTimes(2);
    });
});
