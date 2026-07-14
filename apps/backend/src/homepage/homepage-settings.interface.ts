import { ApiProperty } from "@nestjs/swagger";

import { IsBoolean, isDateString, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

import { Locale } from "../common/locale.type";
import { If } from "../common/validators";
import { Settings } from "../settings/settings.decorator";

export class HomepageSettingsNotice {
  @IsBoolean()
  @ApiProperty()
  enabled: boolean;

  @If(x => Object.entries(x).every(([key, value]) => key in Locale && typeof value === "string"))
  @ApiProperty()
  contents: Partial<Record<Locale, string>>;
}

export class HomepageSettingsAnnouncements {
  @If(x =>
    Object.entries(x).every(
      ([key, value]) => key in Locale && Array.isArray(value) && value.every(Number.isSafeInteger)
    )
  )
  @ApiProperty()
  items: Partial<Record<Locale, number[]>>;
}

export class HomepageSettingsHitokoto {
  @IsBoolean()
  @ApiProperty()
  enabled: boolean;

  @IsString()
  @ApiProperty()
  apiUrl: string;

  @IsString()
  @IsOptional()
  @ApiProperty()
  customTitle?: string;
}

export class HomepageSettingsCountdown {
  @IsBoolean()
  @ApiProperty()
  enabled: boolean;

  @If(x => Object.entries(x).every(([key, value]) => key.trim().length > 0 && isDateString(value)))
  @ApiProperty()
  items: Record<string, string>;
}

export class HomepageSettingsFriendLinks {
  @IsBoolean()
  @ApiProperty()
  enabled: boolean;

  @If(x => Object.entries(x).every(([key, value]) => key.trim().length > 0 && typeof value === "string"))
  @ApiProperty()
  links: Record<string, string>;
}

@Settings("homepage")
export class HomepageSettings {
  @ValidateNested()
  @Type(() => HomepageSettingsNotice)
  @ApiProperty()
  notice: HomepageSettingsNotice;

  @ValidateNested()
  @Type(() => HomepageSettingsAnnouncements)
  @ApiProperty()
  annnouncements: HomepageSettingsAnnouncements;

  @ValidateNested()
  @Type(() => HomepageSettingsHitokoto)
  @ApiProperty()
  hitokoto: HomepageSettingsHitokoto;

  @ValidateNested()
  @Type(() => HomepageSettingsCountdown)
  @ApiProperty()
  countdown: HomepageSettingsCountdown;

  @ValidateNested()
  @Type(() => HomepageSettingsFriendLinks)
  @ApiProperty()
  friendLinks: HomepageSettingsFriendLinks;

  static defaultValue: HomepageSettings = {
    notice: {
      enabled: true,
      contents: {
        [Locale.en_US]:
          "## Congratulations 🎉\n\nIf you see this notice, the LibreOJ online judge system is successfully installed and working. Further configuration is required.\n\nYou can edit or disable this message in [Homepage Settings](/homepage-settings).\n\n**Thank you for using LibreOJ.**",
        [Locale.zh_CN]:
          "## 恭喜 🎉\n\n如果您看到该提示，说明 LibreOJ 在线评测系统已经成功安装并正在工作。接下来您需要进行配置。\n\n您可以在[首页设置](/homepage-settings)中编辑或禁用该信息。\n\n**感谢您使用 LibreOJ。**"
      }
    },
    annnouncements: {
      items: {}
    },
    hitokoto: {
      enabled: true,
      apiUrl: "https://v1.hitokoto.cn/?c=a"
    },
    countdown: {
      enabled: true,
      items: {
        "NOIP 2021": "2021-11-07T00:00:00.000Z"
      }
    },
    friendLinks: {
      enabled: true,
      links: {
        LibreOJ: "https://loj.ac"
      }
    }
  };
}
