import { OrderItemStatus, OrderSource, OrderType } from "@le-tandoor/shared";
import { displayOrderRef, formatMoney, groupItemsByCategory, ORDER_TYPE_LABELS, PAYMENT_LABELS } from "../../lib/format";
import type { Order } from "../../types";

/** Aperçu du reçu caisse tel qu'il s'imprime réellement : logo en haut, barre inversée avec le
 * numéro de commande et le nom du client en très gros (style Uber Eats), puis le détail des
 * articles et les totaux — voir writeReceipt dans ticket-builder.ts côté backend. */
export default function ReceiptPreview({ order }: { order: Order }) {
  const tableLabel = order.orderTables[0]?.table?.name;
  const activeItems = order.items.filter((i) => i.status !== OrderItemStatus.ANNULE);
  const groups = groupItemsByCategory(activeItems);
  const lastPayment = order.payments[order.payments.length - 1];
  const deliveryFee = Number(order.deliveryFee);
  const discount = Number(order.discountAmount);

  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-lg border border-dashed border-burgundy/30 bg-[#fdfaf3] font-mono text-[11px] leading-tight text-burgundy shadow-inner">
      <div className="p-4 pb-0">
        <img src="/logo.png" alt="Le Tandoor" className="mx-auto h-10 w-auto object-contain" />
      </div>

      <div className="my-2 bg-black py-2 text-center text-cream">
        <p className="text-2xl font-extrabold tracking-wide">#{displayOrderRef(order)}</p>
        {order.customerName && <p className="text-base font-bold">{order.customerName}</p>}
      </div>

      <div className="px-4 pb-4">
        <p className="text-center">{new Date(order.createdAt).toLocaleString("fr-FR")}</p>
        {order.requestedFor && (
          <p className="text-center">
            {order.type === OrderType.LIVRAISON ? "Livraison prevue" : "A preparer pour"}:{" "}
            {new Date(order.requestedFor).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        <p className="mt-2 text-center text-sm font-bold">
          {ORDER_TYPE_LABELS[order.type].toUpperCase()}
          {tableLabel ? ` - ${tableLabel}` : ""}
        </p>
        {order.source === OrderSource.SITE_WEB && <p className="text-center">(Commande site web)</p>}
        {order.type !== OrderType.SUR_PLACE && order.customerPhone && (
          <p className="text-center">Tel: {order.customerPhone}</p>
        )}
        {order.type === OrderType.LIVRAISON && order.deliveryAddress && (
          <p className="text-center font-bold">Adresse: {order.deliveryAddress}</p>
        )}

        <div className="my-2 border-t border-dashed border-burgundy/40" />

        {groups.map((group) => (
          <div key={group.categoryName} className="mb-1.5">
            <p className="font-bold uppercase">- {group.categoryName} -</p>
            {group.items.map((item) => {
              const lineTotal = Number(item.unitPriceSnapshot) * item.quantity;
              return (
                <div key={item.id} className="mb-1">
                  <div className="flex justify-between gap-2 font-bold">
                    <span>
                      {item.quantity}x {item.nameSnapshot}
                    </span>
                    <span className="shrink-0">{formatMoney(lineTotal)}</span>
                  </div>
                  {item.options.map((o) => (
                    <div key={o.id} className="flex justify-between gap-2 pl-2">
                      <span>+ {o.name}</span>
                      {Number(o.priceDelta) !== 0 && <span className="shrink-0">{formatMoney(o.priceDelta)}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-burgundy/40" />

        <div className="flex justify-between">
          <span>Sous-total</span>
          <span>{formatMoney(order.subtotal)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between">
            <span>Livraison</span>
            <span>{formatMoney(deliveryFee)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Remise</span>
            <span>-{formatMoney(discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span>{formatMoney(order.total)}</span>
        </div>

        {lastPayment && <p className="mt-1">Paiement: {PAYMENT_LABELS[lastPayment.method] ?? lastPayment.method}</p>}

        <div className="my-2 border-t border-dashed border-burgundy/40" />
        <p className="text-center">Merci de votre visite !</p>
      </div>
    </div>
  );
}
