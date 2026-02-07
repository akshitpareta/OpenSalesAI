'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: 'store' | 'rep';
  label: string;
  description?: string;
  color?: string;
}

export interface MapViewProps {
  markers?: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  className?: string;
  onMarkerClick?: (marker: MapMarker) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  markers = [],
  center = { lat: 19.076, lng: 72.8777 },
  zoom = 12,
  height = '400px',
  className = '',
  onMarkerClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setMapError(
        'Mapbox token not configured. Set NEXT_PUBLIC_MAPBOX_TOKEN in your .env file.'
      );
      return;
    }

    let map: mapboxgl.Map | undefined;

    const initMap = async () => {
      try {
        const mapboxgl = (await import('mapbox-gl')).default;
        // @ts-expect-error CSS import has no type declarations
        await import('mapbox-gl/dist/mapbox-gl.css');

        if (!mapContainerRef.current) return;

        mapboxgl.accessToken = token;

        map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [center.lng, center.lat],
          zoom,
        });

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        mapRef.current = map;

        map.on('load', () => {
          addMarkers(mapboxgl);
        });
      } catch (err) {
        setMapError('Failed to load map. Please check your internet connection.');
        console.error('Map initialization error:', err);
      }
    };

    const addMarkers = (mapboxgl: typeof import('mapbox-gl').default) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      markers.forEach((marker) => {
        const el = document.createElement('div');
        el.className = 'mapbox-marker';

        const isStore = marker.type === 'store';
        const color = marker.color || (isStore ? '#2563eb' : '#16a34a');

        el.innerHTML = `
          <div style="
            width: ${isStore ? '28px' : '32px'};
            height: ${isStore ? '28px' : '32px'};
            border-radius: 50%;
            background: ${color};
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              ${
                isStore
                  ? '<path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1"/>'
                  : '<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>'
              }
            </svg>
          </div>
        `;

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          maxWidth: '200px',
        }).setHTML(`
          <div style="font-family: Inter, sans-serif; padding: 4px;">
            <p style="font-weight: 600; font-size: 13px; margin: 0 0 2px;">${marker.label}</p>
            ${marker.description ? `<p style="font-size: 12px; color: #6b7280; margin: 0;">${marker.description}</p>` : ''}
          </div>
        `);

        const mapboxMarker = new mapboxgl.Marker(el)
          .setLngLat([marker.lng, marker.lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        el.addEventListener('click', () => {
          onMarkerClick?.(marker);
        });

        markersRef.current.push(mapboxMarker);
      });

      if (markers.length > 1 && mapRef.current) {
        const bounds = new mapboxgl.LngLatBounds();
        markers.forEach((m) => bounds.extend([m.lng, m.lat]));
        mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }
    };

    initMap();

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || markers.length === 0) return;

    const initMarkers = async () => {
      const mapboxgl = (await import('mapbox-gl')).default;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      markers.forEach((marker) => {
        const el = document.createElement('div');
        const isStore = marker.type === 'store';
        const color = marker.color || (isStore ? '#2563eb' : '#16a34a');

        el.innerHTML = `
          <div style="
            width: ${isStore ? '28px' : '32px'};
            height: ${isStore ? '28px' : '32px'};
            border-radius: 50%;
            background: ${color};
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              ${
                isStore
                  ? '<path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1"/>'
                  : '<path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>'
              }
            </svg>
          </div>
        `;

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          maxWidth: '200px',
        }).setHTML(`
          <div style="font-family: Inter, sans-serif; padding: 4px;">
            <p style="font-weight: 600; font-size: 13px; margin: 0 0 2px;">${marker.label}</p>
            ${marker.description ? `<p style="font-size: 12px; color: #6b7280; margin: 0;">${marker.description}</p>` : ''}
          </div>
        `);

        const mapboxMarker = new mapboxgl.Marker(el)
          .setLngLat([marker.lng, marker.lat])
          .setPopup(popup)
          .addTo(mapRef.current!);

        el.addEventListener('click', () => {
          onMarkerClick?.(marker);
        });

        markersRef.current.push(mapboxMarker);
      });
    };

    initMarkers();
  }, [markers, onMarkerClick]);

  if (mapError) {
    return (
      <div
        className={`bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center p-6">
          <svg
            className="h-12 w-12 mx-auto text-gray-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className={`rounded-xl overflow-hidden ${className}`}
      style={{ height }}
    />
  );
};
