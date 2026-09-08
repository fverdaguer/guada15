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
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function csvEscape(value: string): string {
  const v = value ?? '';
  if (/[",\n]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}
