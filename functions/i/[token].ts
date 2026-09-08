// Sirve la misma SPA (public/index.html) para /i/:token — el token se lee
// del path con JS en app.js. Se resuelve como Function (no _redirects) para
// evitar la canonicalización automática de /index.html -> / de Pages.

export const onRequestGet: PagesFunction<{ ASSETS: Fetcher }> = async (context) => {
  const assetUrl = new URL('/', context.request.url);
  return context.env.ASSETS.fetch(new Request(assetUrl, context.request));
};
