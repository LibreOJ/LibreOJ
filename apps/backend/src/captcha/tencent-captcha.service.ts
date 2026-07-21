import crypto from "crypto";

import { Injectable, Logger } from "@nestjs/common";

import { captcha } from "tencentcloud-sdk-nodejs-captcha";

import { ConfigService } from "../config/config.service";

@Injectable()
export class TencentCaptchaService {
  private readonly logger = new Logger(TencentCaptchaService.name);

  private readonly client?: InstanceType<typeof captcha.v20190722.Client>;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.config.security.captcha.tencentCaptcha;
    if (config) {
      this.client = new captcha.v20190722.Client({
        credential: {
          secretId: config.secretId,
          secretKey: config.secretKey
        }
      });
    }
  }

  get isConfigured(): boolean {
    return !!this.configService.config.security.captcha.tencentCaptcha;
  }

  acquireEncryptedAppId(): { appId: string; encryptedAppId: string; encryptedAppIdType: "gcm" } {
    const config = this.configService.config.security.captcha.tencentCaptcha;
    if (!config) throw new Error("Tencent Captcha is not configured");

    // Tencent accepts Base64(IV + ciphertext + tag) for AES-256-GCM and can reject reused IVs:
    // https://cloud.tencent.com/document/product/1110/128489
    const sourceKey = Buffer.from(config.appSecretKey, "ascii");
    const key = Buffer.alloc(32);
    for (let index = 0; index < key.length; index += 1) key[index] = sourceKey[index % sourceKey.length];

    const iv = crypto.randomBytes(12);
    const timestamp = Math.floor(Date.now() / 1000);
    const plaintext = `${config.appId}&${timestamp}&60`;
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

    return {
      appId: String(config.appId),
      encryptedAppId: Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString("base64"),
      encryptedAppIdType: "gcm"
    };
  }

  async verify(ticket: string, randStr: string, userIp: string): Promise<boolean> {
    const config = this.configService.config.security.captcha.tencentCaptcha;
    if (!config || !this.client) throw new Error("Tencent Captcha is not configured");

    const response = await this.client.DescribeCaptchaResult({
      CaptchaType: 9,
      Ticket: ticket,
      UserIp: userIp,
      Randstr: randStr,
      CaptchaAppId: config.appId,
      AppSecretKey: config.appSecretKey
    });

    this.logger.debug(
      `Tencent Captcha verification result: code=${response.CaptchaCode}, message=${response.CaptchaMsg}, requestId=${response.RequestId}`
    );
    return response.CaptchaCode === 1;
  }
}
