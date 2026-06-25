export type DiscoveriesUxSettings = {
  expiryHours: number;
  showHeroBanner: boolean;
  showExpiryIndicators: boolean;
  showTrustContext: boolean;
};

export const DEFAULT_DISCOVERIES_UX: DiscoveriesUxSettings = {
  expiryHours: 24,
  showHeroBanner: true,
  showExpiryIndicators: true,
  showTrustContext: true,
};

export function resolveDiscoveriesUx(settings: {
  discoveriesExpiryHours: number | null;
  enableDiscoveriesHeroBanner: boolean;
  enableDiscoveryExpiryIndicators: boolean;
  enableDiscoveryTrustContext: boolean;
}): DiscoveriesUxSettings {
  return {
    expiryHours:
      settings.discoveriesExpiryHours && settings.discoveriesExpiryHours > 0
        ? settings.discoveriesExpiryHours
        : 24,
    showHeroBanner: settings.enableDiscoveriesHeroBanner,
    showExpiryIndicators: settings.enableDiscoveryExpiryIndicators,
    showTrustContext: settings.enableDiscoveryTrustContext,
  };
}
