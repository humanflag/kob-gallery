'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Archive', href: '/exhibitions' },
  { name: 'Artists', href: '/artists' },
  { name: 'About', href: '/about' },
];

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 flex flex-col justify-center ${
        scrolled || menuOpen 
          ? 'bg-background/40 backdrop-blur-xl h-20 md:h-24' 
          : 'bg-transparent h-20 md:h-24'
      }`}
    >
      <div className="container flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="relative z-50 block transition-all duration-300 hover:opacity-70 active:scale-95 text-foreground"
          aria-label="Kling & Bang"
        >
          <div className="relative h-8 md:h-10 w-[160px] md:w-[200px]">
             <Image 
                src="/kobLogo.svg" 
                alt="Kling & Bang" 
                fill
                className="object-contain object-left transition-all"
                priority
              />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-12">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`link-hover text-sm uppercase tracking-[0.2em] font-medium ${
                pathname.startsWith(item.href)
                  ? 'text-foreground'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden z-50 p-2 -mr-2 text-foreground hover:text-foreground-muted transition-colors"
          aria-label="Toggle menu"
        >
          <div className="flex flex-col gap-2 w-7">
            <span className={`block h-0.5 bg-current transition-all duration-500 ${menuOpen ? 'rotate-45 translate-y-2.5' : ''}`} />
            <span className={`block h-0.5 bg-current transition-all duration-500 ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
            <span className={`block h-0.5 bg-current transition-all duration-500 ${menuOpen ? '-rotate-45 -translate-y-2.5' : ''}`} />
          </div>
        </button>

        {/* Mobile Menu Overlay */}
        <div 
          className={`fixed inset-0 bg-background z-40 flex flex-col items-center justify-center transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${
            menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
          }`}
        >
          <nav className="flex flex-col items-center gap-12 text-center">
            {navigation.map((item, idx) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`text-4xl md:text-5xl font-light tracking-widest hover:text-foreground-muted transition-all duration-500 ${
                  menuOpen ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
