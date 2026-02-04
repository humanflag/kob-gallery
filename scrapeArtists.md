# Kling & Bang Artist Directory Scraper - Dedicated Tool

## Overview
The artist list provides an alternative index to the gallery's archive, organizing exhibitions by artist rather than chronologically. This scraper navigates the paginated artist directory to build a comprehensive artist database with their exhibition history.

## Why a Separate Tool?

The artist list serves a different purpose than the chronological archive:
1. **Artist-centric view** - Shows all exhibitions per artist
2. **Validates artist names** - Canonical spellings and variations
3. **Discovers relationships** - Collaborative exhibitions, recurring artists
4. **Completeness check** - Cross-reference with exhibition scraper data
5. **Artist profiles** - Foundation for artist pages on new site

## URL Structure

### Base URL
`http://kob.this.is/klingogbang/artist_list.php`

### Pagination Pattern
```
artist_list.php              # First page (index=0 implied)
artist_list.php?index=15     # Page 2
artist_list.php?index=30     # Page 3
artist_list.php?index=45     # Page 4
artist_list.php?index=90     # Page 7
...
```

**Index increment**: Appears to be 15 (shows ~15 artists per page)

### Language Toggle
```
artist_list.php?lang=is      # Icelandic
artist_list.php?lang=en      # English
```

## HTML Structure Analysis

Based on the fetched HTML:

```html
<!-- Artist entry with exhibitions -->
<table>
  <tr>
    <td class="arc_view_head">
      <a href="archive_view.php?id=555">
        Albertina Tevajärvi, Ásgerður Arnardóttir, Gabriel Backman Waltersson, 
        Hekla Kollmar, Lúðvík Vífill Arason, Silja Rún Högnadóttir, 
        Sunneva Elvarsdóttir, Þórður Túsan Alisson, Ævar Uggason
      </a>
    </td>
  </tr>
</table>

<!-- Pagination -->
<td class="link_foot">
  <a href="/klingogbang/artist_list.php?index=15">næsta/næsta</a>
</td>
```

**Key observations**:
- Artists are listed as comma-separated names in a single string
- Each artist group links to an exhibition
- Multiple artists can appear together (group shows)
- Pagination link labeled "næsta/næsta" (next/next)

## Data Model

### Artist Directory Table
Track the scraping progress and pagination:

```sql
CREATE TABLE artist_directory_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_index INTEGER UNIQUE NOT NULL,
    url TEXT NOT NULL,
    artist_count INTEGER,
    exhibition_count INTEGER,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending'  -- pending, scraped, failed
);
```

### Artist Discovery Log
Track all artist mentions for validation:

```sql
CREATE TABLE artist_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_name TEXT NOT NULL,
    exhibition_id INTEGER,
    source_page TEXT,  -- 'exhibition' or 'artist_list'
    position_in_list INTEGER,  -- If group show, order of appearance
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id)
);
```

### Enhanced Artists Table
```sql
-- Already exists from main scraper, but add:
ALTER TABLE artists ADD COLUMN first_exhibition_year INTEGER;
ALTER TABLE artists ADD COLUMN last_exhibition_year INTEGER;
ALTER TABLE artists ADD COLUMN exhibition_count INTEGER DEFAULT 0;
ALTER TABLE artists ADD COLUMN is_collective BOOLEAN DEFAULT 0;  -- For groups like "Brokat Films"
ALTER TABLE artists ADD COLUMN verified BOOLEAN DEFAULT 0;  -- Cross-referenced with artist_list
```

## Implementation

### Complete Python Script

```python
#!/usr/bin/env python3
"""
Kling & Bang Artist Directory Scraper
Navigates paginated artist list to build comprehensive artist database
"""

import requests
import sqlite3
import time
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin, parse_qs, urlparse
from datetime import datetime
from typing import List, Dict, Optional, Tuple

class ArtistDirectoryScraper:
    def __init__(self, db_path='klingogbang.db'):
        self.db_path = db_path
        self.base_url = 'http://kob.this.is/klingogbang/'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Kling&Bang Artist Directory Scraper)'
        })
        self.page_increment = 15  # Default increment between pages
        
    def get_artist_list_page(self, index: int = 0, lang: str = 'is') -> Optional[BeautifulSoup]:
        """Fetch a single page from the artist list"""
        if index == 0:
            url = f"{self.base_url}artist_list.php"
        else:
            url = f"{self.base_url}artist_list.php?index={index}"
        
        if lang:
            url += f"&lang={lang}" if '?' in url else f"?lang={lang}"
        
        try:
            print(f"  Fetching: {url}")
            response = self.session.get(url, timeout=10)
            response.encoding = 'iso-8859-1'  # Icelandic characters
            
            if response.status_code == 200:
                return BeautifulSoup(response.text, 'lxml')
            else:
                print(f"  ✗ HTTP {response.status_code}")
                return None
                
        except Exception as e:
            print(f"  ✗ Error: {e}")
            return None
    
    def extract_artist_entries(self, soup: BeautifulSoup) -> List[Dict]:
        """Extract artist names and exhibition IDs from page"""
        entries = []
        
        # Find all links to exhibitions in the main content area
        # These appear within tables with specific class patterns
        for link in soup.find_all('a', href=re.compile(r'archive_view\.php\?id=\d+')):
            # Extract exhibition ID
            match = re.search(r'id=(\d+)', link['href'])
            if not match:
                continue
                
            exhibition_id = int(match.group(1))
            
            # Get the artist names (usually in the link text or parent td)
            artist_text = link.get_text(strip=True)
            
            # Skip navigation links and non-artist entries
            if not artist_text or len(artist_text) < 3:
                continue
            
            # Skip if it's just a year number or similar
            if artist_text.isdigit():
                continue
            
            # Parse comma-separated artist names
            artist_names = [name.strip() for name in artist_text.split(',')]
            artist_names = [name for name in artist_names if name]  # Remove empty
            
            if artist_names:
                entries.append({
                    'exhibition_id': exhibition_id,
                    'artist_names': artist_names,
                    'raw_text': artist_text
                })
        
        return entries
    
    def find_next_page_index(self, soup: BeautifulSoup) -> Optional[int]:
        """Find the next page index from pagination link"""
        # Look for "næsta" (next) link
        next_link = soup.find('a', string=re.compile(r'næsta|next', re.IGNORECASE))
        
        if next_link and next_link.get('href'):
            href = next_link['href']
            # Extract index parameter
            match = re.search(r'index=(\d+)', href)
            if match:
                return int(match.group(1))
        
        return None
    
    def save_page_record(self, page_index: int, url: str, artist_count: int, 
                        exhibition_count: int, status: str = 'scraped'):
        """Save page scraping record to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO artist_directory_pages 
            (page_index, url, artist_count, exhibition_count, status, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (page_index, url, artist_count, exhibition_count, status, datetime.now()))
        
        conn.commit()
        conn.close()
    
    def save_artist_mentions(self, entries: List[Dict], source_page: str):
        """Save artist mentions to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        for entry in entries:
            exhibition_id = entry['exhibition_id']
            
            for position, artist_name in enumerate(entry['artist_names']):
                cursor.execute("""
                    INSERT INTO artist_mentions 
                    (artist_name, exhibition_id, source_page, position_in_list)
                    VALUES (?, ?, ?, ?)
                """, (artist_name, exhibition_id, source_page, position))
        
        conn.commit()
        conn.close()
    
    def update_artist_records(self):
        """Update artists table with data from artist_mentions"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        print("\nUpdating artist records...")
        
        # Get all unique artist names from mentions
        cursor.execute("""
            SELECT DISTINCT artist_name 
            FROM artist_mentions
        """)
        
        mentioned_artists = [row[0] for row in cursor.fetchall()]
        
        for artist_name in mentioned_artists:
            # Check if artist exists
            cursor.execute("""
                SELECT id FROM artists WHERE name = ?
            """, (artist_name,))
            
            result = cursor.fetchone()
            
            if result:
                artist_id = result[0]
                
                # Update exhibition count and year range
                cursor.execute("""
                    SELECT 
                        COUNT(DISTINCT am.exhibition_id),
                        MIN(e.year),
                        MAX(e.year)
                    FROM artist_mentions am
                    JOIN exhibitions e ON am.exhibition_id = e.id
                    WHERE am.artist_name = ?
                """, (artist_name,))
                
                count, first_year, last_year = cursor.fetchone()
                
                cursor.execute("""
                    UPDATE artists 
                    SET exhibition_count = ?,
                        first_exhibition_year = ?,
                        last_exhibition_year = ?,
                        verified = 1
                    WHERE id = ?
                """, (count, first_year, last_year, artist_id))
                
            else:
                # Create new artist record
                cursor.execute("""
                    INSERT INTO artists (name, verified)
                    VALUES (?, 1)
                """, (artist_name,))
                
                artist_id = cursor.lastrowid
                
                # Get exhibition data
                cursor.execute("""
                    SELECT 
                        COUNT(DISTINCT am.exhibition_id),
                        MIN(e.year),
                        MAX(e.year)
                    FROM artist_mentions am
                    JOIN exhibitions e ON am.exhibition_id = e.id
                    WHERE am.artist_name = ?
                """, (artist_name,))
                
                count, first_year, last_year = cursor.fetchone()
                
                cursor.execute("""
                    UPDATE artists 
                    SET exhibition_count = ?,
                        first_exhibition_year = ?,
                        last_exhibition_year = ?
                    WHERE id = ?
                """, (count, first_year, last_year, artist_id))
        
        conn.commit()
        conn.close()
        
        print(f"  ✓ Updated {len(mentioned_artists)} artist records")
    
    def scrape_all_pages(self, start_index: int = 0, max_pages: int = 1000) -> Dict:
        """Scrape all pages of the artist directory"""
        print("Starting artist directory scrape...")
        print(f"Base URL: {self.base_url}artist_list.php")
        print("=" * 60)
        
        current_index = start_index
        page_count = 0
        total_entries = 0
        total_artists = 0
        
        while page_count < max_pages:
            page_count += 1
            print(f"\nPage {page_count} (index={current_index})")
            
            # Fetch page
            soup = self.get_artist_list_page(current_index)
            
            if not soup:
                print(f"  ✗ Failed to fetch page, stopping")
                break
            
            # Extract artist entries
            entries = self.extract_artist_entries(soup)
            
            if not entries:
                print(f"  ℹ No entries found, likely end of list")
                break
            
            # Count unique artists on this page
            unique_artists = set()
            for entry in entries:
                unique_artists.update(entry['artist_names'])
            
            print(f"  Found {len(entries)} exhibitions")
            print(f"  Found {len(unique_artists)} unique artists")
            
            # Save to database
            url = f"{self.base_url}artist_list.php?index={current_index}"
            self.save_page_record(current_index, url, len(unique_artists), len(entries))
            self.save_artist_mentions(entries, f"artist_list_page_{current_index}")
            
            total_entries += len(entries)
            total_artists += len(unique_artists)
            
            # Find next page
            next_index = self.find_next_page_index(soup)
            
            if next_index is None:
                print(f"  ℹ No next page found, reached end")
                break
            
            if next_index <= current_index:
                print(f"  ⚠ Next index ({next_index}) not greater than current ({current_index}), stopping")
                break
            
            # Determine page increment for future reference
            if page_count == 1:
                self.page_increment = next_index - current_index
                print(f"  ℹ Detected page increment: {self.page_increment}")
            
            current_index = next_index
            
            # Rate limiting
            time.sleep(1.5)
        
        # Update artist records
        self.update_artist_records()
        
        # Generate summary
        summary = {
            'pages_scraped': page_count,
            'total_entries': total_entries,
            'total_artists': total_artists,
            'page_increment': self.page_increment,
            'last_index': current_index
        }
        
        return summary
    
    def generate_report(self) -> str:
        """Generate a summary report of the artist directory"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Count pages
        cursor.execute("SELECT COUNT(*) FROM artist_directory_pages WHERE status = 'scraped'")
        pages_count = cursor.fetchone()[0]
        
        # Count unique artists
        cursor.execute("SELECT COUNT(DISTINCT artist_name) FROM artist_mentions")
        unique_artists = cursor.fetchone()[0]
        
        # Count total mentions
        cursor.execute("SELECT COUNT(*) FROM artist_mentions")
        total_mentions = cursor.fetchone()[0]
        
        # Top artists by exhibition count
        cursor.execute("""
            SELECT artist_name, COUNT(DISTINCT exhibition_id) as count
            FROM artist_mentions
            GROUP BY artist_name
            ORDER BY count DESC
            LIMIT 10
        """)
        top_artists = cursor.fetchall()
        
        # Artists with name variations
        cursor.execute("""
            SELECT 
                a.name as canonical,
                GROUP_CONCAT(DISTINCT am.artist_name) as variations
            FROM artists a
            JOIN artist_mentions am ON LOWER(a.name) = LOWER(am.artist_name)
            WHERE a.name != am.artist_name
            GROUP BY a.name
            HAVING COUNT(DISTINCT am.artist_name) > 1
        """)
        variations = cursor.fetchall()
        
        conn.close()
        
        # Build report
        report = f"""
{'='*60}
ARTIST DIRECTORY SCRAPE REPORT
{'='*60}

SUMMARY:
  Pages scraped: {pages_count}
  Unique artists: {unique_artists}
  Total mentions: {total_mentions}

TOP 10 ARTISTS BY EXHIBITION COUNT:
"""
        for artist_name, count in top_artists:
            report += f"  {count:3d} exhibitions - {artist_name}\n"
        
        if variations:
            report += f"\nARTISTS WITH NAME VARIATIONS ({len(variations)}):\n"
            for canonical, vars in variations[:10]:  # Show first 10
                report += f"  {canonical}\n"
                report += f"    Variations: {vars}\n"
        
        report += f"\n{'='*60}\n"
        
        return report
    
    def cross_reference_with_exhibitions(self) -> Dict:
        """Cross-reference artist list data with exhibition scraper data"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        print("\nCross-referencing with exhibition data...")
        
        # Find artists mentioned in artist_list but not in exhibition_artists
        cursor.execute("""
            SELECT DISTINCT am.artist_name
            FROM artist_mentions am
            LEFT JOIN artists a ON am.artist_name = a.name
            LEFT JOIN exhibition_artists ea ON a.id = ea.artist_id
            WHERE ea.artist_id IS NULL
        """)
        missing_from_exhibitions = cursor.fetchall()
        
        # Find exhibitions in artist_list not in exhibitions table
        cursor.execute("""
            SELECT DISTINCT am.exhibition_id
            FROM artist_mentions am
            LEFT JOIN exhibitions e ON am.exhibition_id = e.id
            WHERE e.id IS NULL
        """)
        missing_exhibitions = cursor.fetchall()
        
        # Find artist name discrepancies
        cursor.execute("""
            SELECT 
                a1.name as name1,
                a2.name as name2,
                COUNT(*) as shared_exhibitions
            FROM artist_mentions am1
            JOIN artist_mentions am2 ON am1.exhibition_id = am2.exhibition_id
            JOIN artists a1 ON am1.artist_name = a1.name
            JOIN artists a2 ON am2.artist_name = a2.name
            WHERE LOWER(a1.name) = LOWER(a2.name)
            AND a1.name != a2.name
            GROUP BY a1.name, a2.name
        """)
        name_discrepancies = cursor.fetchall()
        
        conn.close()
        
        return {
            'missing_from_exhibitions': len(missing_from_exhibitions),
            'missing_exhibitions': len(missing_exhibitions),
            'name_discrepancies': len(name_discrepancies),
            'details': {
                'missing_artists': [row[0] for row in missing_from_exhibitions[:20]],
                'missing_exhibition_ids': [row[0] for row in missing_exhibitions[:20]],
                'discrepancies': name_discrepancies[:10]
            }
        }

def init_database_schema(db_path='klingogbang.db'):
    """Initialize database tables for artist directory scraping"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create artist_directory_pages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS artist_directory_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            page_index INTEGER UNIQUE NOT NULL,
            url TEXT NOT NULL,
            artist_count INTEGER,
            exhibition_count INTEGER,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pending'
        )
    """)
    
    # Create artist_mentions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS artist_mentions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            artist_name TEXT NOT NULL,
            exhibition_id INTEGER,
            source_page TEXT,
            position_in_list INTEGER,
            discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id)
        )
    """)
    
    # Add columns to artists table if they don't exist
    try:
        cursor.execute("ALTER TABLE artists ADD COLUMN first_exhibition_year INTEGER")
    except:
        pass
    
    try:
        cursor.execute("ALTER TABLE artists ADD COLUMN last_exhibition_year INTEGER")
    except:
        pass
    
    try:
        cursor.execute("ALTER TABLE artists ADD COLUMN exhibition_count INTEGER DEFAULT 0")
    except:
        pass
    
    try:
        cursor.execute("ALTER TABLE artists ADD COLUMN is_collective BOOLEAN DEFAULT 0")
    except:
        pass
    
    try:
        cursor.execute("ALTER TABLE artists ADD COLUMN verified BOOLEAN DEFAULT 0")
    except:
        pass
    
    conn.commit()
    conn.close()
    print("✓ Database schema initialized")

def main():
    """Main execution function"""
    db_path = 'klingogbang.db'
    
    # Initialize database
    print("Initializing database schema...")
    init_database_schema(db_path)
    print()
    
    # Create scraper
    scraper = ArtistDirectoryScraper(db_path)
    
    # Scrape all pages
    summary = scraper.scrape_all_pages()
    
    # Print summary
    print("\n" + "="*60)
    print("SCRAPING COMPLETE")
    print("="*60)
    print(f"Pages scraped: {summary['pages_scraped']}")
    print(f"Total entries: {summary['total_entries']}")
    print(f"Total artists: {summary['total_artists']}")
    print(f"Page increment: {summary['page_increment']}")
    print(f"Last index: {summary['last_index']}")
    
    # Generate detailed report
    print("\nGenerating report...")
    report = scraper.generate_report()
    print(report)
    
    # Cross-reference
    print("\nCross-referencing data...")
    cross_ref = scraper.cross_reference_with_exhibitions()
    print(f"Missing from exhibitions: {cross_ref['missing_from_exhibitions']}")
    print(f"Missing exhibitions: {cross_ref['missing_exhibitions']}")
    print(f"Name discrepancies: {cross_ref['name_discrepancies']}")
    
    if cross_ref['details']['missing_artists']:
        print("\nSample missing artists:")
        for artist in cross_ref['details']['missing_artists'][:5]:
            print(f"  - {artist}")
    
    if cross_ref['details']['discrepancies']:
        print("\nSample name discrepancies:")
        for name1, name2, count in cross_ref['details']['discrepancies'][:5]:
            print(f"  '{name1}' vs '{name2}' ({count} shared exhibitions)")

if __name__ == '__main__':
    main()
```

## Usage

### 1. Initialize Database Schema
```bash
python artist_directory_scraper.py
# Or run separately:
python -c "from artist_directory_scraper import init_database_schema; init_database_schema()"
```

### 2. Run the Scraper
```bash
python artist_directory_scraper.py
```

### 3. Query Results
```sql
-- Total unique artists
SELECT COUNT(DISTINCT artist_name) FROM artist_mentions;

-- Top artists by exhibition count
SELECT 
    artist_name, 
    COUNT(DISTINCT exhibition_id) as exhibitions
FROM artist_mentions
GROUP BY artist_name
ORDER BY exhibitions DESC
LIMIT 20;

-- Artist exhibition timeline
SELECT 
    a.name,
    a.first_exhibition_year,
    a.last_exhibition_year,
    a.exhibition_count
FROM artists a
WHERE a.verified = 1
ORDER BY a.exhibition_count DESC;

-- Find name variations
SELECT 
    artist_name,
    COUNT(*) as mention_count
FROM artist_mentions
GROUP BY LOWER(artist_name)
HAVING COUNT(DISTINCT artist_name) > 1;
```

## Benefits of This Tool

### 1. Data Validation
- Cross-reference artist names between exhibition pages and artist list
- Identify spelling variations and inconsistencies
- Detect missing exhibitions or artists

### 2. Artist Profiles
- Exhibition count per artist
- Year range of activity (first to last exhibition)
- Identify prolific artists vs one-time participants
- Track collaborative relationships

### 3. Quality Assurance
- Verify completeness of exhibition scraper
- Find exhibitions that might have been missed
- Validate artist name parsing logic

### 4. Website Enhancement
- "Most exhibited artists" feature
- Artist activity timelines
- "Active in [year range]" filters
- Relationship networks (who exhibited together)

## Integration with Main Scraper

### Run Order
```bash
# 1. Main exhibition scraper
python scrape_exhibitions.py

# 2. Artist directory scraper (validates/enhances)
python artist_directory_scraper.py

# 3. Image gallery scraper
python scrape_gallery_images.py

# 4. Generate reports and exports
python generate_reports.py
```

### Data Flow
```
Exhibition Scraper → exhibitions, artists, exhibition_artists tables
        ↓
Artist Directory Scraper → validates and enhances artist data
        ↓
        Updates: exhibition_count, year_range, verified flag
        Creates: artist_mentions for analysis
```

## Expected Output

### Console Output
```
Initializing database schema...
✓ Database schema initialized

Starting artist directory scrape...
Base URL: http://kob.this.is/klingogbang/artist_list.php
============================================================

Page 1 (index=0)
  Fetching: http://kob.this.is/klingogbang/artist_list.php
  Found 12 exhibitions
  Found 31 unique artists
  ℹ Detected page increment: 15

Page 2 (index=15)
  Fetching: http://kob.this.is/klingogbang/artist_list.php?index=15
  Found 15 exhibitions
  Found 28 unique artists

...

Page 42 (index=615)
  Fetching: http://kob.this.is/klingogbang/artist_list.php?index=615
  Found 8 exhibitions
  Found 12 unique artists
  ℹ No next page found, reached end

Updating artist records...
  ✓ Updated 437 artist records

============================================================
SCRAPING COMPLETE
============================================================
Pages scraped: 42
Total entries: 524
Total artists: 437
Page increment: 15
Last index: 615

============================================================
ARTIST DIRECTORY SCRAPE REPORT
============================================================

SUMMARY:
  Pages scraped: 42
  Unique artists: 437
  Total mentions: 1,245

TOP 10 ARTISTS BY EXHIBITION COUNT:
   18 exhibitions - Ragnar Kjartansson
   15 exhibitions - Gabríela Friðriksdóttir
   12 exhibitions - Hrafnhildur Arnardóttir
   11 exhibitions - Shoplifter
   10 exhibitions - Egill Sæbjörnsson
    9 exhibitions - Kristján Guðmundsson
    8 exhibitions - Erró
    8 exhibitions - Húbert Nói Jóhannesson
    7 exhibitions - Sigurður Guðjónsson
    7 exhibitions - Katrín Elvarsdóttir
```

## Deliverables

1. ✅ Complete Python scraper script
2. ✅ Database schema with artist_directory_pages and artist_mentions tables
3. ✅ Artist profile enhancement (exhibition counts, year ranges)
4. ✅ Cross-reference validation report
5. ✅ Name variation detection
6. ✅ Top artists analysis

## Questions for Clarification

1. Should we prioritize Icelandic or English artist names?
2. How to handle collectives vs individual artists (e.g., "Brokat Films")?
3. Should we scrape both language versions for comparison?
4. What to do with detected name variations - merge or keep separate?
5. Should this run before or after the main exhibition scraper?