declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URI: string
      MONGODB_URI: string
      NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string
      TURNSTILE_SECRET_KEY?: string
      QUOTE_IP_HASH_SALT?: string
      JOBS_AUTORUN?: string
      REVALIDATE_SECRET?: string
      SMTP_HOST?: string
      SMTP_PORT?: string
      SMTP_SECURE?: string
      SMTP_USER?: string
      SMTP_PASSWORD?: string
      SMTP_FROM_ADDRESS?: string
      SMTP_FROM_NAME?: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string
      CRON_SECRET: string
      PREVIEW_SECRET: string
      R2_BUCKET: string
      R2_ACCESS_KEY_ID: string
      R2_SECRET_ACCESS_KEY: string
      R2_ENDPOINT: string
      R2_PUBLIC_URL: string
      IMAGE_TAG: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
