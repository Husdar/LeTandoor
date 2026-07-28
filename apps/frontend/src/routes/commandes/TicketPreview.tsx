import { OrderItemStatus, OrderType } from "@le-tandoor/shared";
import { displayOrderRef, groupItemsByCategory, ORDER_TYPE_LABELS, shortenItemName } from "../../lib/format";
import type { Order } from "../../types";

/** Aperçu du ticket cuisine tel qu'il s'imprime réellement : minimal, sans branding ni
 * coordonnées client — juste le numéro, le contexte (type/table/horaire) et les plats. */
export default function TicketPreview({ order }: { order: Order }) {
  const tableLabel = order.orderTables[0]?.table?.name;
  const activeItems = order.items.filter((i) => i.status !== OrderItemStatus.ANNULE);
  const groups = groupItemsByCategory(activeItems);

  return (
    <div className="mx-auto w-full max-w-[300px] rounded-lg border border-dashed border-burgundy/30 bg-[#fdfaf3] p-4 font-mono text-[11px] leading-tight text-burgundy shadow-inner">
      <img src="/logo.png" alt="Le Tandoor" className="mx-auto mb-2 h-10 w-auto object-contain" />
      <p className="text-center text-lg font-bold">#{displayOrderRef(order)}</p>
      <p className="text-center font-bold">
        {ORDER_TYPE_LABELS[order.type]}
        {tableLabel ? ` - ${tableLabel}` : ""}
      </p>
      <p className="text-center text-sm font-bold">
        {order.type === OrderType.LIVRAISON ? "Heure de livraison" : "Heure de retrait"}:
        <br />
        {order.requestedFor ? (
          <span className="text-lg">
            {new Date(order.requestedFor).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : (
          "Aucune donnée trouvée"
        )}
      </p>

      <div className="my-2 border-t border-dashed border-burgundy/40" />

      {groups.map((group) => (
        <div key={group.categoryName} className="mb-1.5">
          <p className="font-bold uppercase">- {group.categoryName} -</p>
          {group.items.map((item) => (
            <div key={item.id} className="mb-1">
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
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-burgundy/40" />
    </div>
  );
}
