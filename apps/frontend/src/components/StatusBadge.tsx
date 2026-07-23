import clsx from "clsx";
import { ORDER_STATUS_COLORS } from "../lib/format";

export default function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={clsx(
        "rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap",
        ORDER_STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {label}
    </span>
  );
}
