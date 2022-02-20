import { NASA } from '../NASA';
import { IIIFBuilder } from 'iiif-builder';
import { queryStringStringify } from '../utility/query-string-stringify';

export async function getSearch(request: Request, baseUrl: string, corsHeaders: HeadersInit): Promise<Response> {
  const api = new NASA();
  const url = new URL(request.url);

  const [, , query, pageOrIndex, ...extra] = url.pathname.split('/');
  const params = new URLSearchParams(url.search);
  const yearEnd = params.get('year_end');
  const yearStart = params.get('year_start');

  const extraParams =
    yearEnd || yearStart ? `?${queryStringStringify({ year_start: yearStart, year_end: yearEnd })}` : '';

  const isIndex = pageOrIndex === 'index';
  const page = isIndex ? 0 : pageOrIndex ? parseInt(pageOrIndex) : 1;
  const search = await api.search({
    media_type: ['image'],
    description: decodeURIComponent(query),
    year_start: yearStart ? parseInt(yearStart, 10) : undefined,
    year_end: yearEnd ? parseInt(yearEnd, 10) : undefined,
    page,
  });

  if (!search || extra.length || Number.isNaN(page)) {
    return new Response('Not found', { status: 404 });
  }

  const builder = new IIIFBuilder();
  const createManifestId = (nasaId: string) => `${baseUrl}assets/${nasaId}/manifest`;
  const createCollectionId = (p: number) => `${baseUrl}search/${query}/${p}${extraParams}`;
  const collectionId = createCollectionId(page);

  const itemsOnThisPage = search.collection.items.length;
  const isLastPage = !search.collection.links.find((l) => l.rel === 'next');
  const totalResults = search.collection.metadata.total_hits;

  const totalsPages = Math.ceil(isLastPage ? page : totalResults / itemsOnThisPage);

  const builtCollection = builder.createCollection(collectionId, (collection) => {
    collection.addLabel('Search results for ' + decodeURIComponent(query));
    for (const result of search.collection.items) {
      const item = result.data[0];
      const thumbnail = result.links.find((l) => l.rel === 'preview' && l.render === 'image');

      collection.createManifest(createManifestId(item.nasa_id), (manifest) => {
        manifest.addLabel(item.title);
        if (thumbnail) {
          manifest.addThumbnail({ id: thumbnail.href, type: 'Image', format: 'image/jpg' });
        }
      });
    }

    collection.setPartOf([
      {
        id: `${collectionId}/index`,
        label: { en: ['All search result pages'] },
        type: 'Collection',
      } as any,
    ]);

    collection.setService([
      {
        id: `${collectionId}/service/total-results`,
        profile: `${baseUrl}profile/total-results`,
        label: { none: [`${totalResults}`] },
      } as any,
      {
        id: `${collectionId}/service/total-pages`,
        profile: `${baseUrl}profile/total-pages`,
        label: { none: [`${totalsPages}`] },
      } as any,
    ]);

    const seeAlso: any[] = [];

    if (page > 0 && page < totalsPages) {
      seeAlso.push({
        id: createCollectionId(page + 1),
        label: { en: [`Page ${page + 1} of results`] },
        profile: `${baseUrl}profile/next-page`,
      });
    }
    if (page > 1) {
      seeAlso.push({
        id: createCollectionId(page - 1),
        label: { en: [`Page ${page - 1} of results`] },
        profile: `${baseUrl}profile/previous-page`,
      });
    }

    collection.setSeeAlso(seeAlso);
  });

  return new Response(JSON.stringify(builder.toPresentation3(builtCollection), null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
