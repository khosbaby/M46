import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from '../../codex/node_modules/dotenv/lib/main.js';
import { Client } from '../../codex/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../codex/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const codexDir = path.join(projectRoot, 'codex');
dotenv.config({ path: path.join(codexDir, '.env') });

const storageBaseUrl = process.env.SUPABASE_PUBLIC_STORAGE_BASE_URL;
if (!storageBaseUrl) {
  throw new Error('SUPABASE_PUBLIC_STORAGE_BASE_URL env is required to seed videos via MCP');
}
const normalizedStorageBase = storageBaseUrl.replace(/\/$/, '');
const buildStorageUrl = (filename = '') => `${normalizedStorageBase}/${filename.replace(/^\/+/, '')}`;

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  cwd: codexDir,
  env: process.env,
  stderr: 'pipe',
});

const stderrStream = transport.stderr;
if (stderrStream) {
  stderrStream.on('data', chunk => {
    process.stderr.write(chunk);
  });
}

transport.onclose = () => {
  console.error('[seed] MCP transport closed');
};

transport.onerror = error => {
  console.error('[seed] MCP transport error:', error);
};

const client = new Client({ name: 'm46-seed-script', version: '0.1.0' });

async function callTool(name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    const text = result.content?.map(item => (item.type === 'text' ? item.text : '')).join('\n');
    throw new Error(text || `Tool ${name} failed`);
  }
  return result.structuredContent ?? {};
}

async function select(table, filters) {
  return callTool('supabase_select', { table, filters });
}

async function insert(table, record) {
  const result = await callTool('supabase_insert', { table, record });
  return result.inserted ?? result;
}

async function update(table, filters, changes) {
  return callTool('supabase_update', { table, filters, changes });
}

async function remove(table, filters) {
  const cleaned = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  if (!Object.keys(cleaned).length) {
    throw new Error(`delete filters empty for ${table}`);
  }
  return callTool('supabase_delete', { table, filters: cleaned });
}

async function ensureAccount(handle, profile) {
  const cached = userCache.get(handle);
  if (cached) return cached;
  const existing = await select('app_users', { handle });
  let userId;
  if (existing.rowCount > 0) {
    userId = existing.rows[0].id;
  } else {
    const inserted = await insert('app_users', { handle });
    userId = inserted.id;
  }
  const account = await select('accounts', { user_id: userId });
  const accountUserId = account.rowCount > 0 ? account.rows[0].user_id : userId;
  if (!accountUserId) {
    throw new Error(`userId missing for account ${handle}`);
  }
  const accountPayload = {
    user_id: accountUserId,
    email: profile.email,
    display_name: profile.displayName,
    did: profile.did ?? `did:${handle}`,
    wallet_address: profile.walletAddress ?? `wallet_${handle}`,
    recovery_hint: profile.recoveryHint ?? `${handle}.org`,
  };
  if (account.rowCount === 0) {
    await insert('accounts', accountPayload);
  } else {
    await remove('accounts', { user_id: String(accountUserId) });
    await insert('accounts', accountPayload);
  }
  const profileRow = await select('creator_profiles', { user_id: userId });
  const payload = {
    user_id: userId,
    display_name: profile.displayName,
    avatar: profile.avatar ?? null,
    tagline: profile.tagline ?? null,
    bio: profile.bio ?? null,
  };
  if (profileRow.rowCount > 0) {
    await remove('creator_profiles', { user_id: userId });
  }
  await insert('creator_profiles', payload);
  const info = { id: userId, handle, ...profile };
  userCache.set(handle, info);
  return info;
}

async function ensureComments(postId, comments) {
  if (!comments?.length) {
    await remove('comments', { post_id: postId });
    return;
  }
  await remove('comments', { post_id: postId });
  for (const comment of comments) {
    const author = await ensureAccount(comment.handle, comment.profile);
    await insert('comments', {
      post_id: postId,
      author_id: author.id,
      body: comment.body,
      created_at: comment.createdAt,
    });
  }
}

async function ensureTags(postId, tags) {
  await remove('ai_tags', { post_id: postId });
  for (const tag of tags) {
    await insert('ai_tags', { post_id: postId, tag, trust: 0.8 });
  }
}

async function ensureStats(postId, stats) {
  if (!stats) return;
  const existing = await select('post_stats', { post_id: postId });
  const payload = {
    post_id: postId,
    views: stats.views,
    watch_seconds: stats.watchSeconds,
    bookmarks: 0,
    follows: stats.follows ?? 0,
    popularity: stats.popularity ?? 0,
  };
  if (existing.rowCount > 0) {
    await remove('post_stats', { post_id: postId });
  }
  await insert('post_stats', payload);
}

const userCache = new Map();

const creators = [
  {
    handle: 'phase3_neon',
    profile: {
      email: 'neon@m46.org',
      displayName: 'Neon Runner',
      tagline: '都市AIストリーマー',
      avatar: 'https://dummyimage.com/128x128/0f172a/94a3b8&text=NR',
    },
  },
  {
    handle: 'aerial_loop',
    profile: {
      email: 'aerial@m46.org',
      displayName: 'Aerial Loop',
      tagline: '夜景ドローン作家',
      avatar: 'https://dummyimage.com/128x128/111827/bae6fd&text=AL',
    },
  },
  {
    handle: 'kanae_stream',
    profile: {
      email: 'kanae@m46.org',
      displayName: 'Kanae Stream',
      tagline: '旅とシネマティック',
      avatar: null,
    },
  },
  {
    handle: 'viz_dev',
    profile: {
      email: 'viz@m46.org',
      displayName: 'Viz Dev',
      tagline: 'AI VJ Collective',
      avatar: null,
    },
  },
  {
    handle: 'kinetic_wave',
    profile: {
      email: 'kinetic@m46.org',
      displayName: 'Kinetic Wave',
      tagline: '動的生成造形チーム',
      avatar: 'https://dummyimage.com/128x128/1d1b42/f0abfc&text=KW',
    },
  },
  {
    handle: 'midori_arc',
    profile: {
      email: 'midori.arc@m46.org',
      displayName: 'Midori Arc',
      tagline: '自然音とAI視覚表現',
      avatar: 'https://dummyimage.com/128x128/042f2e/a7f3d0&text=MA',
    },
  },
  {
    handle: 'echo_form',
    profile: {
      email: 'echo.form@m46.org',
      displayName: 'Echo Form',
      tagline: '構造物と共鳴する光',
      avatar: 'https://dummyimage.com/128x128/31191f/fbcfe8&text=EF',
    },
  },
];

const commenters = [
  {
    handle: 'tokyo_runner',
    profile: { email: 'tokyo@m46.org', displayName: 'Tokyo Runner', tagline: '都心散歩ログ', avatar: null },
  },
  {
    handle: 'midori_light',
    profile: { email: 'midori@m46.org', displayName: 'Midori Light', tagline: '植物とAI音響', avatar: null },
  },
  {
    handle: 'retro_wave',
    profile: { email: 'retro@m46.org', displayName: 'Retro Wave', tagline: '80s generative', avatar: null },
  },
];

const videoSamples = [
  {
    owner: 'phase3_neon',
    title: 'Neon Alley Pulse',
    description: '雨上がりの路地で AI サウンドに合わせて光が揺れるショット。',
    storageKey: buildStorageUrl('neon_alley_pulse.mp4'),
    durationSeconds: 24,
    resolution: '1080x1920',
    tags: ['neon', 'city', 'night'],
    stats: { views: 18200, watchSeconds: 26800, follows: 420, popularity: 0.92 },
    comments: [
      {
        handle: 'kanae_stream',
        profile: creators.find(c => c.handle === 'kanae_stream').profile,
        body: 'ガラスの床に映るネオンが綺麗…！',
        createdAt: new Date().toISOString(),
      },
      {
        handle: 'tokyo_runner',
        profile: commenters.find(c => c.handle === 'tokyo_runner').profile,
        body: '#neon タグフォローしました。',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'aerial_loop',
    title: 'Skyline Drift',
    description: 'ドローンが東京湾を滑るように移動し、AI Fog が流れ込む朝焼け。',
    storageKey: buildStorageUrl('skyline_drift.mp4'),
    durationSeconds: 26,
    resolution: '1296x2304',
    tags: ['drone', 'sunrise', 'fog'],
    stats: { views: 14200, watchSeconds: 19800, follows: 310, popularity: 0.88 },
    comments: [
      {
        handle: 'midori_light',
        profile: commenters.find(c => c.handle === 'midori_light').profile,
        body: '空気感のグラデいいですね。',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'phase3_neon',
    title: 'City Rail Sync',
    description: '地下鉄トンネルを流れる AI 光のラインを 12fps で記録。',
    storageKey: buildStorageUrl('city_rail_sync.mp4'),
    durationSeconds: 18,
    resolution: '1080x1920',
    tags: ['rail', 'sync', 'night'],
    stats: { views: 9800, watchSeconds: 13200, follows: 150, popularity: 0.73 },
    comments: [],
  },
  {
    owner: 'kanae_stream',
    title: 'Retro Bloom Walk',
    description: '古い商店街を AI Bloom 表現で再構築した散歩ショット。',
    storageKey: buildStorageUrl('retro_bloom_walk.mp4'),
    durationSeconds: 22,
    resolution: '720x1280',
    tags: ['retro', 'bloom', 'walk'],
    stats: { views: 7600, watchSeconds: 11000, follows: 120, popularity: 0.68 },
    comments: [
      {
        handle: 'retro_wave',
        profile: commenters.find(c => c.handle === 'retro_wave').profile,
        body: '色収差の入り方が最高です。',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'viz_dev',
    title: 'Aurora Stack',
    description: '北欧データセットを使った 3D スタック演出。',
    storageKey: buildStorageUrl('aurora_stack.mp4'),
    durationSeconds: 20,
    resolution: '1080x1920',
    tags: ['aurora', 'stack', '3d'],
    stats: { views: 8900, watchSeconds: 12500, follows: 140, popularity: 0.71 },
    comments: [],
  },
  {
    owner: 'aerial_loop',
    title: 'Harbor Gradient Rush',
    description: '港エリアを 60m 上空からシネカラーパレットに差し替え。',
    storageKey: buildStorageUrl('harbor_gradient_rush.mp4'),
    durationSeconds: 25,
    resolution: '1296x2304',
    tags: ['harbor', 'gradient', 'rush'],
    stats: { views: 13200, watchSeconds: 21000, follows: 260, popularity: 0.84 },
    comments: [
      {
        handle: 'midori_light',
        profile: commenters.find(c => c.handle === 'midori_light').profile,
        body: 'ミニマルな音も相性良さそう。',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'phase3_neon',
    title: 'Rain Tunnel Echo',
    description: 'トンネルに雨を流し込み、echo Reverb を同期。',
    storageKey: buildStorageUrl('rain_tunnel_echo.mp4'),
    durationSeconds: 19,
    resolution: '1080x1920',
    tags: ['rain', 'tunnel', 'echo'],
    stats: { views: 10100, watchSeconds: 15000, follows: 180, popularity: 0.77 },
    comments: [
      {
        handle: 'tokyo_runner',
        profile: commenters.find(c => c.handle === 'tokyo_runner').profile,
        body: 'この質感、現地で見たい…',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'kinetic_wave',
    title: 'Mist Bloom Canyon',
    description: '火山渓谷を霧粒シェーダーで走査しつつ、AI Bloom を重ねた立体ショット。',
    storageKey: buildStorageUrl('214669_tiny.mp4'),
    durationSeconds: 23,
    resolution: '1080x1920',
    tags: ['mist', 'canyon', 'bloom'],
    stats: { views: 16540, watchSeconds: 24560, follows: 230, popularity: 0.83 },
    comments: [
      {
        handle: 'tokyo_runner',
        profile: commenters.find(c => c.handle === 'tokyo_runner').profile,
        body: '霧の粒感がヘッドホンで刺さる…！',
        createdAt: new Date().toISOString(),
      },
      {
        handle: 'midori_light',
        profile: commenters.find(c => c.handle === 'midori_light').profile,
        body: '低周波の鳴り方が最高です。',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'midori_arc',
    title: 'Chromatic Delta Arp',
    description: 'デルタ地帯の水路をクロマチックグリッチで再構成し、ハープのような動きで繋いだ作品。',
    storageKey: buildStorageUrl('236256_tiny.mp4'),
    durationSeconds: 27,
    resolution: '1296x2304',
    tags: ['delta', 'chromatic', 'river'],
    stats: { views: 14900, watchSeconds: 21280, follows: 196, popularity: 0.8 },
    comments: [
      {
        handle: 'retro_wave',
        profile: commenters.find(c => c.handle === 'retro_wave').profile,
        body: '水面の揺らぎにARPが絡むの気持ちいい。',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'phase3_neon',
    title: 'Metro Pulse Loop',
    description: '夜の地下駅を 32step ループでスキャンし、列車の影をパルスとして記録。',
    storageKey: buildStorageUrl('258799_tiny.mp4'),
    durationSeconds: 19,
    resolution: '1080x1920',
    tags: ['metro', 'pulse', 'loop'],
    stats: { views: 17380, watchSeconds: 23100, follows: 260, popularity: 0.9 },
    comments: [
      {
        handle: 'kanae_stream',
        profile: creators.find(c => c.handle === 'kanae_stream').profile,
        body: '車両の残像が光譜になってる…！',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'aerial_loop',
    title: 'Garden Nocturne Drift',
    description: '夜の植物園を真上から追いかけ、熱源をパステルで包んだドリフトショット。',
    storageKey: buildStorageUrl('296958_tiny.mp4'),
    durationSeconds: 24,
    resolution: '1080x1920',
    tags: ['garden', 'nocturne', 'drift'],
    stats: { views: 13880, watchSeconds: 18840, follows: 188, popularity: 0.78 },
    comments: [
      {
        handle: 'midori_light',
        profile: commenters.find(c => c.handle === 'midori_light').profile,
        body: '色温度の揺れが気持ち良い…',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'echo_form',
    title: 'Solar Fragment Bloom',
    description: '廃ビルに差し込む太陽を分光し、粒状のフラグメントとして再配置したテイク。',
    storageKey: buildStorageUrl('298103_tiny.mp4'),
    durationSeconds: 20,
    resolution: '1080x1920',
    tags: ['solar', 'fragment', 'glitch'],
    stats: { views: 12040, watchSeconds: 17020, follows: 150, popularity: 0.74 },
    comments: [
      {
        handle: 'retro_wave',
        profile: commenters.find(c => c.handle === 'retro_wave').profile,
        body: '粒の追従でキックが聴こえてくるみたい。',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    owner: 'kinetic_wave',
    title: 'Alley Frequency Sweep',
    description: '旧市街の路地を 3 本のレーザーで掃引し、音圧に同期させた実験ムービー。',
    storageKey: buildStorageUrl('307864_tiny.mp4'),
    durationSeconds: 21,
    resolution: '1080x1920',
    tags: ['alley', 'frequency', 'laser'],
    stats: { views: 15810, watchSeconds: 20990, follows: 201, popularity: 0.82 },
    comments: [
      {
        handle: 'tokyo_runner',
        profile: commenters.find(c => c.handle === 'tokyo_runner').profile,
        body: '路地に映る線がクラブの床みたい。',
        createdAt: new Date().toISOString(),
      },
    ],
  },
];

async function main() {
  console.log('[seed] connecting to Supabase MCP...');
  await client.connect(transport);
  console.log('[seed] connected');
  console.log('[seed] listing tools...');
  const tools = await client.listTools({});
  console.log('[seed] tools available:', tools.tools.map(tool => tool.name).join(', '));
  for (const creator of creators.concat(commenters)) {
    await ensureAccount(creator.handle, creator.profile);
  }
  for (const sample of videoSamples) {
    const owner = await ensureAccount(sample.owner, creators.find(c => c.handle === sample.owner)?.profile ?? { email: `${sample.owner}@m46.org`, displayName: sample.owner });
    const existing = await select('posts', { storage_key: sample.storageKey });
    console.log('[seed] syncing', sample.title, 'existing rows:', existing.rowCount);
    let postId;
    if (existing.rowCount > 0) {
      postId = existing.rows[0].id;
      await update('posts', { id: postId }, {
        owner_id: owner.id,
        title: sample.title,
        description: sample.description,
        storage_key: sample.storageKey,
        duration_seconds: sample.durationSeconds,
        resolution: sample.resolution,
        sensitive: false,
      });
    } else {
      const inserted = await insert('posts', {
        owner_id: owner.id,
        title: sample.title,
        description: sample.description,
        storage_key: sample.storageKey,
        duration_seconds: sample.durationSeconds,
        resolution: sample.resolution,
        sensitive: false,
      });
      console.log('[seed] inserted post row for', sample.title, inserted);
      postId = inserted.id;
    }
    if (!postId) {
      console.error('insert post payload missing id', sample.title, existing, owner);
      throw new Error(`postId missing for ${sample.title}`);
    }
    await ensureStats(postId, sample.stats);
    await ensureTags(postId, sample.tags);
    await ensureComments(postId, sample.comments);
    console.log(`Synced post "${sample.title}" (${postId})`);
  }
  await client.close();
  await transport.close();
}

main().catch(error => {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
