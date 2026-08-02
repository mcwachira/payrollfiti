export interface AppConfig {
  appName: string;
  nodeEnv: string;
  port: number;
  countryDefault: string;
  corsOrigin: string;
  throttle: {
    ttl: number;
    limit: number;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  paystack: {
    secretKey?: string;
  };
  mpesa: {
    consumerKey?: string;
    consumerSecret?: string;
    shortcode?: string;
    passkey?: string;
    env: string;
    callbackUrl?: string;
    /** Shared secret appended to the callback URL query string, since
     *  Safaricom does not sign its STK push callbacks. */
    callbackToken?: string;
  };
  redisUrl?: string;
  encryptionKey?: string;
  smtp: {
    host?: string;
    port: number;
    user?: string;
    pass?: string;
    from: string;
  };
  africasTalking: {
    apiKey?: string;
    username?: string;
    senderId?: string;
  };
  sentryDsn?: string;
}

export default (): AppConfig => ({
  appName: process.env.APP_NAME ?? 'PayrollFiti',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  countryDefault: process.env.COUNTRY_DEFAULT ?? 'KE',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
  },
  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    env: process.env.MPESA_ENV ?? 'sandbox',
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    callbackToken: process.env.MPESA_CALLBACK_TOKEN,
  },
  redisUrl: process.env.REDIS_URL,
  encryptionKey: process.env.ENCRYPTION_KEY,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'PayrollFiti <noreply@payrollfiti.com>',
  },
  africasTalking: {
    apiKey: process.env.AFRICAS_TALKING_API_KEY,
    username: process.env.AFRICAS_TALKING_USERNAME,
    senderId: process.env.AFRICAS_TALKING_SENDER_ID,
  },
  sentryDsn: process.env.SENTRY_DSN,
});
