declare module '@react-google-maps/api' {
  import type * as React from 'react';
  import type { MapOptions, LatLngLiteral } from 'google.maps';

  export function useLoadScript(options: { googleMapsApiKey: string; libraries?: string[]; }): { isLoaded: boolean; loadError?: Error };

  type DivPropsWithoutMapHandlers = Omit<React.ComponentProps<'div'>, 'onClick' | 'onLoad'>;

  export function GoogleMap(props: DivPropsWithoutMapHandlers & {
    mapContainerStyle?: React.CSSProperties;
    center?: LatLngLiteral;
    zoom?: number;
    options?: MapOptions;
    onClick?: (e: google.maps.MapMouseEvent) => void;
    onLoad?: (map: google.maps.Map) => void;
  }): JSX.Element;

  export function Marker(props: { position: LatLngLiteral } & React.ComponentProps<'div'>): JSX.Element;

  export default {} as any;
}
