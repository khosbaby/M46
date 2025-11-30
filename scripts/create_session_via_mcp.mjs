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

if (transport.stderr) {
  transport.stderr.on('data', chunk => {
    const text = chunk?.toString?.() ?? '';
    if (text.trim()) {
      console.error(text.trim());
    }
  });
}
transport.onclose = () => {
  console.error('[session-generator] MCP transport closed');
};
transport.onerror = error => {
  console.error('[session-generator] MCP transport error:', error);
};

const client = new Client({ name: 'session-generator', version: '0.1.0' });

async function callTool(name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    const text = result.content?.map(item => (item.type === 'text' ? item.text : '')).join('\n');
    throw new Error(text || `Tool ${name} failed`);
  }
  return result.structuredContent ?? {};
}

async function fetchUserByHandle(handle) {
  const { rows } = await callTool('supabase_select', {
    table: 'app_users',
    columns: ['id', 'handle'],
    filters: { handle },
    limit: 1,
  });
  return rows?.[0] ?? null;
}

async function main() {
  await client.connect(transport);
  await client.listTools({});
  const handle = process.argv[2] || 'phase3_neon';
  const user = await fetchUserByHandle(handle);
  if (!user?.id) {
    throw new Error(`User not found for handle ${handle}`);
  }
  const token = `test_${handle}_${Date.now()}`;
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await callTool('supabase_insert', {
    table: 'app_sessions',
    record: { token, user_id: user.id, expires_at: expires },
  });
  console.log(`Created session token for ${handle}: ${token}`);
  await client.close();
  await transport.close();
}

main().catch(error => {
  console.error('session generation failed:', error);
  process.exitCode = 1;
});
