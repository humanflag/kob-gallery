'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { slugify } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Artist {
  id: number;
  name: string;
  exhibition_count: number;
}

interface ArtistListProps {
  initialArtists: Artist[];
}

export default function ArtistList({ initialArtists }: ArtistListProps) {
  const [search, setSearch] = useState('');

  const filteredArtists = useMemo(() => {
    return initialArtists.filter(artist => 
      artist.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, initialArtists]);

  // Group artists by first letter
  const grouped = useMemo(() => {
    return filteredArtists.reduce(
      (acc, artist) => {
        const letter = artist.name.charAt(0).toUpperCase();
        if (!acc[letter]) {
          acc[letter] = [];
        }
        acc[letter].push(artist);
        return acc;
      },
      {} as Record<string, Artist[]>
    );
  }, [filteredArtists]);

  const letters = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'is'));

  return (
    <div className="grid lg:grid-cols-12 gap-16 md:gap-24">
      {/* Search Filter - Sticky */}
      <aside className="lg:col-span-3">
        <div className="sticky top-32 space-y-8">
          <div className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-[0.3em] text-foreground-subtle">
              Search Index
            </h3>
            <div className="relative group">
              <input
                type="text"
                placeholder="Find artist..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-b border-border-subtle py-4 text-xl font-light focus:outline-none focus:border-accent transition-colors placeholder:text-foreground-subtle/30"
              />
              <div className="absolute bottom-0 left-0 h-px bg-accent w-0 group-focus-within:w-full transition-all duration-500" />
            </div>
            <p className="text-[10px] text-foreground-subtle font-mono">
              {filteredArtists.length} matches
            </p>
          </div>

          {search && (
            <button 
              onClick={() => setSearch('')}
              className="text-[10px] uppercase tracking-widest text-accent hover:text-foreground transition-colors"
            >
              Clear Filter [×]
            </button>
          )}
        </div>
      </aside>

      {/* Artist List */}
      <div className="lg:col-span-9 space-y-16">
        <AnimatePresence mode="popLayout">
          {letters.length > 0 ? (
            letters.map((letter) => (
              <motion.section 
                key={letter} 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="scroll-mt-40"
              >
                <div className="flex items-baseline gap-8 mb-12 border-b border-border-subtle pb-4">
                  <h2 className="text-6xl font-light text-accent/20 leading-none">
                    {letter}
                  </h2>
                  <span className="text-xs uppercase tracking-widest text-foreground-subtle font-mono">
                    {grouped[letter].length}
                  </span>
                </div>
                
                <div className="grid gap-x-12 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
                  {grouped[letter].map((artist) => (
                    <Link
                      key={artist.id}
                      href={`/artists/${slugify(artist.name)}`}
                      className="group flex items-baseline justify-between border-b border-transparent hover:border-accent/30 py-2 transition-all"
                    >
                      <span className="text-lg font-light text-foreground-muted group-hover:text-foreground transition-colors truncate pr-4">
                        {artist.name}
                      </span>
                      <span className="text-[10px] font-mono text-foreground-subtle group-hover:text-accent">
                        {artist.exhibition_count}
                      </span>
                    </Link>
                  ))}
                </div>
              </motion.section>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-24 text-center"
            >
              <p className="text-xl font-light text-foreground-muted italic">
                No artists found matching &quot;{search}&quot;
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
