import Link from 'next/link';
import Image from 'next/image';
import { formatDateRange, getImagePath } from '@/lib/utils';
import type { Exhibition, ExhibitionImage } from '@/lib/db';

interface ExhibitionCardProps {
  exhibition: Exhibition & { artist_names?: string };
  image?: ExhibitionImage | null;
}

export default function ExhibitionCard({ exhibition, image }: ExhibitionCardProps) {
  const imageSrc = image ? getImagePath(image.local_path, image.original_url) : null;

  return (
    <Link
      href={`/exhibitions/${exhibition.exhibition_id}`}
      className="group block animate-fade-in"
    >
      <article className="bg-background-elevated p-4 space-y-4 transition-colors group-hover:bg-background-subtle">
        {/* Image - Natural Aspect Ratio */}
        <div className="bg-background overflow-hidden border border-border-subtle/50 group-hover:border-accent/30 transition-colors relative">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={exhibition.title_is}
              width={600}
              height={400}
              className="w-full h-auto object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
            />
          ) : (
            <div className="w-full aspect-[4/3] flex items-center justify-center text-foreground-subtle/20 bg-background">
              <span className="text-xs uppercase tracking-widest font-mono">No Visual</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-3 px-1">
          {/* Title */}
          <h3 className="text-xl font-light leading-[1.1] text-foreground group-hover:text-accent transition-colors text-balance">
            {exhibition.title_is}
          </h3>

          {/* Date */}
          <p className="text-[10px] font-mono uppercase tracking-widest text-accent/60">
            {formatDateRange(exhibition.start_date, exhibition.end_date)}
          </p>

          {/* Artists */}
          {exhibition.artist_names && (
            <p className="text-sm text-foreground-muted font-light leading-snug">
              {exhibition.artist_names}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
