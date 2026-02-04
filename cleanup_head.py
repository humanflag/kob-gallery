#!/usr/bin/env python3
"""Remove head.jpg files and database entries (mistakenly scraped website header)."""

import os
import sqlite3
from pathlib import Path

def cleanup_head_images(db_path: str = "kob_archive.db", images_dir: str = "images"):
    """Remove head.jpg files and their database entries."""

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Find all head.jpg entries in database
    cursor.execute("""
        SELECT id, exhibition_id, filename, local_path
        FROM images
        WHERE filename = 'head.jpg' OR filename LIKE '%head.jpg'
    """)
    head_images = cursor.fetchall()

    print(f"Found {len(head_images)} head.jpg entries in database")

    # Delete files from filesystem
    deleted_files = 0
    for img_id, ex_id, filename, local_path in head_images:
        if local_path:
            file_path = Path(local_path)
            if file_path.exists():
                file_path.unlink()
                deleted_files += 1
                print(f"  Deleted: {local_path}")

    # Delete entries from database
    cursor.execute("""
        DELETE FROM images
        WHERE filename = 'head.jpg' OR filename LIKE '%head.jpg'
    """)
    deleted_rows = cursor.rowcount
    conn.commit()

    print(f"\nCleanup complete:")
    print(f"  Files deleted: {deleted_files}")
    print(f"  Database entries removed: {deleted_rows}")

    # Also find and remove any head.jpg files that might exist without DB entries
    images_path = Path(images_dir)
    if images_path.exists():
        extra_deleted = 0
        for head_file in images_path.rglob("head.jpg"):
            head_file.unlink()
            extra_deleted += 1
            print(f"  Extra file deleted: {head_file}")
        if extra_deleted:
            print(f"  Additional files deleted: {extra_deleted}")

    conn.close()

if __name__ == "__main__":
    cleanup_head_images()
