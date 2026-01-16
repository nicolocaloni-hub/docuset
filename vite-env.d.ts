
// Fix: Removed problematic vite/client reference that could not be found
// and replaced the var process redeclaration with a proper NodeJS namespace extension.
// This allows both frontend and backend (Vercel API) files to correctly access process.env properties.
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    GS_WEBAPP_URL: string;
    GS_SECRET: string;
  }
}
