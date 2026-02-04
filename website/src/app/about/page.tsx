import { getStats, getYears } from '@/lib/db';
import Link from 'next/link';

export const metadata = {
  title: 'About',
  description: 'About Kling & Bang, Iceland\'s oldest artist-run gallery, established in 2003.',
};

export default function AboutPage() {
  const stats = getStats();
  const years = getYears();

  return (
    <main className="min-h-screen">
      {/* Header Spacer */}
      <div className="h-20 md:h-24 bg-background" />

      {/* Immersive Header */}
      <header className="relative pt-20 md:pt-24 pb-16 md:pb-20 border-b border-border-subtle overflow-hidden">
        <div className="absolute inset-0 z-0 bg-background-elevated opacity-50" />
        <div className="container relative z-10 animate-fade-in-up">
          <div className="max-w-5xl space-y-8">
            <div className="flex items-center gap-3">
              <span className="w-12 h-px bg-accent/50" />
              <span className="text-xs uppercase tracking-[0.3em] text-accent font-medium">
                Gallery Profile
              </span>
            </div>
            <h1 className="text-balance leading-[0.85] text-gradient">
              Kling & Bang defined the edge.
            </h1>
            <p className="text-xl md:text-3xl text-foreground-muted font-light leading-tight max-w-3xl text-balance">
              Founded in 2003 by a collective of artists, we remain Iceland&apos;s 
              oldest continuously operating experimental art space.
            </p>
          </div>
        </div>
      </header>

      <div className="h-24 md:h-32" />

      <div className="container py-12 md:py-16">
        <div className="grid lg:grid-cols-12 gap-12 md:gap-16">
          
          <div className="lg:col-span-7 space-y-16 md:space-y-20">
            <section className="animate-fade-in">
              <h2 className="text-xs uppercase tracking-[0.3em] text-accent mb-12 flex items-center gap-4">
                01. Origins
              </h2>
              <div className="prose prose-invert prose-2xl font-light text-foreground-muted leading-relaxed">
                <p>
                  Kling & Bang was born out of a necessity for a space that prioritized 
                  the raw, the unfinished, and the uncompromising. Founded by artists 
                  for artists, the gallery has maintained its grassroots spirit for over two decades.
                </p>
                <p className="mt-12">
                  True to its Icelandic identity, the gallery serves as a digital and 
                  physical extension of the creative energy in Reykjavík—unpolished 
                  but intentional, unconventional but thoughtful.
                </p>
              </div>
            </section>

            <section className="animate-fade-in">
              <h2 className="text-xs uppercase tracking-[0.3em] text-accent mb-12 flex items-center gap-4">
                02. Mission
              </h2>
              <div className="prose prose-invert prose-xl font-light text-foreground-muted leading-relaxed italic">
                <p>
                  &quot;We believe things should work. That someone should make the effort to 
                  think it through... but also, just as importantly, that it actually 
                  feels like people made it.&quot;
                </p>
              </div>
              <p className="mt-12 text-lg text-foreground-muted leading-relaxed">
                Kling & Bang is dedicated to showing challenging contemporary art. 
                Decisions are made by artists, ensuring the work—not commerce—remains 
                the focus. We welcome diverse practices and provide opportunities 
                for artists at every stage of their career.
              </p>
            </section>

            <section className="animate-fade-in">
              <h2 className="text-xs uppercase tracking-[0.3em] text-accent mb-12 flex items-center gap-4">
                03. The Archive
              </h2>
              <p className="text-lg text-foreground-muted leading-relaxed">
                This digital document preserves 22+ years of contemporary art in Iceland. 
                It is a living historical record, housing thousands of images 
                from hundreds of exhibitions. It serves as a resource for 
                researchers, artists, and the curious.
              </p>
            </section>
          </div>

          {/* Sidebar Data */}
          <aside className="lg:col-span-5">
            <div className="sticky top-32 space-y-16 animate-fade-in">
              {/* Stats Block */}
              <div className="bg-background-elevated p-12 space-y-12">
                <h3 className="text-xs uppercase tracking-[0.3em] text-foreground-subtle border-b border-border-subtle pb-6">
                  Archive Data
                </h3>
                <dl className="grid grid-cols-2 gap-y-12">
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-accent mb-2">Exhibitions</dt>
                    <dd className="text-4xl font-light">{stats.totalExhibitions}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-accent mb-2">Artists</dt>
                    <dd className="text-4xl font-light">{stats.totalArtists}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-accent mb-2">Years</dt>
                    <dd className="text-4xl font-light">{years.length}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-widest text-accent mb-2">Images</dt>
                    <dd className="text-4xl font-light">{(stats.totalImages / 1000).toFixed(1)}k</dd>
                  </div>
                </dl>
              </div>

              {/* Location */}
              <div className="space-y-6 px-4">
                <h3 className="text-xs uppercase tracking-[0.3em] text-foreground-subtle">Location</h3>
                <address className="text-xl font-light not-italic text-foreground-muted leading-relaxed">
                  Grandagarður 20<br />
                  101 Reykjavík, Iceland
                </address>
                <div className="pt-4">
                  <Link 
                    href="/exhibitions" 
                    className="link-hover text-xs uppercase tracking-widest font-bold text-accent"
                  >
                    View Exhibition Archive →
                  </Link>
                </div>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}