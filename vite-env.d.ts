
/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    WA_PHONE_NUMBER_ID: string;
    WA_ACCESS_TOKEN: string;
    WA_BUSINESS_ACCOUNT_ID: string;
    WA_TEMPLATE_NAME: string;
    WA_TEMPLATE_LANG: string;
    WA_VERIFY_TOKEN: string;
  }
}
