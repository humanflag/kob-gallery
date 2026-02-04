"""Image download and management for Kling & Bang archive."""

import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import requests

from database import get_connection

HEADERS = {
    "User-Agent": "KlingBangArchiveScraper/1.0 (Historical archive project)",
}
REQUEST_DELAY = 0.5  # seconds between image downloads


class ImageDownloader:
    """Download and organize exhibition images."""

    def __init__(
        self,
        db_path: str = "kob_archive.db",
        images_dir: str = "images",
        delay: float = REQUEST_DELAY
    ):
        self.db_path = db_path
        self.images_dir = Path(images_dir)
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    def _get_local_path(self, year: int, exhibition_id: int, filename: str) -> Path:
        """Generate local path for an image."""
        # Sanitize filename
        safe_filename = "".join(
            c if c.isalnum() or c in '.-_' else '_' for c in filename
        )
        return self.images_dir / str(year) / str(exhibition_id) / safe_filename

    def download_image(self, url: str, local_path: Path) -> Optional[dict]:
        """Download a single image and return metadata."""
        try:
            time.sleep(self.delay)
            response = self.session.get(url, timeout=30, stream=True)
            response.raise_for_status()

            # Create directory if needed
            local_path.parent.mkdir(parents=True, exist_ok=True)

            # Write image
            with open(local_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            # Get metadata
            file_size = local_path.stat().st_size
            content_type = response.headers.get('Content-Type', '')

            return {
                'file_size': file_size,
                'mime_type': content_type,
                'downloaded_at': datetime.now().isoformat(),
            }

        except requests.exceptions.RequestException as e:
            print(f"  Failed to download {url}: {e}")
            return None
        except OSError as e:
            print(f"  Failed to save {local_path}: {e}")
            return None

    def download_exhibition_images(self, exhibition_db_id: int) -> dict:
        """Download all images for an exhibition."""
        conn = get_connection(self.db_path)
        cursor = conn.cursor()

        # Get exhibition info
        cursor.execute(
            "SELECT exhibition_id, year FROM exhibitions WHERE id = ?",
            (exhibition_db_id,)
        )
        exhibition = cursor.fetchone()
        if not exhibition:
            conn.close()
            return {'downloaded': 0, 'failed': 0, 'skipped': 0}

        year = exhibition['year']
        ex_id = exhibition['exhibition_id']

        # Get images that haven't been downloaded
        cursor.execute("""
            SELECT id, original_url, filename
            FROM images
            WHERE exhibition_id = ? AND local_path IS NULL
        """, (exhibition_db_id,))
        images = cursor.fetchall()

        stats = {'downloaded': 0, 'failed': 0, 'skipped': 0}

        for img in images:
            local_path = self._get_local_path(year, ex_id, img['filename'])

            # Skip if file already exists
            if local_path.exists():
                cursor.execute(
                    "UPDATE images SET local_path = ? WHERE id = ?",
                    (str(local_path), img['id'])
                )
                conn.commit()
                stats['skipped'] += 1
                continue

            # Download
            metadata = self.download_image(img['original_url'], local_path)
            if metadata:
                cursor.execute("""
                    UPDATE images SET
                        local_path = ?,
                        file_size = ?,
                        mime_type = ?,
                        downloaded_at = ?
                    WHERE id = ?
                """, (
                    str(local_path),
                    metadata['file_size'],
                    metadata['mime_type'],
                    metadata['downloaded_at'],
                    img['id']
                ))
                conn.commit()
                stats['downloaded'] += 1
            else:
                stats['failed'] += 1

        conn.close()
        return stats

    def download_all_images(self) -> dict:
        """Download all images that haven't been downloaded yet."""
        conn = get_connection(self.db_path)
        cursor = conn.cursor()

        # Get all exhibitions with undownloaded images
        cursor.execute("""
            SELECT DISTINCT e.id, e.exhibition_id, e.year
            FROM exhibitions e
            JOIN images i ON e.id = i.exhibition_id
            WHERE i.local_path IS NULL
            ORDER BY e.year DESC
        """)
        exhibitions = cursor.fetchall()
        conn.close()

        total_stats = {'downloaded': 0, 'failed': 0, 'skipped': 0}
        print(f"Downloading images for {len(exhibitions)} exhibitions...")

        for idx, ex in enumerate(exhibitions, 1):
            print(f"[{idx}/{len(exhibitions)}] Exhibition {ex['exhibition_id']} ({ex['year']})...", end=' ')
            stats = self.download_exhibition_images(ex['id'])
            for key in total_stats:
                total_stats[key] += stats[key]
            print(f"downloaded={stats['downloaded']}, failed={stats['failed']}")

        return total_stats

    def download_year_images(self, year: int) -> dict:
        """Download all images for a specific year."""
        conn = get_connection(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT DISTINCT e.id, e.exhibition_id
            FROM exhibitions e
            JOIN images i ON e.id = i.exhibition_id
            WHERE e.year = ? AND i.local_path IS NULL
        """, (year,))
        exhibitions = cursor.fetchall()
        conn.close()

        total_stats = {'downloaded': 0, 'failed': 0, 'skipped': 0}
        print(f"Downloading images for {len(exhibitions)} exhibitions from {year}...")

        for ex in exhibitions:
            stats = self.download_exhibition_images(ex['id'])
            for key in total_stats:
                total_stats[key] += stats[key]

        return total_stats

    def verify_images(self) -> dict:
        """Verify all downloaded images exist on disk."""
        conn = get_connection(self.db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT id, local_path FROM images WHERE local_path IS NOT NULL")
        images = cursor.fetchall()

        stats = {'valid': 0, 'missing': 0}
        missing_ids = []

        for img in images:
            if Path(img['local_path']).exists():
                stats['valid'] += 1
            else:
                stats['missing'] += 1
                missing_ids.append(img['id'])

        # Clear local_path for missing images so they can be re-downloaded
        if missing_ids:
            cursor.executemany(
                "UPDATE images SET local_path = NULL WHERE id = ?",
                [(id,) for id in missing_ids]
            )
            conn.commit()

        conn.close()
        return stats


if __name__ == "__main__":
    downloader = ImageDownloader()
    stats = downloader.download_all_images()
    print(f"\nTotal: {stats}")
