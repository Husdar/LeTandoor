import { Fragment } from "react";

/** Rend le **gras**, les titres # / ## et les listes à puces "- " que produit l'IA — sans dépendance markdown complète. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function SimpleMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: { type: "heading" | "bullet" | "text" | "space"; content: string }[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      blocks.push({ type: "space", content: "" });
    } else if (/^#{1,3}\s+/.test(line)) {
      blocks.push({ type: "heading", content: line.replace(/^#{1,3}\s+/, "") });
    } else if (/^[-*]\s+/.test(line)) {
      blocks.push({ type: "bullet", content: line.replace(/^[-*]\s+/, "") });
    } else {
      blocks.push({ type: "text", content: line });
    }
  }

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.type === "space") return null;
        if (block.type === "heading") {
          return (
            <p key={i} className="mt-3 mb-1 font-display text-base font-semibold text-burgundy first:mt-0">
              {renderInline(block.content)}
            </p>
          );
        }
        if (block.type === "bullet") {
          return (
            <p key={i} className="mb-1 pl-4 relative before:absolute before:left-0 before:content-['•']">
              {renderInline(block.content)}
            </p>
          );
        }
        return (
          <p key={i} className="mb-1">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
}
