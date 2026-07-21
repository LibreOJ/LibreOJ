import { Module, Global } from "@nestjs/common";

import { CaptchaModule } from "./captcha/captcha.module";
import { ConfigModule } from "./config/config.module";
import { ProofOfWorkModule } from "./proof-of-work/proof-of-work.module";
import { SettingsModule } from "./settings/settings.module";

const sharedModules = [CaptchaModule, ConfigModule, ProofOfWorkModule, SettingsModule];

@Global()
@Module({
  imports: sharedModules,
  exports: sharedModules
})
export class SharedModule {}
