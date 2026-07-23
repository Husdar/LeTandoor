import type { SVGProps } from "react";

/**
 * Set d'icônes ligne, cohérent (trait 1.75, coins arrondis), utilisé partout dans l'app à la
 * place des emoji pour un rendu plus professionnel et identique sur toutes les plateformes.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconOrders(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 3h8a1 1 0 0 1 1 1v16l-2.5-1.5L12 20l-2.5-1.5L7 20V4a1 1 0 0 1 1-1Z" />
      <path d="M9.5 8h5M9.5 11.5h5" />
    </Icon>
  );
}

export function IconKitchen(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 21h12" />
      <path d="M7 21V10a5 5 0 0 1 10 0v11" />
      <path d="M7 10h10" />
    </Icon>
  );
}

export function IconCashier(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="12" cy="14.5" r="2" />
      <path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V6" />
    </Icon>
  );
}

export function IconFloorPlan(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </Icon>
  );
}

export function IconReservations(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17h2M14 17h2" />
    </Icon>
  );
}

export function IconPerformance(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 19V5M4 19h16" />
      <path d="M7 15l3.5-4 3 2.5L18 8" />
    </Icon>
  );
}

export function IconAdvice(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.7v.5h5.6v-.5c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3Z" />
    </Icon>
  );
}

export function IconAdmin(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V20a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 18.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.63 7.66a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.5.5 1.22.66 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V2a2 2 0 1 1 4 0v.09c0 .69.4 1.32 1.04 1.56.65.32 1.37.16 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V8c.24.64.87 1.04 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.46Z" />
    </Icon>
  );
}

export function IconMarketing(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l1 5h2l-1-5h2l8 4V7l-8 4H6a2 2 0 0 0-2 2Z" />
      <path d="M17 9v6" />
    </Icon>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function IconChat(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </Icon>
  );
}

export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Icon>
  );
}

/** Emblème du restaurant : flamme stylisée évoquant le four tandoor, dans un médaillon doré. */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" {...props}>
      <circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <path
        d="M20 9c-1 3-4.5 5.4-4.5 9.6a4.5 4.5 0 0 0 9 0c0-1.6-.8-2.7-1.5-3.7.3 2-.6 2.9-1.2 3.4-.2-1.7-.9-2.6-1.8-3.6.4 1.7-.3 2.4-.9 3-.1-3.5-1.6-6-3.1-8.4Z"
        fill="currentColor"
      />
      <path d="M13 29c1.8-2.2 4-3.4 7-3.4s5.2 1.2 7 3.4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
