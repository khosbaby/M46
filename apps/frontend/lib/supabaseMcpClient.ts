import 'server-only';

import { supabaseRest } from './supabaseRest';

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

export class SupabaseMcpError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function formatFilterValue(value: Primitive) {
  if (value === null) return 'is.null';
  if (typeof value === 'boolean') return `eq.${value ? 'true' : 'false'}`;
  return `eq.${value}`;
}

function ensureFilters(filters: Record<string, Primitive>) {
  if (!filters || Object.keys(filters).length === 0) {
    throw new SupabaseMcpError('supabase_mcp_filters_required');
  }
  return filters;
}

function buildFilterSearchParams(filters: Record<string, Primitive> = {}) {
  const params: Record<string, string> = {};
  for (const [column, value] of Object.entries(filters)) {
    params[column] = formatFilterValue(value);
  }
  return params;
}

function wrapError(err: unknown): SupabaseMcpError {
  if (err instanceof SupabaseMcpError) {
    return err;
  }
  if (err instanceof Error) {
    return new SupabaseMcpError(err.message);
  }
  return new SupabaseMcpError('supabase_mcp_unknown_error');
}

async function selectRows(options: SupabaseSelectOptions) {
  const { table, columns, filters, limit, orderBy } = options;
  const searchParams: Record<string, string> = {
    select: columns?.length ? columns.join(',') : '*',
  };
  if (typeof limit === 'number') {
    searchParams.limit = String(limit);
  }
  if (orderBy) {
    const direction = orderBy.ascending === false ? 'desc' : 'asc';
    searchParams.order = `${orderBy.column}.${direction}`;
  }
  Object.assign(searchParams, buildFilterSearchParams(filters));
  const rows = await supabaseRest<Record<string, unknown>[]>(`/${table}`, { searchParams });
  return { rows, rowCount: rows.length };
}

async function insertRow(options: SupabaseInsertOptions) {
  const rows = await supabaseRest<Record<string, unknown>[]>(`/${options.table}`, {
    method: 'POST',
    body: options.record,
  });
  if (Array.isArray(rows)) {
    return rows[0] ?? {};
  }
  return rows;
}

async function updateRows(options: SupabaseUpdateOptions) {
  const searchParams = buildFilterSearchParams(ensureFilters(options.filters));
  const rows = await supabaseRest<Record<string, unknown>[]>(`/${options.table}`, {
    method: 'PATCH',
    searchParams,
    body: options.changes,
  });
  return { rows, rowCount: rows.length };
}

async function deleteRows(options: SupabaseMutationOptions) {
  const searchParams = buildFilterSearchParams(ensureFilters(options.filters));
  const rows = await supabaseRest<Record<string, unknown>[]>(`/${options.table}`, {
    method: 'DELETE',
    searchParams,
  });
  return { rows, rowCount: rows.length };
}

export async function withSupabaseMcp<T>(runner: (client: SupabaseClientAdapter) => Promise<T>): Promise<T> {
  const adapter: SupabaseClientAdapter = {
    select: opts => selectRows(opts),
    insert: opts => insertRow(opts),
    update: opts => updateRows(opts),
    remove: opts => deleteRows(opts),
  };
  try {
    return await runner(adapter);
  } catch (err) {
    throw wrapError(err);
  }
}
