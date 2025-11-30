import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from '../../codex/node_modules/dotenv/lib/main.js';
import { Client } from '../../codex/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../codex/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const codexDir = path.join(projectRoot, 'codex');
dotenv.config({ path: path.join(codexDir, '.env') });

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  cwd: codexDir,
  env: process.env,
  stderr: 'pipe',
});

const stderrStream = transport.stderr;
if (stderrStream) {
  stderrStream.on('data', chunk => process.stderr.write(chunk));
}

transport.onclose = () => {
  console.error('[feed_mcp] transport closed');
};

transport.onerror = error => {
  console.error('[feed_mcp] transport error:', error);
};

const client = new Client({ name: 'm46-feed-fetch', version: '0.1.0' });
const SINGLE_SELECT_LIMIT = Number(process.env.MCP_SINGLE_SELECT_LIMIT ?? '50');
const SELECT_BATCH_SIZE = Number(process.env.MCP_SELECT_BATCH_SIZE ?? '5');
const POST_COLUMNS = ['id', 'owner_id', 'title', 'description', 'duration_seconds', 'resolution', 'storage_key', 'created_at', 'sensitive', 'ai_score'];

async function callTool(name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    const text = result.content?.map(item => (item.type === 'text' ? item.text : '')).join('\n');
    throw new Error(text || `Tool ${name} failed`);
  }
  return result.structuredContent ?? {};
}

async function select(table, options = {}) {
  return callTool('supabase_select', { table, ...options });
}

function groupBy(rows, key) {
  return rows.reduce((map, row) => {
    const groupKey = row[key];
    if (!groupKey) return map;
    if (!map.has(groupKey)) {
      map.set(groupKey, []);
    }
    map.get(groupKey).push(row);
    return map;
  }, new Map());
}

function chunk(values, size) {
  const list = [];
  for (let i = 0; i < values.length; i += size) {
    list.push(values.slice(i, i + size));
  }
  return list;
}

function coerceNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function sanitizeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeNullableString(value) {
  return typeof value === 'string' ? value : null;
}

async function selectByValues(table, column, values, columns) {
  if (!values.length) return [];
  const collected = [];
  const batches = chunk(values, SELECT_BATCH_SIZE);
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(value =>
        select(table, {
          columns,
          filters: { [column]: value },
          limit: SINGLE_SELECT_LIMIT,
        })
      )
    );
    for (const result of results) {
      collected.push(...(result.rows ?? []));
    }
  }
  return collected;
}

async function enrichPosts(postRows) {
  if (!postRows.length) return [];
  const postIds = postRows.map(row => row.id).filter(Boolean);
  if (!postIds.length) return [];
  const ownerIds = Array.from(new Set(postRows.map(row => row.owner_id).filter(Boolean)));
  const [tagsRows, statsRows, userRows, profileRows] = await Promise.all([
    selectByValues('ai_tags', 'post_id', postIds, ['post_id', 'tag', 'trust']),
    selectByValues('post_stats', 'post_id', postIds, ['post_id', 'views', 'watch_seconds', 'bookmarks', 'follows', 'popularity']),
    selectByValues('app_users', 'id', ownerIds, ['id', 'handle']),
    selectByValues('creator_profiles', 'user_id', ownerIds, ['user_id', 'display_name', 'avatar', 'bio', 'tagline']),
  ]);

  const tagsByPost = groupBy(tagsRows, 'post_id');
  const statsByPost = new Map(statsRows.map(row => [row.post_id, row]));
  const usersById = new Map(userRows.map(row => [row.id, row]));
  const profilesByUser = new Map(profileRows.map(row => [row.user_id, row]));

  return postRows.map(row => {
    const tags = tagsByPost.get(row.id) ?? [];
    const stats = statsByPost.get(row.id);
    const owner = usersById.get(row.owner_id);
    const profile = profilesByUser.get(row.owner_id);
    const aiTags = tags
      .map(tag => {
        const value = sanitizeString(tag.tag);
        if (!value) return null;
        return {
          tag: value,
          trust: typeof tag.trust === 'number' ? tag.trust : undefined,
        };
      })
      .filter(Boolean);
    const authorHandle = owner?.handle ?? null;
    const authorDisplay = sanitizeNullableString(profile?.display_name) ?? authorHandle ?? null;
    const authorAvatar = sanitizeNullableString(profile?.avatar);
    const postStats = stats
      ? {
          views: coerceNumber(stats.views),
          watchSeconds: coerceNumber(stats.watch_seconds),
          bookmarks: coerceNumber(stats.bookmarks),
          follows: coerceNumber(stats.follows),
          popularity: coerceNumber(stats.popularity),
        }
      : undefined;
    return {
      id: sanitizeString(row.id),
      title: sanitizeString(row.title, 'Untitled'),
      description: sanitizeString(row.description),
      durationSeconds: coerceNumber(row.duration_seconds),
      resolution: sanitizeString(row.resolution, '1080x1920'),
      storageKey: sanitizeString(row.storage_key),
      createdAt: sanitizeString(row.created_at, new Date().toISOString()),
      sensitive: Boolean(row.sensitive),
      aiScore: typeof row.ai_score === 'number' ? row.ai_score : null,
      aiTags,
      tags: aiTags.map(tag => tag.tag),
      postStats,
      popularity: postStats?.popularity ?? (typeof row.ai_score === 'number' ? row.ai_score : 0),
      author: authorHandle
        ? {
            handle: authorHandle,
            displayName: authorDisplay ?? authorHandle,
            avatar: authorAvatar,
            bio: sanitizeNullableString(profile?.bio),
            tagline: sanitizeNullableString(profile?.tagline),
          }
        : null,
      authorHandle,
      authorDisplay,
      authorAvatar,
    };
  });

}

async function fetchFeed(limit = Number(process.env.FEED_LIMIT ?? '40'), tagFilter = process.env.FEED_TAG) {
  const postsResult = await select('posts', {
    columns: POST_COLUMNS,
    orderBy: { column: 'created_at', ascending: false },
    limit,
  });
  const postRows = postsResult.rows ?? [];
  if (!postRows.length) {
    return [];
  }

  let posts = await enrichPosts(postRows);

  if (tagFilter) {
    const lowered = String(tagFilter).toLowerCase();
    posts = posts.filter(post => post.tags.some(tag => tag.toLowerCase() === lowered));
  }

  posts.sort((a, b) => {
    const viewsA = a.postStats?.views ?? 0;
    const viewsB = b.postStats?.views ?? 0;
    if (viewsB !== viewsA) return viewsB - viewsA;
    const popA = a.popularity ?? 0;
    const popB = b.popularity ?? 0;
    if (popB !== popA) return popB - popA;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return posts;
}

async function fetchPost(postId) {
  if (!postId) return null;
  const postsResult = await select('posts', {
    columns: POST_COLUMNS,
    filters: { id: postId },
    limit: 1,
  });
  const postRows = postsResult.rows ?? [];
  if (!postRows.length) {
    return null;
  }
  const posts = await enrichPosts(postRows);
  return posts[0] ?? null;
}

async function main() {
  try {
    await client.connect(transport);
    const postId = process.env.FEED_POST_ID?.trim();
    if (postId) {
      const post = await fetchPost(postId);
      console.log(JSON.stringify({ post }));
    } else {
      const posts = await fetchFeed(Number(process.env.FEED_LIMIT ?? '40'), process.env.FEED_TAG);
      console.log(JSON.stringify({ posts }));
    }
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}

main().catch(error => {
  console.error('[feed_mcp] failed:', error);
  process.exitCode = 1;
});
