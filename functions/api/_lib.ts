export interface Env {
  RSVP_KV: KVNamespace;
  ADMIN_KEY: string;
}

export type Restriccion = 'vegetariane' | 'vegane' | 'celiaque' | 'otra';

export const RESTRICCIONES_VALIDAS: Restriccion[] = ['vegetariane', 'vegane', 'celiaque', 'otra'];

export interface Respuesta {
  restricciones: Restriccion[];
  restriccionDetalle?: string;
  mensaje?: string;
  timestamp: string;
}

export interface InviteeRecord {
  nombre: string;
  telefono?: string;
  status: 'pending' | 'confirmed' | 'declined';
  respuesta: Respuesta | null;
}

export function kvKey(token: string): string {
  return `invitee:${token}`;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function csvEscape(value: string): string {
  const v = value ?? '';
  if (/[",\n]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

export interface AdminRow {
  nombre: string;
  token: string;
  status: InviteeRecord['status'];
  timestamp: string | null;
  restricciones: Restriccion[];
  restriccionDetalle: string | null;
  mensaje: string | null;
}

export async function listInviteeRows(kv: KVNamespace): Promise<AdminRow[]> {
  const rows: AdminRow[] = [];

  let cursor: string | undefined;
  do {
    const list = await kv.list({ prefix: 'invitee:', cursor });
    for (const entry of list.keys) {
      const raw = await kv.get(entry.name);
      if (!raw) continue;
      const record: InviteeRecord = JSON.parse(raw);
      rows.push({
        nombre: record.nombre,
        token: entry.name.slice('invitee:'.length),
        status: record.status,
        timestamp: record.respuesta?.timestamp ?? null,
        restricciones: record.respuesta?.restricciones ?? [],
        restriccionDetalle: record.respuesta?.restriccionDetalle ?? null,
        mensaje: record.respuesta?.mensaje ?? null,
      });
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return rows;
}

export function isAdminAuthorized(request: Request, adminKey: string): boolean {
  const key = new URL(request.url).searchParams.get('key');
  return !!key && key === adminKey;
}
