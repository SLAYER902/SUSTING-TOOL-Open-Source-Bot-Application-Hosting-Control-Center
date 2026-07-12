import argon2 from "argon2";
import { Prisma, PrismaClient } from "@prisma/client";
import { assertAuthenticationEnvironment } from "../lib/env.mjs";

const prisma = new PrismaClient();

function validatePassword(password) {
  if (password.length < 14) return "too short";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return "missing required character classes";
  if (/^(password|admin|123456|qwerty)/i.test(password)) return "too predictable";
  return null;
}

function isConfigurationError(error) {
  return error instanceof Error && /^(Missing required|Invalid) environment variables:/.test(error.message);
}

async function ensureInitialAdmin() {
  const environment = assertAuthenticationEnvironment();
  const username = environment.ADMIN_USERNAME.trim();
  const existingUser = await prisma.user.findUnique({ where: { username } });

  if (existingUser) return;

  if (validatePassword(environment.ADMIN_PASSWORD)) {
    throw new Error("Invalid environment variables: ADMIN_PASSWORD");
  }

  try {
    await prisma.user.create({
      data: {
        username,
        email: process.env.ADMIN_EMAIL || null,
        passwordHash: await argon2.hash(environment.ADMIN_PASSWORD, { type: argon2.argon2id }),
        role: "OWNER",
      },
    });
    console.info("[startup/init-admin] Initial administrator created.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

try {
  await ensureInitialAdmin();
} catch (error) {
  console.error("[startup/init-admin] Initial administrator setup failed", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: isConfigurationError(error) ? error.message : "Database initialization failed.",
  });
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
