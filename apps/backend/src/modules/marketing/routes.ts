import type { FastifyInstance } from "fastify";
import {
  Role,
  importMarketingContactsSchema,
  generateCampaignDraftSchema,
  sendCampaignSchema,
} from "@le-tandoor/shared";
import {
  importContacts,
  listContacts,
  deleteContact,
  generateCampaignDraft,
  getMarketingSuggestions,
  buildCampaignPreviewHtml,
  sendCampaign,
  listCampaigns,
} from "./service.js";

const canManage = [Role.ADMIN, Role.MANAGER];

export default async function marketingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole(canManage));

  fastify.get("/api/marketing/contacts", async (_request, reply) => {
    const contacts = await listContacts();
    return reply.send(contacts);
  });

  fastify.post("/api/marketing/contacts/import", async (request, reply) => {
    const parsed = importMarketingContactsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
    }
    try {
      const result = await importContacts(parsed.data.text);
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  fastify.delete("/api/marketing/contacts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteContact(id);
      return reply.code(204).send();
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  fastify.post("/api/marketing/campaigns/draft", async (request, reply) => {
    const parsed = generateCampaignDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
    }
    try {
      const draft = await generateCampaignDraft(parsed.data.brief);
      return reply.send(draft);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  fastify.get("/api/marketing/suggestions", async (_request, reply) => {
    try {
      const suggestions = await getMarketingSuggestions();
      return reply.send(suggestions);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  fastify.post("/api/marketing/preview", async (request, reply) => {
    const { subject, message } = request.body as { subject?: string; message?: string };
    const html = buildCampaignPreviewHtml(subject ?? "", message ?? "");
    return reply.send({ html });
  });

  fastify.post("/api/marketing/campaigns/send", async (request, reply) => {
    const parsed = sendCampaignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Données invalides", details: parsed.error.flatten() });
    }
    try {
      const campaign = await sendCampaign({
        subject: parsed.data.subject,
        message: parsed.data.message,
        contactIds: parsed.data.contactIds,
        userId: request.user!.sub,
      });
      return reply.code(201).send(campaign);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  fastify.get("/api/marketing/campaigns", async (_request, reply) => {
    const campaigns = await listCampaigns();
    return reply.send(campaigns);
  });
}
