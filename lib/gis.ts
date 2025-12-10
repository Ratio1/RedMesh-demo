import type { FeatureCollection, Point } from 'geojson';
import countries from 'world-countries';

// Pre-compute lookups for ISO2 codes to coordinates and human-readable names.
const ISO2_TO_LL = new Map(countries.map((country) => [country.cca2, { lat: country.latlng[0], lon: country.latlng[1] }]));
const ISO2_TO_NAME = new Map(countries.map((country) => [country.cca2, country.name.common]));

export function countryCodeToLngLat(iso2: string): [number, number] | null {
  const entry = ISO2_TO_LL.get(iso2.toUpperCase());
  return entry ? [entry.lon, entry.lat] : null; // MapLibre expects [lng, lat]
}

type CountryNodeCount = { code: string; count: number };

export function countryCountsToGeoJSON(
  list: CountryNodeCount[]
): FeatureCollection<Point, { code: string; count: number }> {
  return {
    type: 'FeatureCollection',
    features: list
      .map(({ code, count }) => {
        const coordinates = countryCodeToLngLat(code);
        if (!coordinates) return null;
        return {
          type: 'Feature',
          properties: { code: code.toUpperCase(), count },
          geometry: { type: 'Point', coordinates }
        };
      })
      .filter(Boolean)
  } as FeatureCollection<Point, { code: string; count: number }>;
}

export function countryCodeToName(iso2: string): string | null {
  return ISO2_TO_NAME.get(iso2.toUpperCase()) ?? null;
}
