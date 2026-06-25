/** Canonical introduction hub navigation — single source of truth for Trust Network cards. */

export const INTRODUCTIONS_ROUTES = {
  hub: "/introductions",
  listAnchor: "/introductions#introductions-list",
  sent: "/introductions/sent",
  mutual: "/introductions/mutual",
  connectionPaths: "/discoveries",
} as const;

export function introductionDetailHref(storyId: string): string {
  return `/introductions/${storyId}`;
}

export function introductionStoryViewerHref(storyId: string): string {
  return `/stories/view/${storyId}`;
}

export function introductionNetworkHref(userIds: string[]): string {
  return `/introductions/network?users=${userIds.join(",")}`;
}

export type TrustNetworkCardDef = {
  id: string;
  title: string;
  /** Resolved href for runtime navigation audit */
  resolveHref: (userId: string) => string;
  /** Expected Next.js page (path segment before # or ?) */
  targetPage: string;
  description: string;
};

export const TRUST_NETWORK_CARDS: TrustNetworkCardDef[] = [
  {
    id: "introduction-network",
    title: "Introduction Network",
    resolveHref: () => INTRODUCTIONS_ROUTES.listAnchor,
    targetPage: "/introductions",
    description: "Recent and past introductions in your trusted circle",
  },
  {
    id: "mutual-introductions",
    title: "Mutual Introductions",
    resolveHref: () => INTRODUCTIONS_ROUTES.mutual,
    targetPage: "/introductions/mutual",
    description: "See who connected you through trusted introductions",
  },
  {
    id: "connected-through-you",
    title: "People Connected Through You",
    resolveHref: () => INTRODUCTIONS_ROUTES.sent,
    targetPage: "/introductions/sent",
    description: "Introductions you made that expanded someone's network",
  },
  {
    id: "connected-to-you",
    title: "People Connected To You",
    resolveHref: () => INTRODUCTIONS_ROUTES.hub,
    targetPage: "/introductions",
    description: "Who introduced you and through whom you were discovered",
  },
  {
    id: "connection-paths",
    title: "Connection Paths",
    resolveHref: () => INTRODUCTIONS_ROUTES.connectionPaths,
    targetPage: "/discoveries",
    description: "Discover people through your introduction graph",
  },
];

/** Strip hash/query for page existence checks */
export function navigationPath(href: string): string {
  return href.split("#")[0].split("?")[0] || "/";
}
