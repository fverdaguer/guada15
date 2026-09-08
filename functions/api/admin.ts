import { Env, InviteeRecord, csvEscape } from './_lib';

const ESTADO_LABEL: Record<InviteeRecord['status'], string> = {
  pending: 'pendiente',
  confirmed: 'confirmado',
  declined: 'no viene',
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const key = url.searchParams.get('key');

  if (!key || key !== context.env.ADMIN_KEY) {
    return new Response('unauthorized', { status: 401 });
  }

  const rows: string[] = ['nombre,token,estado,timestamp,restricciones,mensaje'];

  let cursor: string | undefined;
  do {
    const list = await context.env.RSVP_KV.list({ prefix: 'invitee:', cursor });
    for (const entry of list.keys) {
      const raw = await context.env.RSVP_KV.get(entry.name);
      if (!raw) continue;
      const record: InviteeRecord = JSON.parse(raw);
      const token = entry.name.slice('invitee:'.length);
      const timestamp = record.respuesta?.timestamp ?? '';
      let restricciones = (record.respuesta?.restricciones ?? []).join(';');
      if (record.respuesta?.restriccionDetalle) {
        restricciones += restricciones ? ` (${record.respuesta.restriccionDetalle})` : `otra (${record.respuesta.restriccionDetalle})`;
      }
      const mensaje = record.respuesta?.mensaje ?? '';

      rows.push(
        [
          csvEscape(record.nombre),
          csvEscape(token),
          csvEscape(ESTADO_LABEL[record.status]),
          csvEscape(timestamp),
          csvEscape(restricciones),
          csvEscape(mensaje),
        ].join(',')
      );
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  const csv = rows.join('\n') + '\n';

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="confirmados.csv"',
    },
  });
};
