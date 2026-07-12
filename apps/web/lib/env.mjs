import { z } from "zod";

const requiredString = z.string().trim().min(1);
const productionEnvironment = z.object({
  DATABASE_URL: requiredString,
  ADMIN_USERNAME: requiredString,
  ADMIN_PASSWORD: requiredString,
  SESSION_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
});
const developmentEnvironment = productionEnvironment.extend({
  APP_URL: z.string().url().optional(),
});

function formatEnvironmentError(error) {
  const missing = new Set();
  const invalid = new Set();

  for (const issue of error.issues) {
    const name = String(issue.path[0]);
    const value = process.env[name];
    if (value === undefined || value.trim() === "") missing.add(name);
    else invalid.add(name);
  }

  if (missing.size > 0) {
    return `Missing required environment variables: ${[...missing].sort().join(", ")}`;
  }

  return `Invalid environment variables: ${[...invalid].sort().join(", ")}`;
}

export function assertAuthenticationEnvironment() {
  const schema = process.env.NODE_ENV === "production"
    ? productionEnvironment
    : developmentEnvironment;
  const result = schema.safeParse(process.env);

  if (!result.success) throw new Error(formatEnvironmentError(result.error));

  return result.data;
}
