import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllArtists, getArtistBySlug, getExhibitionsByArtist, getDb } from '@/lib/db';
import type { ExhibitionImage } from '@/lib/db';
import { slugify } from '@/lib/utils';
import ExhibitionCard from '@/components/exhibitions/ExhibitionCard';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const artists = getAllArtists();
  return artists.map((a) => ({
    slug: slugify(a.name),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);

  if (!artist) {
    return { title: 'Artist Not Found' };
  }

  return {
    title: artist.name,
    description: `Exhibitions by ${artist.name} at Kling & Bang gallery.`,
  };
}

export default async function ArtistPage({ params }: PageProps) {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);

  if (!artist) {
    notFound();
  }

  const db = getDb();
  const exhibitions = getExhibitionsByArtist(artist.id);

  // Get first image for each exhibition
  const exhibitionsWithImages = exhibitions.map((exhibition) => {
    const image = db.prepare(`
      SELECT * FROM images WHERE exhibition_id = ? ORDER BY display_order LIMIT 1
    `).get(exhibition.id) as ExhibitionImage | undefined;
    return { exhibition: { ...exhibition, artist_names: artist.name }, image: image || null };
  });

  return (
    <main className="min-h-screen">
      {/* Header Spacer */}
      <div className="h-20 md:h-24 bg-background" />

      {/* Immersive Header */}
      <header className="relative pt-20 md:pt-24 pb-16 border-b border-border-subtle overflow-hidden">
        <div className="absolute inset-0 z-0 bg-background-elevated opacity-20" />
        <div className="container relative z-10 animate-fade-in-up">
          <Link
            href="/artists"
            className="inline-flex items-center gap-2 text-foreground-subtle hover:text-accent transition-colors mb-12 uppercase tracking-[0.2em] text-xs font-bold group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            All Artists
          </Link>

          <div className="max-w-5xl space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-12 h-px bg-accent/50" />
              <span className="text-xs uppercase tracking-[0.3em] text-accent font-medium">
                Artist Profile
              </span>
            </div>
            
            <h1 className="text-balance leading-[0.85] text-gradient">
              {artist.name}
            </h1>

            <p className="text-lg md:text-xl text-foreground-muted font-mono pt-4">
              {exhibitions.length} recorded exhibition{exhibitions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="container py-12 md:py-16">
        <div className="space-y-16">
          <h2 className="text-xs uppercase tracking-[0.3em] text-foreground-subtle border-b border-border-subtle pb-6">
            Exhibitions at Kling & Bang
          </h2>

          {exhibitions.length > 0 ? (
            <div className="grid-archive stagger-children">
              {exhibitionsWithImages.map(({ exhibition, image }) => (
                <ExhibitionCard
                  key={exhibition.id}
                  exhibition={exhibition}
                  image={image}
                />
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <p className="text-foreground-muted font-light italic">No exhibitions found in the digital archive.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
