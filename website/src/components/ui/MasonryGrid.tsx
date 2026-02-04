'use client';

import { useEffect, useRef, ReactElement } from 'react';

interface MasonryGridProps {
  children: ReactElement[];
  gap?: number;
  minItemWidth?: number;
}

export default function MasonryGrid({ 
  children, 
  gap = 24, 
  minItemWidth = 300 
}: MasonryGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  const layoutMasonry = () => {
    const grid = gridRef.current;
    if (!grid) return;

    const gridWidth = grid.offsetWidth;
    const columns = Math.max(1, Math.floor((gridWidth + gap) / (minItemWidth + gap)));
    const columnWidth = (gridWidth - (columns - 1) * gap) / columns;
    
    // Initialize column heights
    const columnHeights = new Array(columns).fill(0);
    
    // Position each item
    Array.from(grid.children).forEach((item, index) => {
      const htmlItem = item as HTMLElement;
      
      // Find shortest column
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      
      // Position the item
      htmlItem.style.position = 'absolute';
      htmlItem.style.width = `${columnWidth}px`;
      htmlItem.style.left = `${shortestColumnIndex * (columnWidth + gap)}px`;
      htmlItem.style.top = `${columnHeights[shortestColumnIndex]}px`;
      
      // Update column height
      columnHeights[shortestColumnIndex] += htmlItem.offsetHeight + gap;
    });
    
    // Set container height
    grid.style.height = `${Math.max(...columnHeights) - gap}px`;
  };

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    // Initial layout
    const timer = setTimeout(layoutMasonry, 100);

    // Re-layout on window resize
    const handleResize = () => {
      layoutMasonry();
    };

    window.addEventListener('resize', handleResize);

    // Re-layout when images load
    const images = grid.querySelectorAll('img');
    images.forEach(img => {
      if (img.complete) {
        layoutMasonry();
      } else {
        img.addEventListener('load', layoutMasonry);
      }
    });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      images.forEach(img => {
        img.removeEventListener('load', layoutMasonry);
      });
    };
  }, [children]);

  return (
    <div 
      ref={gridRef}
      className="relative w-full"
      style={{ position: 'relative' }}
    >
      {children}
    </div>
  );
}