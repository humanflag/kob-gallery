#!/usr/bin/env python3
"""
Kling & Bang Gallery Archive Scraper

Usage:
    python main.py scrape [--year YEAR] [--start-year YEAR] [--end-year YEAR]
    python main.py images [--year YEAR]
    python main.py export [--output FILE]
    python main.py stats
    python main.py test

Examples:
    python main.py scrape                    # Scrape all years (2003-2025)
    python main.py scrape --year 2024        # Scrape single year
    python main.py scrape --start-year 2020  # Scrape 2020-2025
    python main.py images                    # Download all images
    python main.py export                    # Export to JSON
    python main.py stats                     # Show database statistics
    python main.py test                      # Test with exhibition 555
"""

import argparse
import sys

from database import init_database, get_connection, get_statistics, export_to_json
from scraper import KoBScraper, scrape_single_exhibition
from images import ImageDownloader


def cmd_scrape(args):
    """Run the scraper."""
    init_database(args.db)
    scraper = KoBScraper(args.db, delay=args.delay)

    if args.year:
        stats = scraper.scrape_year(args.year, scrape_english=not args.no_english)
    else:
        stats = scraper.scrape_all_years(
            start_year=args.start_year,
            end_year=args.end_year,
            scrape_english=not args.no_english
        )

    print(f"\nScraping complete!")
    print(f"  Total: {stats['total']}")
    print(f"  Success: {stats['success']}")
    print(f"  Skipped: {stats['skipped']}")
    print(f"  Failed: {stats['failed']}")


def cmd_images(args):
    """Download images."""
    downloader = ImageDownloader(args.db, args.images_dir, delay=args.delay)

    if args.year:
        stats = downloader.download_year_images(args.year)
    else:
        stats = downloader.download_all_images()

    print(f"\nImage download complete!")
    print(f"  Downloaded: {stats['downloaded']}")
    print(f"  Skipped: {stats['skipped']}")
    print(f"  Failed: {stats['failed']}")


def cmd_export(args):
    """Export database to JSON."""
    conn = get_connection(args.db)
    export_to_json(conn, args.output)
    conn.close()


def cmd_stats(args):
    """Show database statistics."""
    conn = get_connection(args.db)
    stats = get_statistics(conn)
    conn.close()

    print("\nDatabase Statistics")
    print("=" * 40)
    print(f"Total exhibitions:   {stats['total_exhibitions']}")
    print(f"Total artists:       {stats['total_artists']}")
    print(f"Total images:        {stats['total_images']}")
    print(f"Downloaded images:   {stats['downloaded_images']}")
    print(f"Failed scrapes:      {stats['failed_scrapes']}")
    print()
    print("Exhibitions by year:")
    for year, count in sorted(stats['exhibitions_by_year'].items()):
        print(f"  {year}: {count}")


def cmd_test(args):
    """Test scraping with a single exhibition."""
    init_database(args.db)
    print("Testing with exhibition ID 555 (year 2025)...")
    scrape_single_exhibition(555, 2025, args.db)

    # Also test image download
    downloader = ImageDownloader(args.db, args.images_dir)
    conn = get_connection(args.db)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM exhibitions WHERE exhibition_id = 555")
    row = cursor.fetchone()
    if row:
        print("\nDownloading images...")
        stats = downloader.download_exhibition_images(row['id'])
        print(f"  Downloaded: {stats['downloaded']}, Failed: {stats['failed']}")
    conn.close()


def cmd_verify(args):
    """Verify downloaded images."""
    downloader = ImageDownloader(args.db, args.images_dir)
    stats = downloader.verify_images()
    print(f"\nImage verification:")
    print(f"  Valid: {stats['valid']}")
    print(f"  Missing: {stats['missing']}")


def main():
    parser = argparse.ArgumentParser(
        description="Kling & Bang Gallery Archive Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--db', default='kob_archive.db', help='Database path')
    parser.add_argument('--images-dir', default='images', help='Images directory')
    parser.add_argument('--delay', type=float, default=1.5, help='Delay between requests')

    subparsers = parser.add_subparsers(dest='command', help='Command to run')

    # Scrape command
    scrape_parser = subparsers.add_parser('scrape', help='Scrape exhibitions')
    scrape_parser.add_argument('--year', type=int, help='Scrape single year')
    scrape_parser.add_argument('--start-year', type=int, default=2003, help='Start year')
    scrape_parser.add_argument('--end-year', type=int, default=2025, help='End year')
    scrape_parser.add_argument('--no-english', action='store_true', help='Skip English versions')

    # Images command
    images_parser = subparsers.add_parser('images', help='Download images')
    images_parser.add_argument('--year', type=int, help='Download for single year')

    # Export command
    export_parser = subparsers.add_parser('export', help='Export to JSON')
    export_parser.add_argument('--output', default='export.json', help='Output file')

    # Stats command
    subparsers.add_parser('stats', help='Show statistics')

    # Test command
    subparsers.add_parser('test', help='Test with single exhibition')

    # Verify command
    subparsers.add_parser('verify', help='Verify downloaded images')

    # Init command
    init_parser = subparsers.add_parser('init', help='Initialize database only')

    args = parser.parse_args()

    if args.command == 'scrape':
        cmd_scrape(args)
    elif args.command == 'images':
        cmd_images(args)
    elif args.command == 'export':
        cmd_export(args)
    elif args.command == 'stats':
        cmd_stats(args)
    elif args.command == 'test':
        cmd_test(args)
    elif args.command == 'verify':
        cmd_verify(args)
    elif args.command == 'init':
        init_database(args.db)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
