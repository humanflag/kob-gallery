import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'kob_archive.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath, { readonly: true });
  }
  return db;
}

export interface Exhibition {
  id: number;
  exhibition_id: number;
  title_is: string;
  title_en: string | null;
  start_date: string | null;
  end_date: string | null;
  description_is: string | null;
  description_en: string | null;
  excerpt_is: string | null;
  year: number;
  source_url: string;
}

export interface Artist {
  id: number;
  name: string;
  normalized_name: string | null;
}

export interface ExhibitionImage {
  id: number;
  exhibition_id: number;
  filename: string;
  original_url: string;
  local_path: string | null;
  alt_text: string | null;
}

export interface ExhibitionWithDetails extends Exhibition {
  artists: Artist[];
  images: ExhibitionImage[];
}

export function getAllExhibitions(): Exhibition[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM exhibitions
    ORDER BY year DESC, start_date DESC
  `).all() as Exhibition[];
}

export function getExhibitionsByYear(year: number): Exhibition[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM exhibitions
    WHERE year = ?
    ORDER BY start_date DESC
  `).all(year) as Exhibition[];
}

export function getExhibitionById(exhibitionId: number): ExhibitionWithDetails | null {
  const db = getDb();

  const exhibition = db.prepare(`
    SELECT * FROM exhibitions WHERE exhibition_id = ?
  `).get(exhibitionId) as Exhibition | undefined;

  if (!exhibition) return null;

  const artists = db.prepare(`
    SELECT a.* FROM artists a
    JOIN exhibition_artists ea ON a.id = ea.artist_id
    WHERE ea.exhibition_id = ?
    ORDER BY ea.display_order
  `).all(exhibition.id) as Artist[];

  const images = db.prepare(`
    SELECT * FROM images WHERE exhibition_id = ?
    ORDER BY display_order
  `).all(exhibition.id) as ExhibitionImage[];

  return { ...exhibition, artists, images };
}

export function getExhibitionsWithArtists(): (Exhibition & { artist_names: string })[] {
  const db = getDb();
  return db.prepare(`
    SELECT e.*, GROUP_CONCAT(a.name, ', ') as artist_names
    FROM exhibitions e
    LEFT JOIN exhibition_artists ea ON e.id = ea.exhibition_id
    LEFT JOIN artists a ON ea.artist_id = a.id
    GROUP BY e.id
    ORDER BY e.year DESC, e.start_date DESC
  `).all() as (Exhibition & { artist_names: string })[];
}

export function getAllArtists(): (Artist & { exhibition_count: number })[] {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, COUNT(ea.exhibition_id) as exhibition_count
    FROM artists a
    LEFT JOIN exhibition_artists ea ON a.id = ea.artist_id
    GROUP BY a.id
    ORDER BY a.name COLLATE NOCASE
  `).all() as (Artist & { exhibition_count: number })[];
}

export function getArtistBySlug(slug: string): Artist | null {
  const db = getDb();
  // Convert slug back to possible name matches
  const searchName = slug.replace(/-/g, ' ');
  return db.prepare(`
    SELECT * FROM artists
    WHERE LOWER(REPLACE(name, ' ', '-')) = LOWER(?)
    OR LOWER(normalized_name) = LOWER(?)
  `).get(slug, searchName) as Artist | null;
}

export function getExhibitionsByArtist(artistId: number): Exhibition[] {
  const db = getDb();
  return db.prepare(`
    SELECT e.* FROM exhibitions e
    JOIN exhibition_artists ea ON e.id = ea.exhibition_id
    WHERE ea.artist_id = ?
    ORDER BY e.year DESC, e.start_date DESC
  `).all(artistId) as Exhibition[];
}

export function getYears(): number[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT year FROM exhibitions ORDER BY year DESC
  `).all() as { year: number }[];
  return rows.map(r => r.year);
}

export function getStats() {
  const db = getDb();
  const exhibitions = db.prepare('SELECT COUNT(*) as count FROM exhibitions').get() as { count: number };
  const artists = db.prepare('SELECT COUNT(*) as count FROM artists').get() as { count: number };
  const images = db.prepare('SELECT COUNT(*) as count FROM images').get() as { count: number };
  const years = getYears();

  return {
    totalExhibitions: exhibitions.count,
    totalArtists: artists.count,
    totalImages: images.count,
    yearRange: years.length > 0 ? `${years[years.length - 1]}-${years[0]}` : 'N/A',
  };
}

export function getCurrentExhibition(): ExhibitionWithDetails | null {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const exhibition = db.prepare(`
    SELECT * FROM exhibitions
    WHERE (end_date >= ? OR end_date IS NULL)
    ORDER BY start_date DESC
    LIMIT 1
  `).get(today) as Exhibition | undefined;

  if (!exhibition) {
    // Get most recent if no current
    const recent = db.prepare(`
      SELECT * FROM exhibitions ORDER BY year DESC, start_date DESC LIMIT 1
    `).get() as Exhibition | undefined;
    if (!recent) return null;
    return getExhibitionById(recent.exhibition_id);
  }

  return getExhibitionById(exhibition.exhibition_id);
}
