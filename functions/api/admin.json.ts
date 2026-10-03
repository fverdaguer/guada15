import { Env, isAdminAuthorized, listInviteeRows, json } from './_lib';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!isAdminAuthorized(context.request, context.env.ADMIN_KEY)) {
    return json({ error: 'unauthorized' }, 401);
  }

  const invitees = await listInviteeRows(context.env.RSVP_KV);

  return json({ invitees });
};
