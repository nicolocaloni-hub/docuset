
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    GS_WEBAPP_URL: string;
    GS_SECRET: string;
    TALLY_API_KEY: string;
    TALLY_WEBHOOK_TOKEN: string;
  }
}
