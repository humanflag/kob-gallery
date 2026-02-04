import Link from 'next/link';
import Image from 'next/image';
import { getCurrentExhibition, getYears } from '@/lib/db';
import { formatDateRange, getImagePath } from '@/lib/utils';

export default function Home() {
  const currentExhibition = getCurrentExhibition();
  const years = getYears();
  const heroImage = currentExhibition?.images?.[0];

  return (
    <main className="min-h-screen">
      {/* Hero Section - Immersive */}
      <section className="relative min-h-[90vh] flex items-center pt-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {heroImage ? (
            <div className="relative w-full h-full animate-fade-in overflow-hidden">
              <Image
                src={getImagePath(heroImage.local_path, heroImage.original_url)}
                alt={currentExhibition?.title_is || 'Kling & Bang'}
                fill
                priority
                className="object-cover opacity-50 blur-[2px] scale-105"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background" />
            </div>
          ) : (
             <div className="w-full h-full bg-background-elevated animate-pulse" />
          )}
        </div>

        <div className="container relative z-10 animate-fade-in-up mt-12">
          <div className="max-w-4xl space-y-6 md:space-y-10">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="w-12 h-px bg-accent/50" />
                <span className="text-xs uppercase tracking-[0.3em] text-accent font-medium">
                  Current Exhibition
                </span>
              </div>
              {currentExhibition?.artists && currentExhibition.artists.length > 0 && (
                <p className="text-xl md:text-2xl text-foreground-muted font-light tracking-wide pl-6">
                  {currentExhibition.artists.map((a) => a.name).join(', ')}
                </p>
              )}
            </div>

            <h1 className="text-balance leading-[0.85] pl-6">
              {currentExhibition?.title_is || 'Kling & Bang'}
            </h1>

            <div className="flex flex-col sm:flex-row gap-8 sm:items-center pt-6 pl-6">
              <p className="text-lg md:text-xl text-foreground-subtle font-mono tracking-tighter">
                {currentExhibition ? formatDateRange(
                  currentExhibition.start_date,
                  currentExhibition.end_date
                ) : 'Artist-run space'}
              </p>
              
              {currentExhibition && (
                <Link
                  href={`/exhibitions/${currentExhibition.exhibition_id}`}
                  className="link-hover text-sm uppercase tracking-[0.2em] font-bold w-fit text-accent"
                >
                  Explore Details →
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Manifesto / About - Minimalist */}
      <section className="section bg-background">
        <div className="container">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-4 lg:col-span-3">
              <h2 className="text-sm uppercase tracking-widest text-foreground-subtle sticky top-32">
                About
              </h2>
            </div>
            <div className="md:col-span-8 lg:col-span-9 prose">
              <p className="text-2xl md:text-3xl lg:text-4xl font-light leading-tight text-foreground text-balance">
                Since 2003, Kling & Bang has defined the experimental edge of Reykjavík's art scene. 
                Founded by artists for artists, we champion the raw, the unfinished, and the uncompromising.
              </p>
              <div className="mt-12">
                <Link 
                  href="/about" 
                  className="inline-flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors group"
                >
                  <span className="uppercase tracking-widest text-sm border-b border-transparent group-hover:border-foreground transition-all">Read full history</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Archive - Timeline Style */}
      <section className="section border-t border-border-subtle">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-baseline mb-16 gap-6">
            <h2 className="text-4xl font-light">Archive</h2>
            <Link
              href="/exhibitions"
              className="text-foreground-muted hover:text-foreground transition-colors text-sm uppercase tracking-widest"
            >
              View all exhibitions
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-px bg-border-subtle border border-border-subtle">
            {years.map((year) => (
              <Link
                key={year}
                href={`/exhibitions?year=${year}`}
                className="bg-background hover:bg-background-elevated p-8 flex items-center justify-center transition-colors group aspect-square"
              >
                <span className="text-xl font-light text-foreground-muted group-hover:text-foreground group-hover:scale-110 transition-all duration-300">
                  {year}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
