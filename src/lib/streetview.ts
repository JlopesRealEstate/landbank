export type StreetViewLinks = {
  pano: string;
  streetview: string;
  earth: string;
  maps: string;
  directions: string;
};

/** Links oficiais do Google (funcionam sem chave de API). */
export function streetViewLinks(lat: number, lng: number, heading = 0): StreetViewLinks {
  const location = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return {
    pano: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${location}${
      heading ? `&heading=${Math.round(heading)}` : ""
    }`,
    streetview: `https://www.google.com/maps/place/${location}/@${location},3a,75y,90t/data=!3m1!1e3`,
    earth: `https://earth.google.com/web/@${location},300a,500d,35y,0h,0t,0r`,
    maps: `https://www.google.com/maps/search/?api=1&query=${location}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${location}`,
  };
}

export function hasGoogleKey(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}
