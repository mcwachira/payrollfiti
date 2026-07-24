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
  stripe: {
    secretKey?: string;
    webhookSecret?: string;
  };
  mpesa: {
    consumerKey?: string;
    consumerSecret?: string;
    shortcode?: string;
    passkey?: string;
    env: string;
    callbackUrl?: string;
  };
  redisUrl?: string;
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
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    env: process.env.MPESA_ENV ?? 'sandbox',
    callbackUrl: process.env.MPESA_CALLBACK_URL,
  },
  redisUrl: process.env.REDIS_URL,
});
