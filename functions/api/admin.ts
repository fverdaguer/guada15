import { Env, csvEscape, isAdminAuthorized, listInviteeRows, AdminRow } from './_lib';

const ESTADO_LABEL: Record<AdminRow['status'], string> = {
  pending: 'pendiente',
  confirmed: 'confirmado',
  declined: 'no viene',
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!isAdminAuthorized(context.request, context.env.ADMIN_KEY)) {
    return new Response('unauthorized', { status: 401 });
  }

  const invitees = await listInviteeRows(context.env.RSVP_KV);

  const rows: string[] = ['nombre,token,estado,timestamp,restricciones,mensaje'];

  for (const inv of invitees) {
    let restricciones = inv.restricciones.join(';');
    if (inv.restriccionDetalle) {
      restricciones += restricciones ? ` (${inv.restriccionDetalle})` : `otra (${inv.restriccionDetalle})`;
    }

    rows.push(
      [
        csvEscape(inv.nombre),
        csvEscape(inv.token),
        csvEscape(ESTADO_LABEL[inv.status]),
        csvEscape(inv.timestamp ?? ''),
        csvEscape(restricciones),
        csvEscape(inv.mensaje ?? ''),
      ].join(',')
    );
  }

  const csv = rows.join('\n') + '\n';

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="confirmados.csv"',
    },
  });
};
