import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WsEvent, OrderStatus, type WsMessage } from "@le-tandoor/shared";
import { useAuthStore } from "../store/auth";
import { usePendingWebOrders } from "../store/pendingWebOrders";
import { useActiveOrders } from "../hooks/queries";
import type { Order } from "../types";

/**
 * Filet de sécurité contre la sonnerie fantôme : si un événement ORDER_UPDATED/ORDER_CLOSED est
 * manqué (veille de l'ordinateur, coupure réseau au moment précis de la diffusion), la commande
 * reste marquée "en attente" indéfiniment côté client, sans qu'aucun futur message ne la corrige.
 * On revérifie donc périodiquement (via le polling déjà en place de useActiveOrders) que chaque
 * commande encore sonnante est réellement toujours au statut NOUVELLE.
 */
export function useRingReconciliation() {
  const { data: orders } = useActiveOrders();

  useEffect(() => {
    if (!orders) return;
    const pendingIds = usePendingWebOrders.getState().ids;
    if (pendingIds.size === 0) return;
    for (const id of pendingIds) {
      const order = orders.find((o) => o.id === id);
      if (!order || order.status !== OrderStatus.NOUVELLE) {
        usePendingWebOrders.getState().acknowledge(id);
      }
    }
  }, [orders]);
}

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const shouldReconnect = useRef(true);

  useEffect(() => {
    if (!accessToken) return;
    shouldReconnect.current = true;
    let socket: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const token = useAuthStore.getState().accessToken;
      // VITE_WS_URL permet de pointer vers un backend hébergé sur un autre domaine (voir api.ts).
      // Par défaut, on déduit l'URL du websocket du domaine courant (déploiement même origine).
      const wsBase =
        import.meta.env.VITE_WS_URL ??
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
      socket = new WebSocket(`${wsBase}?token=${encodeURIComponent(token ?? "")}`);

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as WsMessage;
        switch (message.event) {
          case WsEvent.ORDER_CREATED: {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            // Sonnerie + popup plein écran d'acceptation pour TOUTE nouvelle commande (pas
            // seulement site web) : peu importe qui/comment elle a été créée, elle doit être vue.
            const order = message.payload as Order | undefined;
            if (order) {
              usePendingWebOrders.getState().add(order.id);
            }
            break;
          }
          case WsEvent.ORDER_UPDATED:
          case WsEvent.ORDER_CLOSED: {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            // Une commande avancée/annulée/clôturée sur N'IMPORTE QUEL appareil doit couper la
            // sonnerie PARTOUT — sans ça, chaque appareil ne gérait que son propre état local et
            // continuait de sonner indéfiniment même après traitement de la commande ailleurs.
            const updatedOrder = message.payload as Order | undefined;
            if (updatedOrder && updatedOrder.status !== OrderStatus.NOUVELLE) {
              usePendingWebOrders.getState().acknowledge(updatedOrder.id);
            }
            break;
          }
          case WsEvent.TABLE_UPDATED:
            queryClient.invalidateQueries({ queryKey: ["tables"] });
            break;
          case WsEvent.RESERVATION_CREATED:
          case WsEvent.RESERVATION_UPDATED:
            queryClient.invalidateQueries({ queryKey: ["reservations"] });
            break;
          default:
            break;
        }
      };

      socket.onclose = () => {
        if (shouldReconnect.current) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      shouldReconnect.current = false;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [accessToken, queryClient]);
}
