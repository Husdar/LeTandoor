import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { loginSchema, changePasswordSchema } from "@le-tandoor/shared";
import { prisma } from "../../db.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../plugins/auth.js";
import { env } from "../../env.js";

const REFRESH_COOKIE = "refresh_token";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Identifiants invalides", details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Email ou mot de passe incorrect" });
    }
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return reply.code(401).send({ error: "Email ou mot de passe incorrect" });
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role, name: user.name });
    const refreshToken = signRefreshToken({ sub: user.id });

    reply.setCookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      // "none" est nécessaire quand le frontend et le backend sont sur des domaines différents
      // (ex: Netlify + Render) — exige "secure: true", déjà le cas en production. En local
      // (même origine, http), "lax" reste plus adapté.
      sameSite: env.nodeEnv === "production" ? "none" : "lax",
      secure: env.nodeEnv === "production",
      path: "/api/auth",
      maxAge: 60 * 60 * 24 * 7,
    });

    return reply.send({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  fastify.post("/api/auth/refresh", async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (!token) {
      return reply.code(401).send({ error: "Session expirée" });
    }
    let sub: string;
    try {
      sub = verifyRefreshToken(token).sub;
    } catch {
      return reply.code(401).send({ error: "Session expirée" });
    }
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Session expirée" });
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role, name: user.name });
    const refreshToken = signRefreshToken({ sub: user.id });
    reply.setCookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      // "none" est nécessaire quand le frontend et le backend sont sur des domaines différents
      // (ex: Netlify + Render) — exige "secure: true", déjà le cas en production. En local
      // (même origine, http), "lax" reste plus adapté.
      sameSite: env.nodeEnv === "production" ? "none" : "lax",
      secure: env.nodeEnv === "production",
      path: "/api/auth",
      maxAge: 60 * 60 * 24 * 7,
    });

    return reply.send({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  fastify.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    return reply.send({ ok: true });
  });

  fastify.post(
    "/api/auth/change-password",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const parsed = changePasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Mot de passe invalide (8 caractères minimum)" });
      }
      const user = await prisma.user.findUnique({ where: { id: request.user!.sub } });
      if (!user) {
        return reply.code(401).send({ error: "Session expirée" });
      }
      const validCurrent = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
      if (!validCurrent) {
        return reply.code(400).send({ error: "Mot de passe actuel incorrect" });
      }
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      return reply.send({ ok: true });
    }
  );

  fastify.get(
    "/api/auth/me",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = await prisma.user.findUnique({ where: { id: request.user!.sub } });
      if (!user || !user.active) {
        return reply.code(401).send({ error: "Session expirée" });
      }
      return reply.send({ id: user.id, name: user.name, email: user.email, role: user.role });
    }
  );
}
