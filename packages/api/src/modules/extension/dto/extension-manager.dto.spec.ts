import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import {
    ActivationCodeParamDto,
    DownloadExtensionDto,
    ExtensionIdentifierParamDto,
    InstallByActivationCodeDto,
} from "./extension-manager.dto";

describe("extension installation DTOs", () => {
    it("rejects an invalid extension identifier", async () => {
        const errors = await validate(plainToInstance(ExtensionIdentifierParamDto, { identifier: "../private" }));

        expect(errors).not.toHaveLength(0);
    });

    it("accepts a valid scoped extension identifier", async () => {
        const errors = await validate(plainToInstance(ExtensionIdentifierParamDto, { identifier: "@echoflow/image" }));

        expect(errors).toHaveLength(0);
    });

    it("rejects an invalid requested version", async () => {
        const errors = await validate(plainToInstance(DownloadExtensionDto, { version: "latest" }));

        expect(errors).not.toHaveLength(0);
    });

    it("rejects an invalid activation code", async () => {
        const errors = await validate(plainToInstance(ActivationCodeParamDto, { activationCode: "code-123" }));

        expect(errors).not.toHaveLength(0);
    });

    it("validates an activation-code installation request", async () => {
        const errors = await validate(
            plainToInstance(InstallByActivationCodeDto, {
                identifier: "echoflow-image",
                version: "1.2.3",
            }),
        );

        expect(errors).toHaveLength(0);
    });
});
