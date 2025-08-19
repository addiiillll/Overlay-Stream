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

  // Reference dimensions for consistent scaling (typical video player size)
  const REFERENCE_WIDTH = 800;
  const REFERENCE_HEIGHT = 450;

  // Scale coordinates based on current container size vs reference size
  const scaleCoordinate = (value: number, currentSize: number, referenceSize: number) => {
    return (value * currentSize) / referenceSize;
  };

  // Get current container dimensions
  const getContainerDimensions = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      width: rect?.width || REFERENCE_WIDTH,
      height: rect?.height || REFERENCE_HEIGHT
    };
  };

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

    // Constrain to canvas bounds
    const constrainedX = Math.max(0, Math.min(newX, canvasRect.width - 50)); // 50px minimum for visibility
    const constrainedY = Math.max(0, Math.min(newY, canvasRect.height - 20)); // 20px minimum for visibility

    // Convert current screen coordinates back to reference coordinates for storage
    const referenceX = (constrainedX * REFERENCE_WIDTH) / canvasRect.width;
    const referenceY = (constrainedY * REFERENCE_HEIGHT) / canvasRect.height;

    // Update local state immediately for smooth dragging (use screen coordinates for immediate display)
    setLocalOverlays(prev =>
      prev.map(o => o._id === draggedOverlay ? { ...o, x: constrainedX, y: constrainedY } : o)
    );

    // Debounced API call (use reference coordinates for storage)
    debouncedUpdate(draggedOverlay, { x: referenceX, y: referenceY });
  };

  const handleMouseUp = () => {
    setDraggedOverlay(null);
  };

  // Use local overlays for rendering
  const displayOverlays = localOverlays.length > 0 ? localOverlays : overlays;

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {displayOverlays.map((overlay) => {
        const { width: containerWidth, height: containerHeight } = getContainerDimensions();

        // Scale coordinates from reference size to current container size
        const scaledX = scaleCoordinate(overlay.x, containerWidth, REFERENCE_WIDTH);
        const scaledY = scaleCoordinate(overlay.y, containerHeight, REFERENCE_HEIGHT);
        const scaledWidth = scaleCoordinate(overlay.width, containerWidth, REFERENCE_WIDTH);
        const scaledHeight = scaleCoordinate(overlay.height, containerHeight, REFERENCE_HEIGHT);

        // Scale font size proportionally
        const scaledFontSize = Math.max(12, scaleCoordinate(overlay.fontSize || 16, containerWidth, REFERENCE_WIDTH));

        return (
          <div
            key={overlay._id}
            className="absolute pointer-events-auto cursor-move select-none"
            style={{
              left: scaledX,
              top: scaledY,
              width: scaledWidth,
              height: scaledHeight,
              fontSize: scaledFontSize,
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
        );
      })}
    </div>
  );
}