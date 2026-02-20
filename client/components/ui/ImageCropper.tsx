"use client";

import React, { useCallback, useRef, useState } from "react";
import Cropper from "@/components/ui/SimpleCropper";
import { Button } from "./button"; // local button -> project already has this path alias
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";

type Props = {
  src: string; // image URL (object URL or data URL)
  aspect?: number; // aspect ratio (default 1)
  onCancel: () => void;
  onCrop: (file: File) => void; // returns a File ready to upload
  // optional: provide live preview blob to parent (parent should create/revoke its own object URL)
  onPreviewChange?: (previewBlob: Blob | null) => void;
};

// utils: create image, crop via canvas, return blob
async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false },
  // optional output size — if provided, the cropped image will be scaled to this size
  outputSize?: { width: number; height: number },
) {
  const image = await createImage(imageSrc);

  // draw rotated and flipped image onto an offscreen canvas then crop
  const safeArea = Math.max(image.width, image.height) * 2;
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = safeArea;
  tmpCanvas.height = safeArea;
  const tmpCtx = tmpCanvas.getContext("2d");
  if (!tmpCtx) throw new Error("Could not get tmp canvas context");

  tmpCtx.translate(safeArea / 2, safeArea / 2);
  tmpCtx.rotate(getRadianAngle(rotation));
  tmpCtx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  tmpCtx.drawImage(image, -image.width / 2, -image.height / 2);

  // translate from centered draw coords back to the crop box coords
  const data = tmpCtx.getImageData(
    safeArea / 2 - image.width / 2 + pixelCrop.x,
    safeArea / 2 - image.height / 2 + pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
  );

  // copy the raw crop into a temporary canvas
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) throw new Error("Could not get crop canvas context");
  cropCtx.putImageData(data, 0, 0);

  // final canvas — either same size as crop or scaled to outputSize
  const finalWidth = outputSize?.width ?? pixelCrop.width;
  const finalHeight = outputSize?.height ?? pixelCrop.height;
  const canvas = document.createElement("canvas");
  canvas.width = finalWidth;
  canvas.height = finalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get final canvas context");

  // draw scaled crop into final canvas
  ctx.drawImage(cropCanvas, 0, 0, pixelCrop.width, pixelCrop.height, 0, 0, finalWidth, finalHeight);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
  });
}

export default function ImageCropper({ src, aspect = 1, onCancel, onCrop, onPreviewChange }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  // fixed output size for avatar images (square) — change to taste
  const OUTPUT_PX = 256;

  // Slightly smaller visible crop window for profile photos.
  // Change CROP_BOX_WIDTH (px) to make it smaller/larger. Height is derived from `aspect`.
  const CROP_BOX_WIDTH = 240; // px
  const cropSize = { width: CROP_BOX_WIDTH, height: Math.round(CROP_BOX_WIDTH / aspect) };

  // avoid setting state after unmount (we may call onCancel which unmounts this component)
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // live preview (data URL/object URL) that mirrors the final uploaded avatar
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onCropComplete = useCallback((_: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // update circular preview whenever crop/rotation/area changes
  React.useEffect(() => {
    let active = true;
    let url: string | null = null;
    (async () => {
      if (!croppedAreaPixels) {
        // notify parent that preview is gone
        onPreviewChange?.(null);
        return;
      }
      try {
        const blob = await getCroppedImg(src, croppedAreaPixels, rotation, { horizontal: false, vertical: false }, { width: OUTPUT_PX, height: OUTPUT_PX });
        if (!blob) {
          onPreviewChange?.(null);
          return;
        }

        // internal preview (object URL) for crop dialog
        url = URL.createObjectURL(blob);
        if (active && mountedRef.current) setPreviewUrl(url);

        // inform parent with the raw blob so the parent can create/revoke its own object URL
        onPreviewChange?.(blob);
      } catch (err) {
        // notify parent on error
        onPreviewChange?.(null);
      }
    })();

    return () => {
      active = false;
      // clear internal preview URL; parent preview stays until explicitly cleared
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [croppedAreaPixels, rotation, src, onPreviewChange]);

  // ensure parent preview clears if the cropper unmounts entirely
  React.useEffect(() => () => { onPreviewChange?.(null); }, [onPreviewChange]);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;
    try {
      setProcessing(true);
      const blob = await getCroppedImg(src, croppedAreaPixels, rotation, { horizontal: false, vertical: false }, { width: OUTPUT_PX, height: OUTPUT_PX });
      if (!blob) throw new Error("Failed to create cropped image");
      const file = new File([blob], `avatar_${Date.now()}.jpg`, { type: "image/jpeg" });

      // start upload in parent and immediately close the crop dialog (optimistic UX)
      onCrop(file);
      onCancel();
    } catch (err) {
      console.error(err);
      // ensure dialog is closed on error as well
      onCancel();
    } finally {
      // only update local state if still mounted (parent may have unmounted this component)
      if (mountedRef.current) setProcessing(false);
    }
  }, [croppedAreaPixels, rotation, src, onCrop, onCancel]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-3xl w-[min(96vw,720px)]">
        <DialogHeader>
          <div className="flex items-center justify-between w-full gap-4">
            <DialogTitle>Crop profile photo</DialogTitle>
            <div className="ml-auto">
              {/* circular preview that mirrors final Avatar */}
              <Avatar src={previewUrl ?? src} alt="Preview" className="h-12 w-12" />
            </div>
          </div>
        </DialogHeader>
        <div className="relative h-80 bg-black/10 rounded-md overflow-hidden">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropSize={cropSize}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className="text-sm text-(--muted)">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <label className="text-sm text-(--muted)">Rotate</label>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
          />
        </div>

        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={processing}>Cancel</Button>
            <Button onClick={handleSave} disabled={processing}>{processing ? "Saving..." : "Save"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
