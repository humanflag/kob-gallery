"""Web scraper for Kling & Bang gallery archive."""

import re
import time
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from database import (
    get_connection,
    exhibition_exists,
    insert_exhibition,
    get_or_create_artist,
    link_artist_to_exhibition,
    insert_image,
    log_scrape,
)

BASE_URL = "http://kob.this.is/klingogbang/"
HEADERS = {
    "User-Agent": "KlingBangArchiveScraper/1.0 (Historical archive project)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "is,en;q=0.5",
}
REQUEST_DELAY = 1.5  # seconds between requests


class KoBScraper:
    """Scraper for Kling & Bang gallery website."""

    def __init__(self, db_path: str = "kob_archive.db", delay: float = REQUEST_DELAY):
        self.db_path = db_path
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    def _fetch(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch a URL and return parsed BeautifulSoup object."""
        conn = get_connection(self.db_path)
        try:
            time.sleep(self.delay)
            response = self.session.get(url, timeout=30)
            response.raise_for_status()

            # Handle ISO-8859-1 encoding for Icelandic characters
            response.encoding = 'iso-8859-1'
            content = response.text

            log_scrape(conn, url, 'success', response_code=response.status_code)
            return BeautifulSoup(content, 'html.parser')

        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            status_code = getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            log_scrape(conn, url, 'failed', error_msg, status_code)
            print(f"Error fetching {url}: {error_msg}")
            return None
        finally:
            conn.close()

    def get_exhibition_ids_for_year(self, year: int) -> list[int]:
        """Get all exhibition IDs from a year's archive list."""
        url = f"{BASE_URL}archive_list.php?year={year}"
        soup = self._fetch(url)
        if not soup:
            return []

        exhibition_ids = []
        # Find all "meira" (more) links
        for link in soup.find_all('a', href=True):
            href = link['href']
            if 'archive_view.php?id=' in href:
                match = re.search(r'id=(\d+)', href)
                if match:
                    exhibition_ids.append(int(match.group(1)))

        return list(set(exhibition_ids))  # Remove duplicates

    def parse_date_range(self, date_text: str) -> tuple[Optional[str], Optional[str]]:
        """Parse Icelandic date range string.

        Formats seen:
        - "6. desember 2025 - 8. febrúar 2026"
        - "6. 12. 2025 - 8. 2. 2026"
        - "desember 2025"
        """
        if not date_text:
            return None, None

        date_text = date_text.strip()

        # Icelandic month names to numbers
        months_is = {
            'janúar': 1, 'febrúar': 2, 'mars': 3, 'apríl': 4,
            'maí': 5, 'júní': 6, 'júlí': 7, 'ágúst': 8,
            'september': 9, 'október': 10, 'nóvember': 11, 'desember': 12
        }

        def parse_single_date(text: str, year_hint: Optional[int] = None) -> Optional[str]:
            text = text.strip().lower()

            # Try numeric format: "6. 12. 2025" or "6.12.2025"
            numeric_match = re.search(r'(\d{1,2})\.?\s*(\d{1,2})\.?\s*(\d{4})', text)
            if numeric_match:
                day, month, year = numeric_match.groups()
                return f"{year}-{int(month):02d}-{int(day):02d}"

            # Try text format: "6. desember 2025"
            for month_name, month_num in months_is.items():
                if month_name in text:
                    day_match = re.search(r'(\d{1,2})\.?\s*' + month_name, text)
                    year_match = re.search(r'(\d{4})', text)
                    day = int(day_match.group(1)) if day_match else 1
                    year = int(year_match.group(1)) if year_match else year_hint
                    if year:
                        return f"{year}-{month_num:02d}-{day:02d}"

            return None

        # Split on " - " for date range
        if ' - ' in date_text:
            parts = date_text.split(' - ')
            if len(parts) == 2:
                end_date = parse_single_date(parts[1])
                # Extract year from end date for start date hint
                year_hint = None
                if end_date:
                    year_hint = int(end_date[:4])
                start_date = parse_single_date(parts[0], year_hint)
                return start_date, end_date

        # Single date
        single = parse_single_date(date_text)
        return single, single

    def scrape_exhibition(self, exhibition_id: int, year: int) -> Optional[dict]:
        """Scrape a single exhibition detail page."""
        url = f"{BASE_URL}archive_view.php?id={exhibition_id}"
        soup = self._fetch(url)
        if not soup:
            return None

        data = {
            'exhibition_id': exhibition_id,
            'year': year,
            'source_url': url,
            'artists': [],
            'images': [],
        }

        # Extract artist names from .arc_view_head
        head = soup.find(class_='arc_view_head')
        if head:
            artist_text = head.get_text(strip=True)
            # Split on comma, handling "og" (and) as separator too
            artists = re.split(r',|\s+og\s+', artist_text)
            data['artists'] = [a.strip() for a in artists if a.strip()]

        # Extract title from .arc_view_name
        name = soup.find(class_='arc_view_name')
        if name:
            data['title_is'] = name.get_text(strip=True)
        else:
            data['title_is'] = f"Exhibition {exhibition_id}"

        # Extract date from .arc_view_date
        date_elem = soup.find(class_='arc_view_date')
        if date_elem:
            date_text = date_elem.get_text(strip=True)
            start_date, end_date = self.parse_date_range(date_text)
            data['start_date'] = start_date
            data['end_date'] = end_date

        # Extract description from .arc_view_text
        text_elems = soup.find_all(class_='arc_view_text')
        description_parts = []
        for elem in text_elems:
            # Filter out non-breaking space and noise
            text = elem.get_text(separator='\n', strip=True)
            if text and text != '\xa0' and len(text) > 1:
                description_parts.append(text)
        
        if description_parts:
            data['description_is'] = '\n\n'.join(description_parts)
        else:
            data['description_is'] = ""

        # Extract images
        for idx, img in enumerate(soup.find_all('img')):
            src = img.get('src', '')
            if src and not src.endswith(('.gif', 'spacer')):  # Skip spacer gifs
                # Skip navigation/UI images
                if any(x in src.lower() for x in ['logo', 'nav', 'button', 'arrow', 'icon']):
                    continue

                full_url = urljoin(url, src)
                filename = urlparse(full_url).path.split('/')[-1]

                data['images'].append({
                    'original_url': full_url,
                    'filename': filename,
                    'alt_text': img.get('alt', ''),
                    'display_order': idx,
                })

        return data

    def scrape_exhibition_english(self, exhibition_id: int) -> Optional[dict]:
        """Scrape English version of exhibition if available."""
        url = f"{BASE_URL}archive_view.php?id={exhibition_id}&lang=en"
        soup = self._fetch(url)
        if not soup:
            return None

        data = {}

        # Extract English title
        name = soup.find(class_='arc_view_name')
        if name:
            title = name.get_text(strip=True)
            # Only use if it looks different from Icelandic (has English words)
            if title:
                data['title_en'] = title

        # Extract English description
        text_elem = soup.find(class_='arc_view_text')
        if text_elem:
            paragraphs = text_elem.find_all('p')
            if paragraphs:
                text = '\n\n'.join(
                    p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)
                )
            else:
                text = text_elem.get_text(strip=True)
            if text:
                data['description_en'] = text

        return data if data else None

    def save_exhibition(self, data: dict, scrape_english: bool = True) -> Optional[int]:
        """Save exhibition data to database."""
        conn = get_connection(self.db_path)
        try:
            # Check if already exists
            if exhibition_exists(conn, data['exhibition_id']):
                print(f"  Exhibition {data['exhibition_id']} already exists, skipping")
                return None

            # Optionally get English content
            if scrape_english:
                en_data = self.scrape_exhibition_english(data['exhibition_id'])
                if en_data:
                    data.update(en_data)

            # Insert exhibition
            db_id = insert_exhibition(conn, data)

            # Link artists
            for idx, artist_name in enumerate(data.get('artists', [])):
                artist_id = get_or_create_artist(conn, artist_name)
                link_artist_to_exhibition(conn, db_id, artist_id, idx)

            # Insert image records (not downloaded yet)
            for img_data in data.get('images', []):
                img_data['exhibition_id'] = db_id
                insert_image(conn, img_data)

            return db_id

        finally:
            conn.close()

    def scrape_year(self, year: int, scrape_english: bool = True) -> dict:
        """Scrape all exhibitions for a given year."""
        print(f"\nScraping year {year}...")
        stats = {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0}

        exhibition_ids = self.get_exhibition_ids_for_year(year)
        stats['total'] = len(exhibition_ids)
        print(f"  Found {len(exhibition_ids)} exhibitions")

        for idx, ex_id in enumerate(exhibition_ids, 1):
            print(f"  [{idx}/{len(exhibition_ids)}] Exhibition {ex_id}...", end=' ')

            conn = get_connection(self.db_path)
            if exhibition_exists(conn, ex_id):
                print("skipped (exists)")
                stats['skipped'] += 1
                conn.close()
                continue
            conn.close()

            data = self.scrape_exhibition(ex_id, year)
            if data:
                db_id = self.save_exhibition(data, scrape_english)
                if db_id:
                    print(f"saved (id={db_id})")
                    stats['success'] += 1
                else:
                    stats['skipped'] += 1
            else:
                print("failed")
                stats['failed'] += 1

        return stats

    def scrape_all_years(
        self,
        start_year: int = 2003,
        end_year: int = 2025,
        scrape_english: bool = True
    ) -> dict:
        """Scrape all years in the archive."""
        total_stats = {'total': 0, 'success': 0, 'skipped': 0, 'failed': 0}

        for year in range(start_year, end_year + 1):
            year_stats = self.scrape_year(year, scrape_english)
            for key in total_stats:
                total_stats[key] += year_stats[key]

        return total_stats


def scrape_single_exhibition(exhibition_id: int, year: int, db_path: str = "kob_archive.db"):
    """Convenience function to scrape a single exhibition."""
    scraper = KoBScraper(db_path)
    data = scraper.scrape_exhibition(exhibition_id, year)
    if data:
        db_id = scraper.save_exhibition(data)
        if db_id:
            print(f"Saved exhibition {exhibition_id} with database ID {db_id}")
            print(f"  Title: {data.get('title_is')}")
            print(f"  Artists: {', '.join(data.get('artists', []))}")
            print(f"  Images: {len(data.get('images', []))}")
            return db_id
    return None


if __name__ == "__main__":
    # Test with a single exhibition
    from database import init_database
    init_database()
    scrape_single_exhibition(555, 2025)
