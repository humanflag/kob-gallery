# Kling & Bang Gallery Archive Scraper - Development Prompt

## Project Overview
Build a robust web scraper to archive all exhibitions from the Kling & Bang gallery website (http://kob.this.is/klingogbang/) into a structured database. This data will later be used to populate a new modern website.

## Site Structure Analysis

### Main Architecture
- **Base URL**: `http://kob.this.is/klingogbang/`
- **Encoding**: ISO-8859-1 (Icelandic characters - important for proper text extraction)
- **Years Available**: 2003-2025 (22 years of exhibitions)
- **Structure**: PHP-based dynamic site with year-based archive listings

### Key Pages & Patterns

1. **Homepage** (`/`)
   - Shows current exhibition
   - Links to all years in sidebar
   
2. **Year Archive Lists** (`/archive_list.php?year=YYYY`)
   - Lists all exhibitions for a given year
   - Each exhibition has: title, date range, excerpt, "meira" (more) link
   - Link pattern: `archive_view.php?id=XXX`

3. **Exhibition Detail Pages** (`/archive_view.php?id=XXX`)
   - Full exhibition information
   - Artists (multiple, comma-separated)
   - Exhibition title (Icelandic & English)
   - Date range
   - Description text (Icelandic)
   - Exhibition images
   - URL pattern uses sequential IDs (e.g., id=524, id=555)

4. **Additional Pages** (lower priority, but scrape for completeness)
   - `/artist_list.php` - Artist directory
   - `/space.php` - Gallery space info
   - `/text.php` - About Kling & Bang

## Data Model Requirements

### Database Schema

#### Exhibitions Table
```sql
CREATE TABLE exhibitions (
    id INTEGER PRIMARY KEY,
    exhibition_id INTEGER UNIQUE NOT NULL,  -- The ID from archive_view.php?id=XXX
    title_is TEXT NOT NULL,                 -- Icelandic title
    title_en TEXT,                          -- English title (if available)
    start_date DATE,
    end_date DATE,
    description_is TEXT,                    -- Full Icelandic description
    description_en TEXT,                    -- English description (if available)
    excerpt_is TEXT,                        -- Short excerpt from list view
    year INTEGER NOT NULL,
    source_url TEXT NOT NULL,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Artists Table
```sql
CREATE TABLE artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT,  -- For matching variations
    source_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Exhibition_Artists Junction Table
```sql
CREATE TABLE exhibition_artists (
    exhibition_id INTEGER NOT NULL,
    artist_id INTEGER NOT NULL,
    display_order INTEGER,
    PRIMARY KEY (exhibition_id, artist_id),
    FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id),
    FOREIGN KEY (artist_id) REFERENCES artists(id)
);
```

#### Images Table
```sql
CREATE TABLE images (
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
);
```

#### Scraping_Log Table (for monitoring)
```sql
CREATE TABLE scraping_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    status TEXT,  -- 'success', 'failed', 'skipped'
    error_message TEXT,
    response_code INTEGER,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Technical Requirements

### Core Functionality

1. **Crawling Strategy**
   - Start with years 2003-2025
   - For each year, fetch `/archive_list.php?year=YYYY`
   - Extract all exhibition IDs from "meira" links
   - Fetch each exhibition detail page
   - Handle rate limiting (1-2 second delay between requests)
   - Implement retry logic with exponential backoff

2. **Data Extraction**
   - Parse HTML using BeautifulSoup or lxml
   - Handle Icelandic character encoding (ISO-8859-1)
   - Extract structured data from class names:
     - `.arc_view_head` - Artists
     - `.arc_view_name` - Exhibition title
     - `.arc_view_date` - Date range
     - `.arc_view_text` - Description paragraphs
   - Parse date ranges (format: "DD. MM. YYYY - DD. MM. YYYY")
   - Split multi-artist strings on commas

3. **Image Handling**
   - Identify all `<img>` tags in exhibition pages
   - Download images to organized directory structure: `/images/YYYY/exhibition_id/`
   - Preserve original filenames
   - Store both original URL and local path
   - Extract dimensions and generate thumbnails (optional)
   - Handle missing/broken images gracefully

4. **Error Handling & Resilience**
   - Graceful handling of 404s, timeouts, encoding errors
   - Log all errors to scraping_log table
   - Resume capability (check existing records before scraping)
   - Validate data completeness before inserting
   - Handle duplicate entries

5. **Data Quality**
   - Normalize artist names (handle special characters, spacing)
   - Parse dates robustly (handle various formats)
   - Clean HTML entities and extra whitespace
   - Detect and merge duplicate artists
   - Flag incomplete records for manual review

### Technology Stack Recommendations

**Python Stack (Recommended)**
```
- requests or httpx (HTTP client)
- BeautifulSoup4 or lxml (HTML parsing)
- SQLite3 or SQLAlchemy (database)
- Pillow (image processing)
- python-dateutil (date parsing)
- tenacity (retry logic)
- tqdm (progress bars)
```

**Alternative: Node.js Stack**
```
- axios or got (HTTP)
- cheerio (HTML parsing)
- better-sqlite3 or Prisma (database)
- sharp (image processing)
```

## Implementation Phases

### Phase 1: Core Scraper (Priority)
1. Set up database schema
2. Implement year list scraper
3. Extract exhibition IDs from archive lists
4. Scrape exhibition detail pages
5. Parse and store text data
6. Basic error logging

### Phase 2: Image Handling
1. Download exhibition images
2. Organize file structure
3. Generate thumbnails (optional)
4. Update database with local paths

### Phase 3: Data Quality
1. Artist name normalization
2. Duplicate detection and merging
3. Data validation rules
4. Completeness checks

### Phase 4: Monitoring & Maintenance
1. Progress tracking dashboard
2. Error reports
3. Re-scrape capability for updates
4. Export functionality (JSON, CSV)

## Important Considerations

### Icelandic Text Handling
- Characters: á, ð, é, í, ó, ú, ý, þ, æ, ö, Á, Ð, É, Í, Ó, Ú, Ý, Þ, Æ, Ö
- Use proper encoding declaration when reading responses
- Store as UTF-8 in database
- Test with sample data to ensure no mojibake

### URL Patterns to Handle
```
Current exhibition:     /
Year archive:           /archive_list.php?year=2024
Exhibition detail:      /archive_view.php?id=555
Artist list:            /artist_list.php
Gallery info:           /space.php
About page:             /text.php
Language toggle:        ?lang=en or ?lang=is
```

### Ethical Scraping
- Respect robots.txt (if present)
- Implement rate limiting (1-2 sec delay)
- Use descriptive User-Agent header
- Cache responses to avoid re-scraping
- Store timestamp of last scrape

### Data Export Format (for new website)
Provide export functions to JSON with structure:
```json
{
  "exhibitions": [
    {
      "id": 555,
      "title": {"is": "...", "en": "..."},
      "artists": ["Artist 1", "Artist 2"],
      "dates": {"start": "2025-12-06", "end": "2026-02-08"},
      "description": {"is": "...", "en": "..."},
      "images": [
        {"url": "...", "caption": "..."}
      ]
    }
  ]
}
```

## Deliverables

1. **Scraper Script**
   - Well-documented, modular code
   - Configuration file for settings
   - README with setup instructions

2. **Database**
   - SQLite file with complete schema
   - All exhibitions from 2003-2025
   - Normalized artist records
   - Downloaded images

3. **Documentation**
   - Data dictionary
   - API/export documentation
   - Known issues and limitations
   - Statistics summary (total exhibitions, artists, images)

4. **Quality Report**
   - Success rate per year
   - Missing data report
   - Duplicate detection results
   - Error log summary

## Success Criteria

- ✅ All years (2003-2025) successfully scraped
- ✅ >95% of exhibitions have complete data
- ✅ All images downloaded and organized
- ✅ Artist names normalized and deduplicated
- ✅ Database schema matches specification
- ✅ Export functionality working
- ✅ Comprehensive error logging
- ✅ Resume capability tested
- ✅ Code is maintainable and documented

## Testing Checklist

- [ ] Test with single exhibition (e.g., id=555)
- [ ] Test with single year (e.g., 2024)
- [ ] Test encoding with Icelandic characters
- [ ] Test image download and organization
- [ ] Test date parsing edge cases
- [ ] Test artist name splitting and normalization
- [ ] Test resume after interruption
- [ ] Test error handling (404s, timeouts)
- [ ] Validate database integrity
- [ ] Export sample JSON and verify structure

## Notes

- The site appears to be old PHP (early 2000s style) but stable
- Sequential ID pattern (archive_view.php?id=XXX) suggests easy enumeration
- Some exhibitions may have both Icelandic and English content
- Watch for special opening hours/closure notices in descriptions
- Some exhibitions are group shows with many artists
- Image paths use relative URLs, need to construct full URLs

## Questions for Clarification

1. Should we scrape artist bio pages if available?
2. Do you want to preserve HTML formatting in descriptions?
3. Should we scrape English translations if available (lang=en)?
4. What image sizes/thumbnails needed for new site?
5. Any specific exhibitions or years to prioritize?
6. Should we scrape the "space" and "about" pages?
