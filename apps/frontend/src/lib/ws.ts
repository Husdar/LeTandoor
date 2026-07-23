import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WsEvent, OrderSource, type WsMessage } from "@le-tandoor/shared";
import { useAuthStore } from "../store/auth";
import { playNewOrderChime } from "./sound";
import type { Order } from "../types";

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
          case WsEvent.ORDER_CREATED:
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            if ((message.payload as Order | undefined)?.source === OrderSource.SITE_WEB) {
              playNewOrderChime();
            }
            break;
          case WsEvent.ORDER_UPDATED:
          case WsEvent.ORDER_CLOSED:
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            break;
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
