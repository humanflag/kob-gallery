'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useAnimation, useMotionValue } from 'framer-motion';

interface YearSelectorProps {
  years: number[];
  selectedYear?: number;
}

export default function YearSelector({ years, selectedYear }: YearSelectorProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const yearSelectorRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const controls = useAnimation();
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const [width, setWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  // Combine items
  const items = ['All', ...years];

  // Scroll to year selector when year changes
  useEffect(() => {
    if (yearSelectorRef.current) {
      yearSelectorRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start'
      });
    }
  }, [selectedYear]);

  // Measure content
  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
      const totalWidth = items.length * 200; // Rough estimate
      setContentWidth(totalWidth);
    }
  }, [items.length]);

  // Center selected item
  useEffect(() => {
    // Only center if NOT dragging to avoid fighting the user
    if (isDragging) return;

    const selectedIndex = selectedYear 
      ? items.indexOf(selectedYear) 
      : 0;

    if (selectedIndex !== -1 && itemsRef.current[selectedIndex] && containerRef.current) {
      const item = itemsRef.current[selectedIndex];
      if (!item) return;

      const containerCenter = containerRef.current.offsetWidth / 2;
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      const newX = containerCenter - itemCenter;

      controls.start({
        x: newX,
        transition: { type: "spring", stiffness: 40, damping: 20, mass: 1 }
      });
    }
  }, [selectedYear, controls, isDragging, width]); // Added isDragging/width dependency

  const handleDragEnd = (event: any, info: any) => {
    // 1. Calculate where inertia would naturally take us
    //    (velocity * constant) roughly maps to pixel distance in framer motion's inertia
    const velocity = info.velocity.x;
    const currentX = x.get();
    const projectedX = currentX + velocity * 0.2; // Adjust multiplier for "feel"

    if (!containerRef.current) return;
    const containerCenter = containerRef.current.offsetWidth / 2;

    // 2. Find the item that would be closest to the center at that projected spot
    let closestIndex = 0;
    let minDistance = Infinity;

    itemsRef.current.forEach((item, index) => {
      if (!item) return;
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      
      // Where this item would be relative to container center if we moved to projectedX
      // position_on_screen = projectedX + item_offset
      // distance_to_center = abs( (projectedX + item_offset) - containerCenter )
      // We want: projectedX = containerCenter - item_offset (ideal X)
      
      const idealX = containerCenter - itemCenter;
      const distance = Math.abs(projectedX - idealX);

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    // 3. Animate to that item's exact center
    const targetItem = itemsRef.current[closestIndex];
    if (targetItem) {
      const itemCenter = targetItem.offsetLeft + targetItem.offsetWidth / 2;
      const snapX = containerCenter - itemCenter;

      controls.start({
        x: snapX,
        transition: { type: "spring", stiffness: 50, damping: 20, mass: 1 }
      });

      // 4. Navigate to the selected year
      //    Use a small timeout to allow the snap animation to start visually first
      const selectedValue = items[closestIndex];
      const href = selectedValue === 'All' ? '/exhibitions' : `/exhibitions?year=${selectedValue}`;
      
      // Only navigate if it's different from current
      const currentSelected = selectedYear || 'All';
      if (currentSelected !== selectedValue) {
        router.push(href);
      }
    }
    
    setTimeout(() => setIsDragging(false), 50);
  };

  return (
    <div 
      id="year-selector" 
      ref={yearSelectorRef}
      className="relative w-full py-12 md:py-16 border-y border-border-subtle/30 overflow-hidden bg-background group/slider select-none"
    >
      {/* Center Indicator */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-20 bg-accent/20 z-0" />
      
      {/* Draggable Container */}
      <div ref={containerRef} className="w-full overflow-hidden cursor-grab active:cursor-grabbing">
        <motion.div
          drag="x"
          dragConstraints={{ right: width / 2 + 200, left: -contentWidth }} 
          dragElastic={0.1}
          // We disable native dragTransition inertia because we handle it manually in onDragEnd
          dragTransition={{ power: 0, timeConstant: 0 }} 
          animate={controls}
          style={{ x }}
          onDragStart={() => {
            setIsDragging(true);
            controls.stop(); 
          }}
          onDragEnd={handleDragEnd}
          className="flex items-center gap-8 md:gap-16 px-[50%] py-8"
        >
          {items.map((item, index) => {
            const isSelected = item === 'All' ? !selectedYear : selectedYear === Number(item);
            const href = item === 'All' ? '/exhibitions' : `/exhibitions?year=${item}`;
            
            return (
              <Link
                key={item}
                href={href}
                draggable={false} 
                ref={(el) => { itemsRef.current[index] = el }}
                onClick={(e) => {
                  if (isDragging) e.preventDefault();
                }}
                className="shrink-0 relative py-8 group/item"
              >
                <div className="flex flex-col items-center gap-3 transition-transform duration-500">
                  <span className={`text-[8px] font-mono tracking-[0.2em] transition-all duration-500 ${
                    isSelected ? 'text-accent opacity-100 -translate-y-1' : 'text-foreground-subtle opacity-0 translate-y-0 group-hover/item:opacity-50'
                  }`}>
                    {item === 'All' ? 'FULL' : 'EPOCH'}
                  </span>
                  
                  <span className={`text-3xl md:text-5xl font-light transition-all duration-700 ${
                    isSelected 
                      ? 'text-foreground scale-110 tracking-widest blur-0' 
                      : 'text-foreground-subtle/20 hover:text-foreground-muted tracking-tight blur-[1px] hover:blur-0'
                  }`}>
                    {item}
                  </span>
                  
                  <div className={`w-1 h-1 rounded-full bg-accent transition-all duration-500 ${
                    isSelected ? 'scale-100 opacity-100 translate-y-1' : 'scale-0 opacity-0 translate-y-0'
                  }`} />
                </div>
              </Link>
            );
          })}
        </motion.div>
      </div>

      {/* Decorative Labels */}
      <div className="container flex justify-between mt-6 pointer-events-none opacity-30">
        <span className="text-[10px] uppercase tracking-[0.4em] text-foreground-subtle font-bold">2003 ORIGIN</span>
        <span className="text-[10px] uppercase tracking-[0.4em] text-foreground-subtle font-bold">PRESENT DAY</span>
      </div>
    </div>
  );
}