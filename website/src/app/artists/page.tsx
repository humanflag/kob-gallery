import { getAllArtists } from '@/lib/db';
import ArtistList from '@/components/artists/ArtistList';

export const metadata = {
  title: 'Artists',
  description: 'Browse all artists who have exhibited at Kling & Bang gallery since 2003.',
};

export default function ArtistsPage() {
  const artists = getAllArtists();

  return (
    <main className="min-h-screen">
      {/* Header Spacer */}
      <div className="h-20 md:h-24 bg-background" />

      {/* Immersive Header */}
      <header className="relative pt-20 md:pt-24 pb-16 border-b border-border-subtle overflow-hidden">
        <div className="absolute inset-0 z-0 bg-background-elevated opacity-30" />
        <div className="container relative z-10 animate-fade-in-up">
          <div className="max-w-5xl space-y-8">
            <div className="flex items-center gap-3">
              <span className="w-12 h-px bg-accent/50" />
              <span className="text-xs uppercase tracking-[0.3em] text-accent font-medium">
                Contributor Index
              </span>
            </div>
            <h1 className="text-balance leading-[0.85] text-gradient">
              {artists.length} voices in our history.
            </h1>
            <p className="text-xl md:text-2xl text-foreground-muted font-light tracking-wide max-w-2xl">
              From emerging names to established figures, Kling & Bang has been 
              a platform for uncompromising artistic practices since 2003.
            </p>
          </div>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-24 md:h-32" />

      <div className="container py-24 md:py-32">
        <ArtistList initialArtists={artists} />
      </div>
    </main>
  );
}
