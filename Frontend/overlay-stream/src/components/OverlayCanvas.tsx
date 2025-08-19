'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Overlay } from '@/lib/types';

// Debounce function
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

interface OverlayCanvasProps {
  overlays: Overlay[];
  onOverlayUpdate: (id: string, updates: Partial<Overlay>) => void;
}

export default function OverlayCanvas({ overlays, onOverlayUpdate }: OverlayCanvasProps) {
  const [draggedOverlay, setDraggedOverlay] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [localOverlays, setLocalOverlays] = useState<Overlay[]>(overlays);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Debounced API update - only calls API after 300ms of no movement
  const debouncedUpdate = useCallback(
    debounce((id: string, updates: Partial<Overlay>) => {
      onOverlayUpdate(id, updates);
    }, 300),
    [onOverlayUpdate]
  );

  // Update local state when props change
  useEffect(() => {
    setLocalOverlays(overlays);
  }, [overlays]);

  const handleMouseDown = (e: React.MouseEvent, overlay: Overlay) => {
    if (!overlay._id) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    setDraggedOverlay(overlay._id);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedOverlay || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - canvasRect.left - dragOffset.x;
    const newY = e.clientY - canvasRect.top - dragOffset.y;

    // Update local state immediately for smooth dragging
    setLocalOverlays(prev => 
      prev.map(o => o._id === draggedOverlay ? { ...o, x: newX, y: newY } : o)
    );

    // Debounced API call
    debouncedUpdate(draggedOverlay, { x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setDraggedOverlay(null);
  };

  // Use local overlays for rendering
  const displayOverlays = localOverlays.length > 0 ? localOverlays : overlays;

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {displayOverlays.map((overlay) => (
        <div
          key={overlay._id}
          className="absolute pointer-events-auto cursor-move select-none"
          style={{
            left: overlay.x,
            top: overlay.y,
            width: overlay.width,
            height: overlay.height,
            fontSize: overlay.fontSize || 16,
            color: overlay.color || '#ffffff'
          }}
          onMouseDown={(e) => handleMouseDown(e, overlay)}
        >
          {overlay.type === 'text' ? (
            <span className="font-bold drop-shadow-lg">{overlay.content}</span>
          ) : (
            <Image 
              src={overlay.content} 
              alt="Overlay" 
              fill
              className="object-contain"
              draggable={false}
            />
          )}
        </div>
      ))}
    </div>
  );
}