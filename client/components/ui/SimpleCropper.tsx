"use client";

import React from "react";

type CropPoint = { x: number; y: number };
type CropArea = { x: number; y: number; width: number; height: number };

type Props = {
  image: string;
  crop: CropPoint;
  zoom: number;
  rotation: number;
  aspect: number;
  cropSize: { width: number; height: number };
  onCropChange: (crop: CropPoint) => void;
  onZoomChange?: (zoom: number) => void;
  onRotationChange?: (rotation: number) => void;
  onCropComplete?: (croppedArea: CropArea, croppedAreaPixels: CropArea) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function SimpleCropper({
  image,
  crop,
  zoom,
  rotation,
  aspect,
  cropSize,
  onCropChange,
  onCropComplete,
}: Props) {
  const [imageSize, setImageSize] = React.useState<{ width: number; height: number } | null>(null);
  const draggingRef = React.useRef(false);
  const dragStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const cropStartRef = React.useRef<CropPoint>({ x: 0, y: 0 });

  React.useEffect(() => {
    let mounted = true;
    const img = new Image();
    img.onload = () => {
      if (!mounted) return;
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = image;
    return () => {
      mounted = false;
    };
  }, [image]);

  React.useEffect(() => {
    if (!imageSize || !onCropComplete) return;

    const safeAspect = aspect > 0 ? aspect : 1;
    let baseWidth = imageSize.width;
    let baseHeight = baseWidth / safeAspect;
    if (baseHeight > imageSize.height) {
      baseHeight = imageSize.height;
      baseWidth = baseHeight * safeAspect;
    }

    const zoomSafe = zoom > 0 ? zoom : 1;
    const width = clamp(Math.round(baseWidth / zoomSafe), 1, imageSize.width);
    const height = clamp(Math.round(baseHeight / zoomSafe), 1, imageSize.height);

    const maxOffsetX = Math.max(0, Math.round((imageSize.width - width) / 2));
    const maxOffsetY = Math.max(0, Math.round((imageSize.height - height) / 2));
    const x = clamp(Math.round((imageSize.width - width) / 2 - crop.x), 0, maxOffsetX * 2);
    const y = clamp(Math.round((imageSize.height - height) / 2 - crop.y), 0, maxOffsetY * 2);

    const area = { x, y, width, height };
    onCropComplete(area, area);
  }, [aspect, crop.x, crop.y, imageSize, onCropComplete, zoom]);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      dragStartRef.current = { x: event.clientX, y: event.clientY };
      cropStartRef.current = crop;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [crop],
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !dragStartRef.current) return;
      const deltaX = event.clientX - dragStartRef.current.x;
      const deltaY = event.clientY - dragStartRef.current.y;
      onCropChange({
        x: cropStartRef.current.x + deltaX / Math.max(zoom, 1),
        y: cropStartRef.current.y + deltaY / Math.max(zoom, 1),
      });
    },
    [onCropChange, zoom],
  );

  const onPointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Image cropper"
      role="application"
    >
      <img
        src={image}
        alt="Crop target"
        draggable={false}
        className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full object-contain"
        style={{
          transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${zoom}) rotate(${rotation}deg)`,
          transformOrigin: "center",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/35" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
        style={{ width: `${cropSize.width}px`, height: `${cropSize.height}px` }}
      />
    </div>
  );
}
