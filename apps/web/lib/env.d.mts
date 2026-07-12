export interface AuthenticationEnvironment {
  DATABASE_URL: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  APP_URL?: string;
}

export function assertAuthenticationEnvironment(): AuthenticationEnvironment;
