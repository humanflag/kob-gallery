import { Suspense } from 'react';
import Link from 'next/link';
import { getExhibitionsWithArtists, getYears, getDb } from '@/lib/db';
import type { ExhibitionImage } from '@/lib/db';
import ExhibitionCard from '@/components/exhibitions/ExhibitionCard';
import YearSelector from '@/components/exhibitions/YearSelector';
import MasonryGrid from '@/components/ui/MasonryGrid';

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export const metadata = {
  title: 'Archive',
  description: 'Browse the complete exhibition archive of Kling & Bang gallery from 2003 to present.',
};

function ExhibitionGrid({ year }: { year?: number }) {
  const db = getDb();
  let exhibitions = getExhibitionsWithArtists();

  if (year) {
    exhibitions = exhibitions.filter((e) => e.year === year);
  }

  // Get first image for each exhibition
  const exhibitionsWithImages = exhibitions.map((exhibition) => {
    const image = db.prepare(`
      SELECT * FROM images WHERE exhibition_id = ? ORDER BY display_order LIMIT 1
    `).get(exhibition.id) as ExhibitionImage | undefined;
    return { exhibition, image: image || null };
  });

  if (exhibitions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">
          No exhibitions found {year ? `for ${year}` : ''}.
        </p>
      </div>
    );
  }

  return (
    <MasonryGrid gap={24} minItemWidth={280}>
      {exhibitionsWithImages.map(({ exhibition, image }) => (
        <ExhibitionCard
          key={exhibition.id}
          exhibition={exhibition}
          image={image}
        />
      ))}
    </MasonryGrid>
  );
}

export default async function ExhibitionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const years = getYears();
  const selectedYear = params.year ? parseInt(params.year) : undefined;

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
                Living History
              </span>
            </div>
            <h1 className="text-balance leading-[0.85] text-gradient">
              {selectedYear ? `The ${selectedYear} Archive.` : 'Twenty-two years of edge.'}
            </h1>
            <p className="text-xl md:text-2xl text-foreground-muted font-light tracking-wide max-w-2xl">
              Browsing {selectedYear ? `exhibitions from ${selectedYear}.` : 'the complete record since 2003.'}
            </p>
          </div>
        </div>
      </header>

      {/* Spacer */}
      {/* <div className="h-24 md:h-32" /> */}

      {/* Temporal Year Selector */}
      <YearSelector years={years} selectedYear={selectedYear} />

      <div className="container py-16 md:py-24">
        {/* Grid */}
        <Suspense
          fallback={
            <MasonryGrid gap={24} minItemWidth={280}>
              {[...Array(12)].map((_, i) => (
                <div key={i} className="space-y-4 animate-pulse">
                  <div className="aspect-[4/3] bg-background-elevated" />
                  <div className="space-y-3 px-1">
                    <div className="h-6 bg-background-elevated w-3/4" />
                    <div className="h-3 bg-background-elevated w-1/4" />
                    <div className="h-4 bg-background-elevated w-1/2" />
                  </div>
                </div>
              ))}
            </MasonryGrid>
          }
        >
          <ExhibitionGrid year={selectedYear} />
        </Suspense>
      </div>
    </main>
  );
}
