import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getExhibitionById, getAllExhibitions } from '@/lib/db';
import { formatDateRange, getImagePath, slugify } from '@/lib/utils';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const exhibitions = getAllExhibitions();
  return exhibitions.map((e) => ({
    id: e.exhibition_id.toString(),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const exhibition = getExhibitionById(parseInt(id));

  if (!exhibition) {
    return { title: 'Exhibition Not Found' };
  }

  const artistNames = exhibition.artists.map((a) => a.name).join(', ');

  return {
    title: exhibition.title_is,
    description:
      exhibition.description_is?.slice(0, 160) ||
      `Exhibition by ${artistNames} at Kling & Bang`,
    openGraph: {
      title: `${exhibition.title_is} | Kling & Bang`,
      description:
        exhibition.description_is?.slice(0, 160) ||
        `Exhibition by ${artistNames}`,
      images: exhibition.images[0]
        ? [getImagePath(exhibition.images[0].local_path, exhibition.images[0].original_url)]
        : [],
    },
  };
}

export default async function ExhibitionPage({ params }: PageProps) {
  const { id } = await params;
  const exhibition = getExhibitionById(parseInt(id));

  if (!exhibition) {
    notFound();
  }

  const heroImage = exhibition.images[0];

  return (
    <main className="min-h-screen">
      {/* Header Spacer */}
      <div className="h-32 md:h-40 bg-background" />

      {/* Header / Hero */}
      <header className="relative min-h-[70vh] flex items-center pt-24 md:pt-32 pb-16 overflow-hidden">
        {heroImage && (
          <div className="absolute inset-0 z-0">
             <Image
                src={getImagePath(heroImage.local_path, heroImage.original_url)}
                alt={exhibition.title_is}
                fill
                priority
                className="object-cover opacity-30 blur-sm scale-105"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/60 to-background" />
          </div>
        )}
        
        <div className="container relative z-10 animate-fade-in-up">
          <Link
            href="/exhibitions"
            className="inline-flex items-center gap-2 text-foreground-subtle hover:text-accent transition-colors mb-12 uppercase tracking-[0.2em] text-xs font-bold group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            Back to Archive
          </Link>

          <div className="max-w-5xl space-y-6">
            {exhibition.artists.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xl md:text-2xl font-light text-foreground-muted">
                {exhibition.artists.map((artist, i) => (
                  <span key={artist.id}>
                    <Link
                      href={`/artists/${slugify(artist.name)}`}
                      className="hover:text-foreground transition-colors"
                    >
                      {artist.name}
                    </Link>
                    {i < exhibition.artists.length - 1 && <span className="ml-4 opacity-30">/</span>}
                  </span>
                ))}
              </div>
            )}

            <h1 className="text-balance leading-[0.9] text-gradient">
              {exhibition.title_is}
            </h1>

            {exhibition.title_en && exhibition.title_en !== exhibition.title_is && (
              <p className="text-2xl md:text-3xl text-foreground-subtle font-light italic">
                {exhibition.title_en}
              </p>
            )}

            <p className="text-lg md:text-xl text-accent font-mono pt-4">
              {formatDateRange(exhibition.start_date, exhibition.end_date)}
            </p>
          </div>
        </div>
      </header>

      <div className="container pb-24">
        <div className="grid lg:grid-cols-12 gap-16 md:gap-24">
          {/* Main Content */}
          <div className="lg:col-span-7 space-y-16">
            {/* Gallery */}
            {exhibition.images.length > 0 && (
              <div className="space-y-8 md:space-y-12">
                {exhibition.images.map((image, idx) => (
                  <figure key={image.id} className="animate-fade-in group">
                    <div className="bg-background-elevated overflow-hidden">
                       <Image
                        src={getImagePath(image.local_path, image.original_url)}
                        alt={image.alt_text || `${exhibition.title_is} - Image ${idx + 1}`}
                        width={1200}
                        height={800}
                        className="w-full h-auto object-contain transition-transform duration-700 group-hover:scale-[1.02]"
                        priority={idx === 0}
                      />
                    </div>
                    {image.alt_text && (
                      <figcaption className="mt-4 text-xs uppercase tracking-widest text-foreground-subtle text-right">
                        {image.alt_text}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar / Description */}
          <aside className="lg:col-span-5 space-y-12">
            <div className="sticky top-32 space-y-12">
              {exhibition.description_is && (
                <div className="prose prose-invert prose-lg text-foreground-muted leading-relaxed font-light">
                   {exhibition.description_is.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-6">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}

              {exhibition.description_en && exhibition.description_en !== exhibition.description_is && (
                <div className="pt-12 border-t border-border-subtle">
                  <h4 className="text-xs uppercase tracking-widest text-accent mb-6">Translation</h4>
                  <div className="prose prose-invert prose-md text-foreground-subtle leading-relaxed italic">
                    {exhibition.description_en.split('\n\n').map((paragraph, idx) => (
                      <p key={idx} className="mb-4">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta Stats */}
              <div className="pt-12 border-t border-border-subtle grid grid-cols-2 gap-8">
                <div>
                  <h4 className="text-[10px] uppercase tracking-[0.2em] text-foreground-subtle mb-2">Year</h4>
                  <Link 
                    href={`/exhibitions?year=${exhibition.year}`}
                    className="text-sm font-medium hover:text-accent transition-colors"
                  >
                    {exhibition.year}
                  </Link>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-[0.2em] text-foreground-subtle mb-2">Archive ID</h4>
                  <p className="text-sm font-mono text-foreground-muted">{exhibition.exhibition_id}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
