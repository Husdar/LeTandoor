import net from "node:net";
import WebSocket from "ws";

const BACKEND_WS_URL = process.env.BACKEND_WS_URL;
const PRINT_RELAY_TOKEN = process.env.PRINT_RELAY_TOKEN;

if (!BACKEND_WS_URL || !PRINT_RELAY_TOKEN) {
  console.error("Erreur : BACKEND_WS_URL et PRINT_RELAY_TOKEN doivent être définis dans le fichier .env.");
  process.exit(1);
}

const RECONNECT_DELAY_MS = 5000;
const PRINT_TIMEOUT_MS = 8000;

/** Ouvre une connexion TCP vers l'imprimante et lui envoie le ticket ESC/POS déjà formaté. */
function sendToPrinter(ip, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" }));
    }, PRINT_TIMEOUT_MS);

    socket.connect(port, ip, () => {
      socket.write(buffer, (err) => {
        if (err) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          socket.destroy();
          reject(err);
          return;
        }
        socket.end();
      });
    });

    socket.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    });

    socket.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function connect() {
  const url = `${BACKEND_WS_URL}?relayToken=${encodeURIComponent(PRINT_RELAY_TOKEN)}`;
  console.log(`[relais] Connexion à ${BACKEND_WS_URL}...`);
  const ws = new WebSocket(url);

  ws.on("open", () => {
    console.log("[relais] Connecté au serveur. En attente des tickets à imprimer...");
  });

  ws.on("message", async (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (message.event !== "PRINT_JOB_REQUEST") return;

    const { jobId, ip, port, data } = message.payload;
    console.log(`[relais] Ticket reçu pour ${ip}:${port} (job ${jobId})`);

    try {
      const buffer = Buffer.from(data, "base64");
      await sendToPrinter(ip, port, buffer);
      console.log(`[relais] ✓ Ticket imprimé avec succès sur ${ip}:${port}`);
      ws.send(JSON.stringify({ event: "PRINT_JOB_RESULT", payload: { jobId, success: true } }));
    } catch (err) {
      console.error(`[relais] ✗ Échec d'impression sur ${ip}:${port} :`, err.message);
      ws.send(
        JSON.stringify({
          event: "PRINT_JOB_RESULT",
          payload: { jobId, success: false, error: err.code || err.message },
        })
      );
    }
  });

  ws.on("close", () => {
    console.warn(`[relais] Connexion perdue, nouvelle tentative dans ${RECONNECT_DELAY_MS / 1000}s...`);
    setTimeout(connect, RECONNECT_DELAY_MS);
  });

  ws.on("error", (err) => {
    console.error("[relais] Erreur de connexion :", err.message);
  });
}

connect();
