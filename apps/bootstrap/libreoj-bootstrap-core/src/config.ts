export interface ApplicationConfig {
  cdnRoot: string;
  apiEndpoint: string;
  polyfillServiceEndpoint?: string;
  defaultTitle?: string;
  webpackPublicPath?: string;
  favicon?: string;
}
