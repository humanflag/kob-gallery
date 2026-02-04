# Kling & Bang Gallery Archive

A digital archive showcasing 22+ years of contemporary art exhibitions from Kling & Bang gallery in Iceland.

## Project Structure

- `/website` - Next.js web application
- `/images` - Exhibition images (not included in git due to size)
- `kob_archive.db` - SQLite database with exhibition data
- Python scrapers and utilities for data collection

## Website

The main website is a Next.js application located in the `/website` directory featuring:
- Masonry layout for exhibition browsing
- Year-based navigation
- Artist profiles and exhibition details
- Responsive design with dark theme

## Deployment

This project is configured for deployment on Railway, which supports:
- SQLite databases
- Static file serving for images
- Next.js applications

The Railway configuration is in `railway.toml` and points to the `/website` subdirectory.