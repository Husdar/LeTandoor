import clsx from "clsx";
import type { CSSProperties } from "react";
import type { RestaurantTable } from "../../types";

type ChairSpec = { side: "top" | "bottom" | "left" | "right"; pos?: number };

const CHAIR_LAYOUTS: Record<number, ChairSpec[]> = {
  2: [{ side: "left" }, { side: "right" }],
  4: [
    { side: "top", pos: 32 },
    { side: "top", pos: 68 },
    { side: "bottom", pos: 32 },
    { side: "bottom", pos: 68 },
  ],
  6: [
    { side: "top", pos: 28 },
    { side: "top", pos: 72 },
    { side: "bottom", pos: 28 },
    { side: "bottom", pos: 72 },
    { side: "left" },
    { side: "right" },
  ],
};

function chairStyle(spec: ChairSpec): CSSProperties {
  const base: CSSProperties = { position: "absolute" };
  if (spec.side === "top") return { ...base, top: -9, left: `${spec.pos}%`, transform: "translateX(-50%)" };
  if (spec.side === "bottom") return { ...base, bottom: -9, left: `${spec.pos}%`, transform: "translateX(-50%)" };
  if (spec.side === "left") return { ...base, left: -9, top: "50%", transform: "translateY(-50%)" };
  return { ...base, right: -9, top: "50%", transform: "translateY(-50%)" };
}

const SHAPE_CLASS: Record<string, string> = {
  RONDE: "rounded-full",
  CARREE: "rounded-md",
  RECTANGLE: "rounded-md",
};

export default function TableMarker({
  table,
  colorClass,
  size,
  onClick,
}: {
  table: RestaurantTable;
  colorClass: string;
  size: { width: string; height: string };
  onClick: () => void;
}) {
  const chairs = CHAIR_LAYOUTS[table.seats] ?? CHAIR_LAYOUTS[2];

  return (
    <button
      onClick={onClick}
      style={{
        left: `${table.posX}%`,
        top: `${table.posY}%`,
        width: size.width,
        height: size.height,
        transform: "translate(-50%, -50%)",
      }}
      className="group absolute flex items-center justify-center"
    >
      {chairs.map((spec, i) => (
        <span
          key={i}
          style={chairStyle(spec)}
          className="h-2.5 w-2.5 rounded-full border border-[#8b6a4f]/50 bg-[#c9a877] shadow-sm"
        />
      ))}
      <span
        className={clsx(
          "flex h-full w-full flex-col items-center justify-center border-2 text-center shadow-sm transition group-active:scale-95",
          SHAPE_CLASS[table.shape] ?? "rounded-md",
          colorClass
        )}
      >
        <span className="text-sm font-bold leading-tight">{table.name}</span>
        <span className="text-[10px] leading-tight opacity-70">{table.seats} pl.</span>
      </span>
    </button>
  );
}
