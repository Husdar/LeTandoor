import { OrderItemStatus, OrderSource, OrderType } from "@le-tandoor/shared";
import { ORDER_TYPE_LABELS } from "../../lib/format";
import type { Order } from "../../types";

export default function TicketPreview({ order }: { order: Order }) {
  const tableLabel = order.orderTables[0]?.table?.name;
  const activeItems = order.items.filter((i) => i.status !== OrderItemStatus.ANNULE);

  return (
    <div className="mx-auto w-full max-w-[300px] rounded-lg border border-dashed border-burgundy/30 bg-[#fdfaf3] p-4 font-mono text-[11px] leading-tight text-burgundy shadow-inner">
      <p className="text-center text-sm font-bold">LE TANDOOR</p>
      <p className="text-center">TICKET CUISINE</p>
      <div className="my-2 border-t border-dashed border-burgundy/40" />

      <p>Commande #{order.orderNumber}</p>
      <p>{new Date(order.createdAt).toLocaleString("fr-FR")}</p>
      <p className="mt-1 font-bold">
        {ORDER_TYPE_LABELS[order.type]}
        {tableLabel ? ` - ${tableLabel}` : ""}
      </p>
      {order.source === OrderSource.SITE_WEB && <p>(Commande site web)</p>}
      {order.type !== OrderType.SUR_PLACE && order.customerName && <p>Client: {order.customerName}</p>}
      {order.type !== OrderType.SUR_PLACE && order.customerPhone && <p>Tel: {order.customerPhone}</p>}
      {order.type === OrderType.LIVRAISON && order.deliveryAddress && (
        <p className="font-bold">Adresse: {order.deliveryAddress}</p>
      )}
      {order.requestedFor && (
        <p className="font-bold">
          {order.type === OrderType.LIVRAISON ? "Livraison souhaitée" : "Retrait souhaité"}:{" "}
          {new Date(order.requestedFor).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      <div className="my-2 border-t border-dashed border-burgundy/40" />

      {activeItems.map((item) => (
        <div key={item.id} className="mb-1.5">
          <p className="font-bold">
            {item.quantity}x {item.nameSnapshot}
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
