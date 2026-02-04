"""Database module for Kling & Bang gallery archive scraper."""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional


def get_connection(db_path: str = "kob_archive.db") -> sqlite3.Connection:
    """Create database connection with row factory."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_database(db_path: str = "kob_archive.db") -> None:
    """Initialize database with all required tables."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    # Exhibitions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exhibitions (
            id INTEGER PRIMARY KEY,
            exhibition_id INTEGER UNIQUE NOT NULL,
            title_is TEXT NOT NULL,
            title_en TEXT,
            start_date DATE,
            end_date DATE,
            description_is TEXT,
            description_en TEXT,
            excerpt_is TEXT,
            year INTEGER NOT NULL,
            source_url TEXT NOT NULL,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Artists table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            normalized_name TEXT,
            source_url TEXT,
            bio TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Exhibition_Artists junction table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exhibition_artists (
            exhibition_id INTEGER NOT NULL,
            artist_id INTEGER NOT NULL,
            display_order INTEGER,
            PRIMARY KEY (exhibition_id, artist_id),
            FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id),
            FOREIGN KEY (artist_id) REFERENCES artists(id)
        )
    """)

    # Images table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exhibition_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_url TEXT NOT NULL,
            local_path TEXT,
            alt_text TEXT,
            caption TEXT,
            width INTEGER,
            height INTEGER,
            file_size INTEGER,
            mime_type TEXT,
            display_order INTEGER,
            downloaded_at TIMESTAMP,
            FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id)
        )
    """)

    # Scraping log table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scraping_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            status TEXT,
            error_message TEXT,
            response_code INTEGER,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes for common queries
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_exhibitions_year ON exhibitions(year)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_exhibitions_exhibition_id ON exhibitions(exhibition_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_artists_normalized ON artists(normalized_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_images_exhibition ON images(exhibition_id)")

    conn.commit()
    conn.close()
    print(f"Database initialized: {db_path}")


def exhibition_exists(conn: sqlite3.Connection, exhibition_id: int) -> bool:
    """Check if an exhibition already exists in the database."""
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM exhibitions WHERE exhibition_id = ?", (exhibition_id,))
    return cursor.fetchone() is not None


def insert_exhibition(conn: sqlite3.Connection, data: dict) -> int:
    """Insert an exhibition record and return its database ID."""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO exhibitions (
            exhibition_id, title_is, title_en, start_date, end_date,
            description_is, description_en, excerpt_is, year, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data['exhibition_id'],
        data['title_is'],
        data.get('title_en'),
        data.get('start_date'),
        data.get('end_date'),
        data.get('description_is'),
        data.get('description_en'),
        data.get('excerpt_is'),
        data['year'],
        data['source_url']
    ))
    conn.commit()
    return cursor.lastrowid


def get_or_create_artist(conn: sqlite3.Connection, name: str) -> int:
    """Get artist ID or create new artist record."""
    cursor = conn.cursor()
    normalized = normalize_artist_name(name)

    # Try to find by normalized name
    cursor.execute("SELECT id FROM artists WHERE normalized_name = ?", (normalized,))
    row = cursor.fetchone()
    if row:
        return row['id']

    # Create new artist
    cursor.execute(
        "INSERT INTO artists (name, normalized_name) VALUES (?, ?)",
        (name.strip(), normalized)
    )
    conn.commit()
    return cursor.lastrowid


def normalize_artist_name(name: str) -> str:
    """Normalize artist name for matching."""
    # Lowercase, strip whitespace, normalize unicode
    import unicodedata
    name = name.strip().lower()
    name = unicodedata.normalize('NFKC', name)
    # Remove extra whitespace
    name = ' '.join(name.split())
    return name


def link_artist_to_exhibition(
    conn: sqlite3.Connection,
    exhibition_db_id: int,
    artist_id: int,
    display_order: int
) -> None:
    """Create link between exhibition and artist."""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR IGNORE INTO exhibition_artists (exhibition_id, artist_id, display_order)
        VALUES (?, ?, ?)
    """, (exhibition_db_id, artist_id, display_order))
    conn.commit()


def insert_image(conn: sqlite3.Connection, data: dict) -> int:
    """Insert an image record."""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO images (
            exhibition_id, filename, original_url, local_path, alt_text,
            caption, width, height, file_size, mime_type, display_order, downloaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data['exhibition_id'],
        data['filename'],
        data['original_url'],
        data.get('local_path'),
        data.get('alt_text'),
        data.get('caption'),
        data.get('width'),
        data.get('height'),
        data.get('file_size'),
        data.get('mime_type'),
        data.get('display_order', 0),
        data.get('downloaded_at')
    ))
    conn.commit()
    return cursor.lastrowid


def log_scrape(
    conn: sqlite3.Connection,
    url: str,
    status: str,
    error_message: Optional[str] = None,
    response_code: Optional[int] = None
) -> None:
    """Log a scraping attempt."""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO scraping_log (url, status, error_message, response_code)
        VALUES (?, ?, ?, ?)
    """, (url, status, error_message, response_code))
    conn.commit()


def get_statistics(conn: sqlite3.Connection) -> dict:
    """Get database statistics."""
    cursor = conn.cursor()
    stats = {}

    cursor.execute("SELECT COUNT(*) FROM exhibitions")
    stats['total_exhibitions'] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM artists")
    stats['total_artists'] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM images")
    stats['total_images'] = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM images WHERE local_path IS NOT NULL")
    stats['downloaded_images'] = cursor.fetchone()[0]

    cursor.execute("SELECT year, COUNT(*) as count FROM exhibitions GROUP BY year ORDER BY year")
    stats['exhibitions_by_year'] = {row['year']: row['count'] for row in cursor.fetchall()}

    cursor.execute("SELECT COUNT(*) FROM scraping_log WHERE status = 'failed'")
    stats['failed_scrapes'] = cursor.fetchone()[0]

    return stats


def export_to_json(conn: sqlite3.Connection, output_path: str = "export.json") -> None:
    """Export all data to JSON format for new website."""
    import json

    cursor = conn.cursor()

    # Get all exhibitions with their artists
    cursor.execute("""
        SELECT e.*, GROUP_CONCAT(a.name, '|||') as artist_names
        FROM exhibitions e
        LEFT JOIN exhibition_artists ea ON e.id = ea.exhibition_id
        LEFT JOIN artists a ON ea.artist_id = a.id
        GROUP BY e.id
        ORDER BY e.year DESC, e.start_date DESC
    """)

    exhibitions = []
    for row in cursor.fetchall():
        # Get images for this exhibition
        cursor.execute("""
            SELECT * FROM images WHERE exhibition_id = ? ORDER BY display_order
        """, (row['id'],))
        images = [
            {
                'url': img['original_url'],
                'local_path': img['local_path'],
                'caption': img['caption'],
                'alt_text': img['alt_text']
            }
            for img in cursor.fetchall()
        ]

        artists = row['artist_names'].split('|||') if row['artist_names'] else []

        exhibitions.append({
            'id': row['exhibition_id'],
            'title': {
                'is': row['title_is'],
                'en': row['title_en']
            },
            'artists': artists,
            'dates': {
                'start': row['start_date'],
                'end': row['end_date']
            },
            'description': {
                'is': row['description_is'],
                'en': row['description_en']
            },
            'year': row['year'],
            'images': images
        })

    output = {'exhibitions': exhibitions}

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Exported {len(exhibitions)} exhibitions to {output_path}")


if __name__ == "__main__":
    init_database()
