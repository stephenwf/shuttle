import { Asset } from '../NASA.types';
import { IIIFBuilder } from 'iiif-builder';
import { NASA } from '../NASA';

export async function getAsset(request: Request, baseUrl: string, corsHeaders: HeadersInit): Promise<Response> {
  const api = new NASA();
  const url = new URL(request.url);

  const [, , nasaId, manifest, ...extra] = url.pathname.split('/');
  const asset = await api.asset(nasaId);

  if (!asset || manifest !== 'manifest' || extra.length) {
    return new Response('Not found', { status: 404 });
  }

  const metadataLink = asset.collection.items.find((i: any) => i.href.endsWith('metadata.json'));
  const thumbnailLink = asset.collection.items.find((i: any) => i.href.endsWith('~thumb.jpg'));
  const originalLink = asset.collection.items.find((i: any) => i.href.indexOf('~orig.') !== -1);

  if (!metadataLink || !originalLink) {
    return new Response('Not found', { status: 404 });
  }

  const metadata = await api.link<Asset>(
    (asset as any).collection.items.find((i: any) => i.href.endsWith('metadata.json')).href
  );

  // Things we want.
  const title = metadata['AVAIL:Title'] || metadata['XMP:Title'] || metadata['IPTC:ObjectName'];
  const description =
    metadata['EXIF:ImageDescription'] ||
    metadata['AVAIL:Description'] ||
    metadata['XMP:Description'] ||
    metadata['IPTC:Caption-Abstract'];
  // Metadata keys.
  const location = metadata['AVAIL:Location'] || metadata['XMP:Location'];
  const subjectTree = metadata['XMP:HierarchicalSubject'];
  const copyright = metadata['XMP:Rights'] || metadata['EXIF:Copyright'];
  const credit = metadata['IPTC:Credit'] || metadata['XMP:Credit'];
  const lensMode = metadata['EXIF:LensModel'];
  const subjects = metadata['AVAIL:Keywords'] || metadata['IPTC:Keywords'] || metadata['XMP:Subject'];
  const dateCreated = metadata['IPTC:DateCreated'] || metadata['XMP:DateCreated'] || metadata['AVAIL:DateCreated'];

  const width = metadata['File:ImageWidth'] || metadata['EXIF:ImageWidth'] || metadata['EXIF:ExifImageWidth'] || 1024;
  const height =
    metadata['File:ImageHeight'] || metadata['EXIF:ImageHeight'] || metadata['EXIF:ExifImageHeight'] || 1024;

  const created = dateCreated ? new Date(dateCreated) : null;

  const builder = new IIIFBuilder();
  const manifestId = `${baseUrl}assets/${nasaId}/manifest`;
  const builtManifest = builder.createManifest(manifestId, (manifest) => {
    manifest.addLabel(title || `Image ${nasaId}`, 'en');
    if (description) {
      manifest.addSummary(description, 'en');
    }

    description && manifest.addMetadata({ en: ['Summary'] }, { en: [description] });
    location && manifest.addMetadata({ en: ['Location'] }, { en: [location] });
    subjectTree && manifest.addMetadata({ en: ['Subject tree'] }, { en: [subjectTree] });
    subjects && manifest.addMetadata({ en: ['Subjects'] }, { en: subjects });
    credit && manifest.addMetadata({ en: ['Image credit'] }, { en: credit.split('/') });
    created &&
      !Number.isNaN(created.getFullYear()) &&
      manifest.addMetadata({ en: ['Year'] }, { en: [`${created.getFullYear()}`] });
    dateCreated && manifest.addMetadata({ en: ['Date'] }, { en: [dateCreated] });
    lensMode && manifest.addMetadata({ en: ['Lens'] }, { en: [lensMode] });

    if (copyright) {
      manifest.setRequiredStatement({
        label: { en: ['Copyright'] },
        value: { en: [copyright] },
      });
    } else if (credit) {
      manifest.setRequiredStatement({
        label: { en: ['Credit'] },
        value: { en: [credit] },
      });
    }

    manifest.createCanvas(`${manifestId}/c0`, (canvas) => {
      canvas.addLabel(title || `Image ${nasaId}`, 'en');

      canvas.setWidth(width as number);
      canvas.setHeight(height as number);

      if (thumbnailLink) {
        canvas.addThumbnail({
          id: thumbnailLink.href,
          type: 'Image',
        });
      }

      canvas.createAnnotation(`${manifestId}/c0/annotation`, {
        id: `${manifestId}/c0/annotation`,
        type: 'Annotation',
        motivation: 'painting',
        body: {
          id: originalLink.href,
          type: 'Image',
          format: 'image/jpg',
          height,
          width,
        } as any,
      });
    });
  });

  return new Response(JSON.stringify(builder.toPresentation3(builtManifest), null, 2), {
    headers: {
      ...corsHeaders,
    },
    status: 200,
  });
}
