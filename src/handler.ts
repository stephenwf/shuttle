import { getAsset } from './routes/get-asset';
import { getSearch } from './routes/get-search';

export async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const base = new URL(request.url);
  base.pathname = '';
  base.search = '';
  const baseUrl = base.toString();

  const corsHeaders: HeadersInit = {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type,Accept',
  };

  if (request.method === 'HEAD') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (url.pathname.startsWith('/assets/') && request.method === 'GET') {
    return getAsset(request, baseUrl, corsHeaders);
  }

  if (url.pathname.startsWith('/search/') && request.method === 'GET') {
    return getSearch(request, baseUrl, corsHeaders);
  }

  return new Response('Not found', { status: 404 });
}
