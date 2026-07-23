import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import { env } from "./env.js";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./modules/auth/routes.js";
import usersRoutes from "./modules/users/routes.js";
import menuRoutes from "./modules/menu/routes.js";
import tablesRoutes from "./modules/tables/routes.js";
import ordersRoutes from "./modules/orders/routes.js";
import reservationsRoutes from "./modules/reservations/routes.js";
import printersRoutes from "./modules/printers/routes.js";
import analyticsRoutes from "./modules/analytics/routes.js";
import manualRevenueRoutes from "./modules/manual-revenue/routes.js";
import aiInsightsRoutes from "./modules/ai-insights/routes.js";
import aiChatRoutes from "./modules/ai-chat/routes.js";
import marketingRoutes from "./modules/marketing/routes.js";
import wsRoute from "./ws/route.js";
import { startEmailOrderListener } from "./modules/email-orders/imap-listener.js";
import { startDailyInsightScheduler } from "./modules/ai-insights/scheduler.js";

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(","),
    credentials: true,
  });
  await fastify.register(cookie);
  await fastify.register(websocket);
  await fastify.register(authPlugin);

  await fastify.register(authRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(menuRoutes);
  await fastify.register(tablesRoutes);
  await fastify.register(ordersRoutes);
  await fastify.register(reservationsRoutes);
  await fastify.register(printersRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(manualRevenueRoutes);
  await fastify.register(aiInsightsRoutes);
  await fastify.register(aiChatRoutes);
  await fastify.register(marketingRoutes);
  await fastify.register(wsRoute);

  fastify.get("/api/health", async () => ({ status: "ok" }));

  await fastify.listen({ port: env.port, host: "0.0.0.0" });

  startEmailOrderListener().catch((err) => fastify.log.error(err, "Échec du démarrage de l'écoute IMAP"));
  startDailyInsightScheduler(fastify.log);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
