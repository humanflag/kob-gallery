#!/usr/bin/env python3
"""
Kling & Bang High-Resolution Image Scraper

Fetches full-resolution images from image_view.php pages and links them
to the correct exhibitions in the database.
"""

import re
import os
import time
import sqlite3
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE_URL = "http://kob.this.is/klingogbang/"
HEADERS = {
    "User-Agent": "KlingBangArchiveScraper/1.0 (Historical archive project)",
}
REQUEST_DELAY = 1.0


class HighResScraper:
    def __init__(self, db_path: str = "kob_archive.db", images_dir: str = "images"):
        self.db_path = db_path
        self.images_dir = Path(images_dir)
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    def get_all_exhibitions(self):
        """Get all exhibitions from database."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, exhibition_id, year, source_url
            FROM exhibitions
            ORDER BY year DESC
        """)
        exhibitions = cursor.fetchall()
        conn.close()
        return exhibitions

    def find_gallery_links(self, exhibition_url: str) -> list[dict]:
        """Find all image_view.php links on an exhibition page."""
        try:
            time.sleep(REQUEST_DELAY)
            response = self.session.get(exhibition_url, timeout=30)
            response.encoding = 'iso-8859-1'
            soup = BeautifulSoup(response.text, 'html.parser')

            gallery_links = []

            # Find all links to image_view.php
            for link in soup.find_all('a', href=re.compile(r'image_view\.php\?id=\d+')):
                match = re.search(r'id=(\d+)', link['href'])
                if match:
                    image_view_id = int(match.group(1))

                    # Get thumbnail info from the linked image
                    thumbnail_img = link.find('img')
                    if thumbnail_img:
                        src = thumbnail_img.get('src', '')
                        filename = Path(urlparse(src).path).name

                        # Skip head.jpg
                        if filename == 'head.jpg':
                            continue

                        gallery_links.append({
                            'image_view_id': image_view_id,
                            'thumbnail_src': src,
                            'thumbnail_filename': filename,
                            'alt_text': thumbnail_img.get('alt', ''),
                        })

            return gallery_links

        except Exception as e:
            print(f"  Error parsing {exhibition_url}: {e}")
            return []

    def fetch_full_res_image(self, image_view_id: int) -> dict | None:
        """Fetch full-resolution image from image_view.php page."""
        url = f"{BASE_URL}image_view.php?id={image_view_id}"

        try:
            time.sleep(REQUEST_DELAY)
            response = self.session.get(url, timeout=30)
            content_type = response.headers.get('Content-Type', '')

            # Case 1: Direct image file
            if content_type.startswith('image/'):
                return {
                    'content': response.content,
                    'content_type': content_type,
                    'source_url': url,
                }

            # Case 2: HTML page with image
            if 'text/html' in content_type:
                response.encoding = 'iso-8859-1'
                soup = BeautifulSoup(response.text, 'html.parser')

                # Find the main image
                img_tag = (
                    soup.find('img', class_='img_main') or
                    soup.find('img', class_='img') or
                    soup.find('img')
                )

                if img_tag and img_tag.get('src'):
                    img_url = urljoin(url, img_tag['src'])
                    # Skip head.jpg
                    if 'head.jpg' in img_url:
                        return None

                    img_response = self.session.get(img_url, timeout=30)
                    return {
                        'content': img_response.content,
                        'content_type': img_response.headers.get('Content-Type', 'image/jpeg'),
                        'source_url': img_url,
                    }

            return None

        except Exception as e:
            print(f"    Error fetching image_view {image_view_id}: {e}")
            return None

    def save_image(self, year: int, exhibition_id: int, image_view_id: int,
                   thumbnail_filename: str, image_data: dict) -> dict | None:
        """Save full-resolution image to disk."""
        if not image_data:
            return None

        # Create directory
        img_dir = self.images_dir / str(year) / str(exhibition_id)
        img_dir.mkdir(parents=True, exist_ok=True)

        # Determine filename - use image_view_id to ensure uniqueness
        base_name = Path(thumbnail_filename).stem if thumbnail_filename else f"img_{image_view_id}"

        # Get extension from content type
        ext_map = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
        }
        ext = ext_map.get(image_data['content_type'], '.jpg')
        filename = f"{base_name}{ext}"

        # Avoid overwriting - add image_view_id if file exists
        filepath = img_dir / filename
        if filepath.exists():
            filename = f"{base_name}_{image_view_id}{ext}"
            filepath = img_dir / filename

        # Save
        with open(filepath, 'wb') as f:
            f.write(image_data['content'])

        return {
            'filename': filename,
            'local_path': str(filepath),
            'original_url': image_data['source_url'],
            'file_size': len(image_data['content']),
            'image_view_id': image_view_id,
        }

    def update_database(self, exhibition_db_id: int, image_info: dict, alt_text: str):
        """Insert or update image record in database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Check if this image_view_id already exists for this exhibition
        cursor.execute("""
            SELECT id FROM images
            WHERE exhibition_id = ? AND filename = ?
        """, (exhibition_db_id, image_info['filename']))
        existing = cursor.fetchone()

        if existing:
            # Update existing record
            cursor.execute("""
                UPDATE images SET
                    local_path = ?,
                    original_url = ?,
                    file_size = ?,
                    downloaded_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (
                image_info['local_path'],
                image_info['original_url'],
                image_info['file_size'],
                existing[0]
            ))
        else:
            # Insert new record
            cursor.execute("""
                INSERT INTO images (
                    exhibition_id, filename, original_url, local_path,
                    alt_text, file_size, downloaded_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                exhibition_db_id,
                image_info['filename'],
                image_info['original_url'],
                image_info['local_path'],
                alt_text,
                image_info['file_size'],
            ))

        conn.commit()
        conn.close()

    def scrape_all(self):
        """Main method to scrape all high-res images."""
        exhibitions = self.get_all_exhibitions()
        print(f"Processing {len(exhibitions)} exhibitions for high-res images...\n")

        total_images = 0
        successful = 0
        failed = 0

        for idx, ex in enumerate(exhibitions, 1):
            print(f"[{idx}/{len(exhibitions)}] Exhibition {ex['exhibition_id']} ({ex['year']})")

            # Find gallery links on the page
            gallery_links = self.find_gallery_links(ex['source_url'])

            if not gallery_links:
                print("  No gallery images found")
                continue

            print(f"  Found {len(gallery_links)} gallery images")

            for link in gallery_links:
                total_images += 1
                image_view_id = link['image_view_id']

                # Fetch full-res image
                image_data = self.fetch_full_res_image(image_view_id)

                if image_data:
                    # Save to disk
                    image_info = self.save_image(
                        ex['year'],
                        ex['exhibition_id'],
                        image_view_id,
                        link['thumbnail_filename'],
                        image_data
                    )

                    if image_info:
                        # Update database
                        self.update_database(ex['id'], image_info, link['alt_text'])
                        print(f"    Saved: {image_info['filename']}")
                        successful += 1
                    else:
                        failed += 1
                else:
                    print(f"    Failed: image_view #{image_view_id}")
                    failed += 1

        print(f"\n{'='*60}")
        print("High-res scraping complete!")
        print(f"  Total images processed: {total_images}")
        print(f"  Successful: {successful}")
        print(f"  Failed: {failed}")
        print(f"{'='*60}")

        return {'total': total_images, 'successful': successful, 'failed': failed}


def main():
    scraper = HighResScraper()
    scraper.scrape_all()


if __name__ == "__main__":
    main()
