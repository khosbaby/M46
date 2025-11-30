const MEDIA_PLACEHOLDERS: Record<string, string> = {
  'demo-neon-skyline.mp4': 'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4',
  'demo-retro-wave.mp4': 'https://storage.googleapis.com/coverr-main/mp4/City_Traffic.mp4',
  'demo-skyline-drift.mp4': 'https://storage.googleapis.com/coverr-main/mp4/Clouds_Passing.mp4',
  '15283135-hd_1080_1920_30fps.mp4': 'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4',
  '15439741-hd_1080_1920_30fps.mp4': 'https://storage.googleapis.com/coverr-main/mp4/Footboys.mp4',
  '17169505-hd_1080_1920_30fps.mp4': 'https://storage.googleapis.com/coverr-main/mp4/City_Traffic.mp4',
  '15000517-uhd_1296_2304_30fps.mp4': 'https://storage.googleapis.com/coverr-main/mp4/Clouds_Passing.mp4',
};

const STORAGE_PRESET_BASE =
  (process.env.NEXT_PUBLIC_STORAGE_PRESET_BASE_URL ?? process.env.STORAGE_PRESET_BASE_URL)?.trim().replace(/\/$/, '') ?? '';

const SUPABASE_STORAGE_BASE = (() => {
  const override =
    (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BASE_URL ?? process.env.SUPABASE_PUBLIC_STORAGE_BASE_URL)?.trim().replace(/\/$/, '');
  if (override) return override;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim();
  if (!url) return '';
  return `${url.replace(/\/$/, '')}/storage/v1/object/public`;
})();

function resolveSupabaseStorageSource(storageKey: string) {
  if (!SUPABASE_STORAGE_BASE) return '';
  let normalizedKey = storageKey.trim();
  if (!normalizedKey) return '';
  if (normalizedKey.startsWith('supabase://')) {
    normalizedKey = normalizedKey.replace(/^supabase:\/\//, '');
  }
  normalizedKey = normalizedKey.replace(/^\/+/, '');
  if (!normalizedKey.includes('/')) {
    return '';
  }
  return `${SUPABASE_STORAGE_BASE}/${normalizedKey}`;
}

export function resolveMediaSource(storageKey?: string | null) {
  if (!storageKey) return '';
  if (storageKey.startsWith('http://') || storageKey.startsWith('https://')) {
    return storageKey;
  }

  const supabaseSource = resolveSupabaseStorageSource(storageKey);
  if (supabaseSource) {
    return supabaseSource;
  }

  if (storageKey.startsWith('/media/')) {
    const key = storageKey.replace(/^\/media\//, '');
    return MEDIA_PLACEHOLDERS[key] ?? '';
  }

  if (/^(demo|sample|test)/.test(storageKey)) {
    const key = storageKey.replace(/^demo-/i, 'demo-');
    return MEDIA_PLACEHOLDERS[key] ?? '';
  }

  if (STORAGE_PRESET_BASE) {
    const normalized = storageKey.replace(/^\/+/, '');
    if (normalized) {
      return `${STORAGE_PRESET_BASE}/${normalized}`;
    }
  }

  return '';
}
