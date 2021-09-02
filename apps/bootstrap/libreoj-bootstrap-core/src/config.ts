export interface ApplicationConfig {
  appVersion: string;
  apiEndpoint: string;
  polyfillServiceEndpoint?: string;
  gravatarEndpoint?: string;
  defaultTitle?: string;
  webpackPublicPath?: string;
  favicon?: string;
  logo?: string;
  googleAnalytics?: string;
}
