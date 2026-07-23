function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-5",
  imapHost: process.env.IMAP_HOST ?? "imap.mail.me.com",
  imapPort: Number(process.env.IMAP_PORT ?? 993),
  imapUser: process.env.IMAP_USER,
  imapPassword: process.env.IMAP_PASSWORD,
  // Une commande génère plusieurs emails (nouvelle commande / confirmée / expédiée) depuis des
  // sous-domaines différents (account./store.hostinger.com) — liste séparée par des virgules.
  orderEmailSenders: (
    process.env.ORDER_EMAIL_SENDER ?? "noreply@account.hostinger.com,noreply@store.hostinger.com"
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  orderEmailSubjectPattern: process.env.ORDER_EMAIL_SUBJECT_PATTERN ?? "commande",
  // Jeton partagé avec le petit relais d'impression local (voir apps/print-relay) — le backend
  // étant hébergé à distance, il ne peut pas atteindre directement les imprimantes du réseau
  // local du restaurant ; le relais tourne sur place et transmet les tickets en TCP.
  printRelayToken: process.env.PRINT_RELAY_TOKEN,
};
