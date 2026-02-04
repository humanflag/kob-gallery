import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container min-h-[60vh] flex flex-col items-center justify-center text-center">
      <h1 className="text-6xl md:text-8xl font-light mb-6">404</h1>
      <p className="text-xl text-muted-foreground mb-8">
        Page not found
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="px-6 py-3 border border-foreground text-sm uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors"
        >
          Home
        </Link>
        <Link
          href="/exhibitions"
          className="px-6 py-3 border border-border text-sm uppercase tracking-wider hover:bg-accent transition-colors"
        >
          Archive
        </Link>
      </div>
    </div>
  );
}
