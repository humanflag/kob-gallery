# Kling & Bang Image Gallery Scraper - Supplementary Script

## Overview
This is a supplementary scraper to handle the full-resolution image gallery system that exists on exhibition detail pages. The main scraper captures thumbnail images, but each exhibition may have additional high-resolution images accessible through `image_view.php?id=XXX` links.

## Problem Statement
Exhibition detail pages contain thumbnail images that link to full-resolution versions:
```html
<a href="http://kob.this.is/klingogbang/image_view.php?id=1056">
  <img src="./Kling&Bang_files/168013381_413460492958698_5948480623443027051_n.jpg" 
       alt="..." class="img">
</a>
```

The main scraper will capture the thumbnail, but we need to:
1. Identify all `image_view.php?id=XXX` links on each exhibition page
2. Fetch the full-resolution image from those pages
3. Update the database to link both thumbnail and full-res versions
4. Organize files properly for the new website

## Technical Details

### URL Pattern
- **Thumbnail page**: `archive_view.php?id=471` (exhibition detail)
- **Full-res viewer**: `image_view.php?id=1056` (individual image)
- **Image IDs**: Sequential integers, separate from exhibition IDs

### Expected HTML Structure (image_view.php)
```html
<!-- Likely contains: -->
<img src="path/to/full-resolution-image.jpg">
<!-- Or possibly a direct image file -->
```

## Database Schema Updates

### Modify Images Table
Add columns to track both versions:
```sql
ALTER TABLE images ADD COLUMN thumbnail_path TEXT;
ALTER TABLE images ADD COLUMN thumbnail_url TEXT;
ALTER TABLE images ADD COLUMN full_res_path TEXT;
ALTER TABLE images ADD COLUMN full_res_url TEXT;
ALTER TABLE images ADD COLUMN image_view_id INTEGER; -- The ID from image_view.php?id=XXX
ALTER TABLE images ADD COLUMN is_gallery_image BOOLEAN DEFAULT 0; -- Flag for linked gallery images
```

### Updated Schema
```sql
CREATE TABLE images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exhibition_id INTEGER NOT NULL,
    
    -- Thumbnail (embedded in exhibition page)
    thumbnail_filename TEXT,
    thumbnail_url TEXT,
    thumbnail_path TEXT,           -- Local path to thumbnail
    
    -- Full resolution (from image_view.php)
    full_res_filename TEXT,
    full_res_url TEXT,
    full_res_path TEXT,            -- Local path to full-res
    image_view_id INTEGER,         -- ID from image_view.php?id=XXX
    is_gallery_image BOOLEAN DEFAULT 0,
    
    -- Metadata
    alt_text TEXT,
    caption TEXT,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    mime_type TEXT,
    display_order INTEGER,
    
    -- Tracking
    downloaded_at TIMESTAMP,
    FOREIGN KEY (exhibition_id) REFERENCES exhibitions(id)
);
```

## Implementation Strategy

### Phase 1: Discovery
For each exhibition already scraped:

1. **Re-parse Exhibition HTML**
   ```python
   # Find all image_view.php links
   soup = BeautifulSoup(html, 'lxml')
   gallery_links = soup.find_all('a', href=re.compile(r'image_view\.php\?id=\d+'))
   
   for link in gallery_links:
       image_view_id = extract_id_from_url(link['href'])
       thumbnail_img = link.find('img')
       
       # Store relationship
       gallery_images.append({
           'exhibition_id': exhibition_id,
           'image_view_id': image_view_id,
           'thumbnail_src': thumbnail_img['src'],
           'alt_text': thumbnail_img.get('alt', '')
       })
   ```

2. **Build Image View URL List**
   ```python
   image_view_urls = [
       f"http://kob.this.is/klingogbang/image_view.php?id={img['image_view_id']}"
       for img in gallery_images
   ]
   ```

### Phase 2: Fetch Full-Resolution Images

1. **Request image_view.php Pages**
   ```python
   def fetch_full_res_image(image_view_id):
       url = f"http://kob.this.is/klingogbang/image_view.php?id={image_view_id}"
       
       try:
           response = requests.get(url, timeout=10)
           response.raise_for_status()
           
           # Two possibilities:
           # 1. HTML page with <img> tag
           if 'text/html' in response.headers.get('Content-Type', ''):
               soup = BeautifulSoup(response.content, 'lxml')
               img_tag = soup.find('img', class_='img_main') or soup.find('img')
               
               if img_tag and img_tag.get('src'):
                   full_res_url = urljoin(url, img_tag['src'])
                   return download_image(full_res_url)
           
           # 2. Direct image file
           elif response.headers.get('Content-Type', '').startswith('image/'):
               return save_image_from_response(response, image_view_id)
               
       except Exception as e:
           log_error(f"Failed to fetch image_view {image_view_id}: {e}")
           return None
   ```

2. **Download and Organize**
   ```python
   def download_full_res_image(exhibition_id, image_view_id, thumbnail_filename):
       # Fetch the full-res image
       full_res_data = fetch_full_res_image(image_view_id)
       
       if full_res_data:
           # Determine filename (try to match with thumbnail naming)
           base_name = Path(thumbnail_filename).stem
           extension = get_image_extension(full_res_data)
           full_res_filename = f"{base_name}_full{extension}"
           
           # Save to organized directory
           year = get_exhibition_year(exhibition_id)
           full_res_path = f"/images/{year}/{exhibition_id}/full/{full_res_filename}"
           
           save_image(full_res_data, full_res_path)
           
           return {
               'full_res_filename': full_res_filename,
               'full_res_path': full_res_path,
               'full_res_url': f"http://kob.this.is/klingogbang/image_view.php?id={image_view_id}",
               'image_view_id': image_view_id
           }
   ```

### Phase 3: Database Update

```python
def update_image_record(image_id, full_res_data):
    """Update existing image record with full-res information"""
    conn = sqlite3.connect('klingogbang.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE images 
        SET full_res_filename = ?,
            full_res_url = ?,
            full_res_path = ?,
            image_view_id = ?,
            is_gallery_image = 1
        WHERE id = ?
    """, (
        full_res_data['full_res_filename'],
        full_res_data['full_res_url'],
        full_res_data['full_res_path'],
        full_res_data['image_view_id'],
        image_id
    ))
    
    conn.commit()
    conn.close()
```

## Directory Structure

```
/images/
├── 2021/
│   └── 471/  (exhibition_id)
│       ├── screen_shot_2021-03-30_at_22.54.28.jpg          # Main hero image
│       ├── 168013381_413460492958698_5948480623443027051_n.jpg  # Thumbnail
│       └── full/
│           └── 168013381_413460492958698_5948480623443027051_n_full.jpg  # Full-res
├── 2025/
│   └── 555/
│       ├── 9listamenn.jpg
│       └── full/
│           └── 9listamenn_full.jpg
```

## Complete Script Structure

```python
#!/usr/bin/env python3
"""
Kling & Bang Image Gallery Scraper
Supplementary script to fetch full-resolution images from image_view.php pages
"""

import requests
import sqlite3
import time
from bs4 import BeautifulSoup
from pathlib import Path
from urllib.parse import urljoin
import re
from PIL import Image
import io

class ImageGalleryScraper:
    def __init__(self, db_path='klingogbang.db', images_dir='./images'):
        self.db_path = db_path
        self.images_dir = Path(images_dir)
        self.base_url = 'http://kob.this.is/klingogbang/'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Kling&Bang Archive Scraper)'
        })
    
    def get_exhibitions_with_images(self):
        """Get all exhibitions that have images needing full-res versions"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get exhibitions with images that don't have full-res versions yet
        cursor.execute("""
            SELECT DISTINCT e.id, e.exhibition_id, e.year, e.source_url
            FROM exhibitions e
            INNER JOIN images i ON e.id = i.exhibition_id
            WHERE i.full_res_path IS NULL OR i.full_res_path = ''
        """)
        
        exhibitions = cursor.fetchall()
        conn.close()
        return exhibitions
    
    def find_gallery_links(self, exhibition_url):
        """Parse exhibition page and find all image_view.php links"""
        try:
            response = self.session.get(exhibition_url, timeout=10)
            response.encoding = 'iso-8859-1'  # Icelandic encoding
            soup = BeautifulSoup(response.text, 'lxml')
            
            gallery_links = []
            
            # Find all links to image_view.php
            for link in soup.find_all('a', href=re.compile(r'image_view\.php\?id=\d+')):
                match = re.search(r'id=(\d+)', link['href'])
                if match:
                    image_view_id = int(match.group(1))
                    
                    # Get thumbnail info
                    thumbnail_img = link.find('img')
                    if thumbnail_img:
                        gallery_links.append({
                            'image_view_id': image_view_id,
                            'thumbnail_src': thumbnail_img.get('src', ''),
                            'alt_text': thumbnail_img.get('alt', ''),
                            'thumbnail_filename': Path(thumbnail_img.get('src', '')).name
                        })
            
            return gallery_links
            
        except Exception as e:
            print(f"Error parsing {exhibition_url}: {e}")
            return []
    
    def fetch_full_res_image(self, image_view_id):
        """Fetch full-resolution image from image_view.php"""
        url = f"{self.base_url}image_view.php?id={image_view_id}"
        
        try:
            response = self.session.get(url, timeout=15)
            content_type = response.headers.get('Content-Type', '')
            
            # Case 1: Direct image file
            if content_type.startswith('image/'):
                return {
                    'content': response.content,
                    'content_type': content_type
                }
            
            # Case 2: HTML page with image
            elif 'text/html' in content_type:
                soup = BeautifulSoup(response.content, 'lxml')
                
                # Try to find the main image
                img_tag = (
                    soup.find('img', class_='img_main') or 
                    soup.find('img', class_='img') or
                    soup.find('img')
                )
                
                if img_tag and img_tag.get('src'):
                    img_url = urljoin(url, img_tag['src'])
                    img_response = self.session.get(img_url, timeout=15)
                    
                    return {
                        'content': img_response.content,
                        'content_type': img_response.headers.get('Content-Type', 'image/jpeg')
                    }
            
            return None
            
        except Exception as e:
            print(f"Error fetching image_view {image_view_id}: {e}")
            return None
    
    def save_full_res_image(self, exhibition_id, year, gallery_link, image_data):
        """Save full-resolution image to disk"""
        if not image_data:
            return None
        
        # Create directory structure
        full_dir = self.images_dir / str(year) / str(exhibition_id) / 'full'
        full_dir.mkdir(parents=True, exist_ok=True)
        
        # Determine filename
        thumbnail_name = gallery_link['thumbnail_filename']
        base_name = Path(thumbnail_name).stem
        
        # Determine extension from content type
        extension_map = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp'
        }
        extension = extension_map.get(
            image_data['content_type'], 
            Path(thumbnail_name).suffix or '.jpg'
        )
        
        full_res_filename = f"{base_name}_full{extension}"
        full_res_path = full_dir / full_res_filename
        
        # Save image
        with open(full_res_path, 'wb') as f:
            f.write(image_data['content'])
        
        # Get image dimensions
        try:
            img = Image.open(io.BytesIO(image_data['content']))
            width, height = img.size
        except:
            width, height = None, None
        
        return {
            'full_res_filename': full_res_filename,
            'full_res_path': str(full_res_path.relative_to(self.images_dir)),
            'full_res_url': f"{self.base_url}image_view.php?id={gallery_link['image_view_id']}",
            'image_view_id': gallery_link['image_view_id'],
            'width': width,
            'height': height,
            'file_size': len(image_data['content'])
        }
    
    def update_database(self, exhibition_id, thumbnail_filename, full_res_data):
        """Update image record with full-resolution information"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Find the image record by exhibition_id and thumbnail filename
        cursor.execute("""
            SELECT id FROM images 
            WHERE exhibition_id = ? 
            AND (filename = ? OR thumbnail_filename = ?)
            LIMIT 1
        """, (exhibition_id, thumbnail_filename, thumbnail_filename))
        
        result = cursor.fetchone()
        
        if result:
            image_id = result[0]
            
            # Update with full-res info
            cursor.execute("""
                UPDATE images 
                SET full_res_filename = ?,
                    full_res_url = ?,
                    full_res_path = ?,
                    image_view_id = ?,
                    is_gallery_image = 1,
                    width = COALESCE(?, width),
                    height = COALESCE(?, height),
                    file_size = COALESCE(?, file_size)
                WHERE id = ?
            """, (
                full_res_data['full_res_filename'],
                full_res_data['full_res_url'],
                full_res_data['full_res_path'],
                full_res_data['image_view_id'],
                full_res_data['width'],
                full_res_data['height'],
                full_res_data['file_size'],
                image_id
            ))
            
            conn.commit()
            print(f"  ✓ Updated image record #{image_id}")
        else:
            # Create new image record if thumbnail not found
            cursor.execute("""
                INSERT INTO images (
                    exhibition_id, thumbnail_filename, full_res_filename,
                    full_res_url, full_res_path, image_view_id, is_gallery_image,
                    width, height, file_size
                ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            """, (
                exhibition_id,
                thumbnail_filename,
                full_res_data['full_res_filename'],
                full_res_data['full_res_url'],
                full_res_data['full_res_path'],
                full_res_data['image_view_id'],
                full_res_data['width'],
                full_res_data['height'],
                full_res_data['file_size']
            ))
            conn.commit()
            print(f"  ✓ Created new image record")
        
        conn.close()
    
    def scrape_gallery_images(self):
        """Main method to scrape all gallery images"""
        exhibitions = self.get_exhibitions_with_images()
        
        print(f"Found {len(exhibitions)} exhibitions with images to process")
        
        total_images = 0
        successful = 0
        
        for db_id, exhibition_id, year, source_url in exhibitions:
            print(f"\nProcessing Exhibition #{exhibition_id} ({year})")
            print(f"  URL: {source_url}")
            
            # Find gallery links on the page
            gallery_links = self.find_gallery_links(source_url)
            
            if not gallery_links:
                print(f"  No gallery images found")
                continue
            
            print(f"  Found {len(gallery_links)} gallery images")
            
            for gallery_link in gallery_links:
                total_images += 1
                print(f"    Fetching image_view #{gallery_link['image_view_id']}...")
                
                # Fetch full-resolution image
                image_data = self.fetch_full_res_image(gallery_link['image_view_id'])
                
                if image_data:
                    # Save to disk
                    full_res_data = self.save_full_res_image(
                        db_id, year, gallery_link, image_data
                    )
                    
                    if full_res_data:
                        # Update database
                        self.update_database(
                            db_id, 
                            gallery_link['thumbnail_filename'],
                            full_res_data
                        )
                        successful += 1
                        print(f"    ✓ Saved {full_res_data['full_res_filename']}")
                else:
                    print(f"    ✗ Failed to fetch image")
                
                # Rate limiting
                time.sleep(1.5)
        
        print(f"\n{'='*60}")
        print(f"Gallery scraping complete!")
        print(f"Total images processed: {total_images}")
        print(f"Successfully downloaded: {successful}")
        print(f"Failed: {total_images - successful}")
        print(f"{'='*60}")

def main():
    scraper = ImageGalleryScraper(
        db_path='klingogbang.db',
        images_dir='./images'
    )
    
    scraper.scrape_gallery_images()

if __name__ == '__main__':
    main()
```

## Usage

### 1. Update Database Schema
```bash
sqlite3 klingogbang.db < update_images_schema.sql
```

```sql
-- update_images_schema.sql
ALTER TABLE images ADD COLUMN thumbnail_path TEXT;
ALTER TABLE images ADD COLUMN thumbnail_url TEXT;
ALTER TABLE images ADD COLUMN full_res_path TEXT;
ALTER TABLE images ADD COLUMN full_res_url TEXT;
ALTER TABLE images ADD COLUMN image_view_id INTEGER;
ALTER TABLE images ADD COLUMN is_gallery_image BOOLEAN DEFAULT 0;

-- Rename existing columns for clarity
ALTER TABLE images RENAME COLUMN filename TO thumbnail_filename;
ALTER TABLE images RENAME COLUMN local_path TO thumbnail_path;
ALTER TABLE images RENAME COLUMN original_url TO thumbnail_url;
```

### 2. Run the Gallery Scraper
```bash
python scrape_gallery_images.py
```

### 3. Verify Results
```bash
# Check database
sqlite3 klingogbang.db "SELECT COUNT(*) FROM images WHERE is_gallery_image = 1;"

# Check files
find ./images -type f -path "*/full/*" | wc -l
```

## Integration with Main Scraper

Add this step to the main scraper workflow:

```python
# In main scraper, after downloading exhibition images:

def scrape_exhibition_images(self, exhibition_id, soup):
    """Enhanced to capture both thumbnails and gallery links"""
    images = []
    
    # 1. Get main/hero image
    hero_img = soup.find('img', alt=True)
    if hero_img:
        images.append({
            'type': 'hero',
            'filename': Path(hero_img['src']).name,
            'url': urljoin(self.base_url, hero_img['src']),
            'alt_text': hero_img.get('alt', '')
        })
    
    # 2. Get gallery image links (thumbnails that link to image_view.php)
    for link in soup.find_all('a', href=re.compile(r'image_view\.php\?id=\d+')):
        match = re.search(r'id=(\d+)', link['href'])
        if match:
            thumbnail_img = link.find('img')
            if thumbnail_img:
                images.append({
                    'type': 'gallery_thumbnail',
                    'filename': Path(thumbnail_img['src']).name,
                    'url': urljoin(self.base_url, thumbnail_img['src']),
                    'alt_text': thumbnail_img.get('alt', ''),
                    'image_view_id': int(match.group(1)),
                    'needs_full_res': True  # Flag for later processing
                })
    
    return images
```

## Testing

### Test with Single Exhibition
```python
# Test script
scraper = ImageGalleryScraper()

# Test with exhibition ID 471 (the example we have)
exhibition_url = 'http://kob.this.is/klingogbang/archive_view.php?id=471'
gallery_links = scraper.find_gallery_links(exhibition_url)

print(f"Found {len(gallery_links)} gallery images")

for link in gallery_links:
    print(f"  Image View ID: {link['image_view_id']}")
    print(f"  Thumbnail: {link['thumbnail_filename']}")
    
    # Test fetching full-res
    image_data = scraper.fetch_full_res_image(link['image_view_id'])
    if image_data:
        print(f"  ✓ Full-res fetched: {len(image_data['content'])} bytes")
    else:
        print(f"  ✗ Failed to fetch full-res")
```

## Considerations

### Handling Edge Cases
1. **Missing image_view pages**: Some thumbnails might not have full-res versions
2. **Duplicate images**: Same image might appear in multiple exhibitions
3. **Different naming conventions**: Thumbnails and full-res might have different names
4. **Failed downloads**: Implement retry logic with exponential backoff

### Performance
- Process exhibitions in batches
- Parallel downloads (careful with rate limiting)
- Cache image_view IDs to avoid re-processing
- Skip if full-res already exists

### Data Quality
- Compare file sizes (full-res should be larger than thumbnail)
- Verify image dimensions (full-res should be higher resolution)
- Check for corrupted downloads
- Log all failures for manual review

## Deliverables

1. ✅ Updated database schema with full-res columns
2. ✅ Gallery scraper script
3. ✅ Organized directory structure with `/full/` subdirectories
4. ✅ Database records linking thumbnails to full-res images
5. ✅ Comprehensive error logging
6. ✅ Statistics report on success rate

## Questions for Clarification

1. Should we download full-res for ALL images, or only those with image_view links?
2. What to do if full-res is the same size/resolution as thumbnail?
3. Should we generate additional sizes (medium) for the website?
4. Priority: Run this immediately after main scraper, or as separate process?
5. Storage: Keep both versions, or replace thumbnails with full-res?