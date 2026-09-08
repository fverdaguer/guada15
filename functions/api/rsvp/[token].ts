import { Env, InviteeRecord, RESTRICCIONES_VALIDAS, Restriccion, json, kvKey } from '../_lib';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const token = context.params.token as string;
  const raw = await context.env.RSVP_KV.get(kvKey(token));

  if (!raw) {
    return json({ error: 'token_not_found' }, 404);
  }

  const record: InviteeRecord = JSON.parse(raw);

  return json({
    status: record.status,
    nombre: record.nombre,
    ...(record.status !== 'pending' ? { respuesta: record.respuesta } : {}),
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const token = context.params.token as string;
  const raw = await context.env.RSVP_KV.get(kvKey(token));

  if (!raw) {
    return json({ error: 'token_not_found' }, 404);
  }

  const record: InviteeRecord = JSON.parse(raw);

  if (record.status !== 'pending') {
    return json({ error: 'already_responded' }, 409);
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (typeof body?.asiste !== 'boolean') {
    return json({ error: 'validation_failed', field: 'asiste' }, 400);
  }

  let restricciones: Restriccion[] = [];
  if (body.restricciones !== undefined) {
    if (!Array.isArray(body.restricciones) || !body.restricciones.every((r: unknown) => RESTRICCIONES_VALIDAS.includes(r as Restriccion))) {
      return json({ error: 'validation_failed', field: 'restricciones' }, 400);
    }
    restricciones = body.restricciones;
  }

  const restriccionDetalle: string | undefined =
    typeof body.restriccionDetalle === 'string' ? body.restriccionDetalle.trim().slice(0, 200) : undefined;

  if (restricciones.includes('otra') && !restriccionDetalle) {
    return json({ error: 'validation_failed', field: 'restriccionDetalle' }, 400);
  }

  let mensaje: string | undefined;
  if (body.mensaje !== undefined) {
    if (typeof body.mensaje !== 'string') {
      return json({ error: 'validation_failed', field: 'mensaje' }, 400);
    }
    mensaje = body.mensaje.trim().slice(0, 500) || undefined;
  }

  const asiste: boolean = body.asiste;

  record.status = asiste ? 'confirmed' : 'declined';
  record.respuesta = {
    restricciones: asiste ? restricciones : [],
    ...(asiste && restriccionDetalle ? { restriccionDetalle } : {}),
    ...(mensaje ? { mensaje } : {}),
    timestamp: new Date().toISOString(),
  };

  await context.env.RSVP_KV.put(kvKey(token), JSON.stringify(record));

  return json({ ok: true });
};
