import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { askAssistant, type ChatMessage } from "./service.js";

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(20),
});

export default async function aiChatRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.post("/api/ai-chat", async (request, reply) => {
    const parsed = chatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Requête invalide" });
    }
    try {
      const reply_ = await askAssistant(parsed.data.messages as ChatMessage[]);
      return reply.send({ reply: reply_ });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
}
