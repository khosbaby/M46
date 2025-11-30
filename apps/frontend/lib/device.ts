'use client';

export function detectDeviceLabel() {
  if (typeof navigator === 'undefined') {
    return 'WebAuthn device';
  }
  const nav: Navigator & { userAgentData?: { platform?: string; brands?: { brand: string }[] } } = navigator as any;
  const uaData = nav.userAgentData;
  const platform = uaData?.platform ?? nav.platform ?? '';
  const brands = uaData?.brands?.map(entry => entry.brand).filter(Boolean) ?? [];
  const brandLabel = brands.length ? brands.join(', ') : '';
  const fallbacks = [platform, brandLabel || nav.userAgent];
  const label = fallbacks.filter(Boolean).join(' · ');
  return label || 'WebAuthn device';
}
