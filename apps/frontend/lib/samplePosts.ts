import { ApiPost } from './types';

const now = new Date();

const addDays = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

export const SAMPLE_POSTS: ApiPost[] = [
  {
    id: 'sample-neon-city',
    title: 'ネオンストリートの夜景',
    description: '雨上がりの渋谷をAIが再構成。サイバーな光の滲みを重ね、ビートに合わせて輝度が変化します。',
    durationSeconds: 18,
    resolution: '1080x1920',
    storageKey: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    createdAt: addDays(1),
    sensitive: false,
    aiScore: 0.92,
    aiTags: [
      { tag: 'cyber', trust: 0.94 },
      { tag: 'night', trust: 0.9 },
      { tag: 'tokyo', trust: 0.82 },
      { tag: 'rain', trust: 0.76 },
    ],
    tags: ['cyber', 'night', 'tokyo', 'rain'],
    popularity: 0.86,
    postStats: {
      views: 12840,
      watchSeconds: 86432,
      bookmarks: 742,
      follows: 311,
      popularity: 94,
    },
    author: {
      handle: '@cityglow',
      displayName: 'City Glow',
      avatar: null,
      bio: '都市生成AIアーティスト',
      tagline: 'Neon storyteller',
    },
    authorHandle: '@cityglow',
    authorDisplay: 'City Glow',
    authorAvatar: null,
  },
  {
    id: 'sample-retro-wave',
    title: 'Retro Wave Drive',
    description: '生成BGMに合わせたリズミカルな車窓。90年代VHSを再現しつつ、AIタグに基づきハイライトを挿入。',
    durationSeconds: 24,
    resolution: '720x1280',
    storageKey: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    createdAt: addDays(2),
    sensitive: false,
    aiScore: 0.88,
    aiTags: [
      { tag: 'synthwave', trust: 0.93 },
      { tag: 'drive', trust: 0.87 },
      { tag: 'retro', trust: 0.81 },
      { tag: 'roadtrip', trust: 0.74 },
    ],
    tags: ['synthwave', 'drive', 'retro', 'roadtrip'],
    popularity: 0.8,
    postStats: {
      views: 8640,
      watchSeconds: 60112,
      bookmarks: 421,
      follows: 215,
      popularity: 86,
    },
    author: {
      handle: '@spectrum',
      displayName: 'Spectrum',
      avatar: null,
      bio: 'Audio-reactive 映像づくり',
      tagline: 'Pulse driven visuals',
    },
    authorHandle: '@spectrum',
    authorDisplay: 'Spectrum',
    authorAvatar: null,
  },
  {
    id: 'sample-skyline-drift',
    title: 'Skyline Drift',
    description: '雲海を超えるドローンショット。生成タグで「calm」「drift」を付与し、Saveモード対応のメローな映像に。',
    durationSeconds: 16,
    resolution: '1296x2304',
    storageKey: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    createdAt: addDays(4),
    sensitive: false,
    aiScore: 0.8,
    aiTags: [
      { tag: 'nature', trust: 0.88 },
      { tag: 'calm', trust: 0.9 },
      { tag: 'drift', trust: 0.73 },
    ],
    tags: ['nature', 'calm', 'drift'],
    popularity: 0.75,
    postStats: {
      views: 4420,
      watchSeconds: 22971,
      bookmarks: 212,
      follows: 110,
      popularity: 72,
    },
    author: {
      handle: '@altitudelab',
      displayName: 'Altitude Lab',
      avatar: null,
      bio: '空撮xAIラボ',
      tagline: 'Slow future footage',
    },
    authorHandle: '@altitudelab',
    authorDisplay: 'Altitude Lab',
    authorAvatar: null,
  },
];
