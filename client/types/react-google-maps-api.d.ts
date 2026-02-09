declare module '@react-google-maps/api' {
  import type * as React from 'react';
  import type { MapOptions, LatLngLiteral } from 'google.maps';

  export function useLoadScript(options: { googleMapsApiKey: string; libraries?: string[]; }): { isLoaded: boolean; loadError?: Error };

  export function GoogleMap(props: React.ComponentProps<'div'> & {
    mapContainerStyle?: React.CSSProperties;
    center?: LatLngLiteral;
    zoom?: number;
    onClick?: (e: google.maps.MapMouseEvent) => void;
  }): JSX.Element;

  export function Marker(props: { position: LatLngLiteral } & React.ComponentProps<'div'>): JSX.Element;

  export default {} as any;
}
