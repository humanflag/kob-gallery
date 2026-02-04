import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="border-t border-border-subtle mt-16 md:mt-20 bg-background-elevated">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 md:gap-12">
          {/* Identity */}
          <div className="md:col-span-4 lg:col-span-5 flex flex-col justify-center h-full">
            <div className="py-8 md:py-12 space-y-8">
              <Link href="/" className="block relative h-8 md:h-10 w-[180px] hover:opacity-70 transition-opacity text-foreground">
                <Image 
                  src="/kobLogo.svg" 
                  alt="Kling & Bang" 
                  fill
                  className="object-contain object-left"
                />
              </Link>
              <p className="text-foreground-subtle text-[10px] tracking-[0.4em] uppercase">
                Artist-run gallery since 2003
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="md:col-span-4 lg:col-span-3">
            <h4 className="text-xs uppercase tracking-widest text-foreground-subtle mb-6">Visit</h4>
            <address className="text-foreground-muted text-sm not-italic leading-relaxed">
              Grandagarður 20<br />
              101 Reykjavík<br />
              Iceland
            </address>
          </div>

          {/* Connect/Links */}
          <div className="md:col-span-4 lg:col-span-4">
            <h4 className="text-xs uppercase tracking-widest text-foreground-subtle mb-6">Index</h4>
            <nav className="flex flex-col gap-3 text-sm">
              <Link href="/exhibitions" className="link-hover w-fit text-foreground-muted hover:text-foreground">
                Exhibition Archive
              </Link>
              <Link href="/artists" className="link-hover w-fit text-foreground-muted hover:text-foreground">
                Artist Index
              </Link>
              <Link href="/about" className="link-hover w-fit text-foreground-muted hover:text-foreground">
                About the Gallery
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-24 pt-8 border-t border-border-subtle flex flex-col md:flex-row justify-between gap-4 text-xs text-foreground-subtle uppercase tracking-wider">
          <p>© 2003 — {new Date().getFullYear()} Kling & Bang</p>
          <p>
            Living Archive
          </p>
        </div>
      </div>
    </footer>
  );
}
