import { Locale } from "@/interfaces/Locale";

export interface LocaleMeta {
  name: string;
  flag: string;
  tencentCaptchaLanguageCode: string;
}

const localeMeta: Record<Locale, LocaleMeta> = {
  [Locale.zh_CN]: {
    name: "中文（简体）",
    flag: "cn",
    tencentCaptchaLanguageCode: "zh-cn"
  },
  [Locale.en_US]: {
    name: "English",
    flag: "us",
    tencentCaptchaLanguageCode: "en"
  },
  [Locale.ja_JP]: {
    name: "日本語",
    flag: "jp",
    tencentCaptchaLanguageCode: "ja"
  }
};

export default localeMeta;
