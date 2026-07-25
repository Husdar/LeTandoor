import { OrderItemStatus, OrderType } from "@le-tandoor/shared";
import { displayOrderRef, ORDER_TYPE_LABELS, shortenItemName } from "../../lib/format";
import type { Order } from "../../types";

/** Aperçu du ticket cuisine tel qu'il s'imprime réellement : minimal, sans branding ni
 * coordonnées client — juste le numéro, le contexte (type/table/horaire) et les plats. */
export default function TicketPreview({ order }: { order: Order }) {
  const tableLabel = order.orderTables[0]?.table?.name;
  const activeItems = order.items.filter((i) => i.status !== OrderItemStatus.ANNULE);

  return (
    <div className="mx-auto w-full max-w-[300px] rounded-lg border border-dashed border-burgundy/30 bg-[#fdfaf3] p-4 font-mono text-[11px] leading-tight text-burgundy shadow-inner">
      <p className="text-center text-sm font-bold">Commande #{displayOrderRef(order)}</p>
      <p className="text-center font-bold">
        {ORDER_TYPE_LABELS[order.type]}
        {tableLabel ? ` - ${tableLabel}` : ""}
      </p>
      <p className="text-center text-sm font-bold">
        {order.requestedFor
          ? `${order.type === OrderType.LIVRAISON ? "Livraison" : "Retrait"}: ${new Date(order.requestedFor).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
          : new Date(order.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </p>

      <div className="my-2 border-t border-dashed border-burgundy/40" />

      {activeItems.map((item) => (
        <div key={item.id} className="mb-1.5">
          <p className="font-bold">
            {item.quantity}x {shortenItemName(item.nameSnapshot)}
          </p>
          {item.options.map((o) => (
            <p key={o.id} className="pl-2">
              + {o.name}
            </p>
          ))}
          {item.notes && <p className="pl-2 italic">Note: {item.notes}</p>}
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-burgundy/40" />
    </div>
  );
}
