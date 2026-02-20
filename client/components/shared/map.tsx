"use client";

import { useCallback, useState } from "react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 6.9271,
  lng: 79.8612,
};

interface MapComponentProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export default function MapComponent({
  onLocationSelect,
  initialLat,
  initialLng,
}: MapComponentProps) {
  const [markerPosition, setMarkerPosition] = useState({
    lat: initialLat || defaultCenter.lat,
    lng: initialLng || defaultCenter.lng,
  });
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const hasControlledCoordinates =
    Boolean(onLocationSelect) &&
    typeof initialLat === "number" &&
    Number.isFinite(initialLat) &&
    typeof initialLng === "number" &&
    Number.isFinite(initialLng);
  const resolvedMarkerPosition = hasControlledCoordinates
    ? { lat: initialLat, lng: initialLng }
    : markerPosition;

  const updateLocation = useCallback(
    (lat: number, lng: number) => {
      setMarkerPosition({ lat, lng });
      onLocationSelect?.(lat, lng);
      setLocationError(null);
      if (mapInstance) {
        mapInstance.panTo({ lat, lng });
        mapInstance.setZoom(Math.max(mapInstance.getZoom() || 13, 15));
      }
    },
    [mapInstance, onLocationSelect],
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        updateLocation(lat, lng);
      }
    },
    [updateLocation],
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        updateLocation(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location permission denied. Please allow access.");
          return;
        }
        if (error.code === error.TIMEOUT) {
          setLocationError("Location request timed out. Please try again.");
          return;
        }
        setLocationError("Could not get current location. Please try again.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }, [updateLocation]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || "",
  });

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        Google Maps API key is not configured
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        Failed to load Google Maps
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Loading map...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={resolvedMarkerPosition}
        zoom={13}
        onClick={handleMapClick}
        onLoad={(map) => setMapInstance(map)}
      >
        <Marker position={resolvedMarkerPosition} />
      </GoogleMap>

      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="rounded-md border border-(--border) bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLocating ? "Locating..." : "Use current location"}
        </button>
        {locationError ? (
          <p className="max-w-52 rounded-md bg-white/95 px-2 py-1 text-xs text-rose-600 shadow-sm">
            {locationError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
