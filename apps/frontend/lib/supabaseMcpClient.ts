import 'server-only';

import path from 'path';

import dotenv from '../../../../codex/node_modules/dotenv/lib/main.js';
import { Client } from '../../../../codex/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../../codex/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

type Primitive = string | number | boolean | null;

export type SupabaseSelectOptions = {
  table: string;
  columns?: string[];
  filters?: Record<string, Primitive>;
  limit?: number;
  orderBy?: { column: string; ascending?: boolean };
};

export type SupabaseMutationOptions = {
  table: string;
  filters: Record<string, Primitive>;
};

export type SupabaseInsertOptions = {
  table: string;
  record: Record<string, unknown>;
};

type SupabaseUpdateOptions = SupabaseMutationOptions & { changes: Record<string, unknown> };

export type SupabaseClientAdapter = {
  select(options: SupabaseSelectOptions): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  insert(options: SupabaseInsertOptions): Promise<Record<string, unknown>>;
  update(options: SupabaseUpdateOptions): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  remove(options: SupabaseMutationOptions): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};

const FRONTEND_ROOT = process.cwd();
const PROJECT_ROOT = path.resolve(FRONTEND_ROOT, '..', '..', '..');
const CODEX_DIR = path.join(PROJECT_ROOT, 'codex');
const MCP_BIN = process.env.MCP_FEED_NODE ?? 'node';

dotenv.config({ path: path.join(CODEX_DIR, '.env') });

class SupabaseMcpError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

async function createTransport() {
  const transport = new StdioClientTransport({
    command: MCP_BIN,
    args: ['dist/index.js'],
    cwd: CODEX_DIR,
    env: process.env,
    stderr: 'pipe',
  });
  if (transport.stderr) {
    transport.stderr.on('data', chunk => {
      const text = chunk?.toString?.() ?? '';
      if (text.trim()) {
        console.error('[supabase_mcp]', text.trim());
      }
    });
  }
  return transport;
}

async function createToolCaller() {
  const transport = await createTransport();
  const client = new Client({ name: 'm46-frontend-mcp', version: '0.1.0' });
  await client.connect(transport);
  async function shutdown() {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
  const callTool = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) {
      const text = result.content?.map(item => (item.type === 'text' ? item.text : '')).join('\n');
      throw new SupabaseMcpError(text || `Supabase MCP tool ${name} failed`, 500);
    }
    if (result.structuredContent) {
      return result.structuredContent as Record<string, unknown>;
    }
    const fallback = result.content?.map(item => (item.type === 'text' ? item.text : '')).join('\n') ?? '{}';
    try {
      return JSON.parse(fallback);
    } catch {
      return {};
    }
  };
  return { callTool, shutdown };
}

export async function withSupabaseMcp<T>(runner: (client: SupabaseClientAdapter) => Promise<T>): Promise<T> {
  const { callTool, shutdown } = await createToolCaller();
  const adapter: SupabaseClientAdapter = {
    async select(options) {
      const result = await callTool('supabase_select', options);
      const rows = Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : [];
      const rowCount =
        typeof result.rowCount === 'number'
          ? result.rowCount
          : rows.length;
      return { rows, rowCount };
    },
    async insert(options) {
      const result = await callTool('supabase_insert', options);
      if (result.inserted && typeof result.inserted === 'object') {
        return result.inserted as Record<string, unknown>;
      }
      return result as Record<string, unknown>;
    },
    async update(options) {
      const result = await callTool('supabase_update', options);
      const rows = Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : [];
      const rowCount = typeof result.rowCount === 'number' ? result.rowCount : rows.length;
      return { rows, rowCount };
    },
    async remove(options) {
      const result = await callTool('supabase_delete', options);
      const rows = Array.isArray(result.rows) ? (result.rows as Record<string, unknown>[]) : [];
      const rowCount = typeof result.rowCount === 'number' ? result.rowCount : rows.length;
      return { rows, rowCount };
    },
  };
  try {
    return await runner(adapter);
  } finally {
    await shutdown();
  }
}

export { SupabaseMcpError };
