// Catalog of the areas we have price data for, plus a map from every US state
// to the best available area, and centroids for offline geolocation.
// Area ids are EIA "duoarea" codes so the data file and the UI agree.

export const AREAS = {
  // U.S. average
  NUS: { name: 'U.S. average', kind: 'national', padd: 'NUS' },

  // Metros
  YBOS:  { name: 'Boston', kind: 'metro', padd: 'R10', lat: 42.36, lon: -71.06 },
  YORD:  { name: 'Chicago', kind: 'metro', padd: 'R20', lat: 41.88, lon: -87.63 },
  YCLE:  { name: 'Cleveland', kind: 'metro', padd: 'R20', lat: 41.50, lon: -81.69 },
  YDEN:  { name: 'Denver', kind: 'metro', padd: 'R40', lat: 39.74, lon: -104.99 },
  Y44HO: { name: 'Houston', kind: 'metro', padd: 'R30', lat: 29.76, lon: -95.37 },
  Y05LA: { name: 'Los Angeles', kind: 'metro', padd: 'R50', lat: 34.05, lon: -118.24 },
  YMIA:  { name: 'Miami', kind: 'metro', padd: 'R10', lat: 25.76, lon: -80.19 },
  Y35NY: { name: 'New York City', kind: 'metro', padd: 'R10', lat: 40.71, lon: -74.01 },
  Y05SF: { name: 'San Francisco', kind: 'metro', padd: 'R50', lat: 37.77, lon: -122.42 },
  Y48SE: { name: 'Seattle', kind: 'metro', padd: 'R50', lat: 47.61, lon: -122.33 },

  // States with their own EIA series
  SCA: { name: 'California', kind: 'state', padd: 'R50' },
  SCO: { name: 'Colorado', kind: 'state', padd: 'R40' },
  SFL: { name: 'Florida', kind: 'state', padd: 'R10' },
  SMA: { name: 'Massachusetts', kind: 'state', padd: 'R10' },
  SMN: { name: 'Minnesota', kind: 'state', padd: 'R20' },
  SNY: { name: 'New York', kind: 'state', padd: 'R10' },
  SOH: { name: 'Ohio', kind: 'state', padd: 'R20' },
  STX: { name: 'Texas', kind: 'state', padd: 'R30' },
  SWA: { name: 'Washington', kind: 'state', padd: 'R50' },

  // Regions (PADDs and East Coast sub-districts)
  R1X:   { name: 'New England', kind: 'region', padd: 'R10' },
  R1Y:   { name: 'Central Atlantic', kind: 'region', padd: 'R10' },
  R1Z:   { name: 'Lower Atlantic', kind: 'region', padd: 'R10' },
  R10:   { name: 'East Coast', kind: 'region', padd: 'R10' },
  R20:   { name: 'Midwest', kind: 'region', padd: 'R20' },
  R30:   { name: 'Gulf Coast', kind: 'region', padd: 'R30' },
  R40:   { name: 'Rocky Mountain', kind: 'region', padd: 'R40' },
  R50:   { name: 'West Coast', kind: 'region', padd: 'R50' },
  R5XCA: { name: 'West Coast (excl. California)', kind: 'region', padd: 'R50' },
};

// Fuel grades. `lead` names the wholesale series that leads pump prices;
// `outlook` names which EIA forecast family applies.
export const GRADES = {
  regular:  { name: 'Regular',  short: 'Regular',  product: 'EPMR',  lead: 'rbob', outlook: 'regular' },
  midgrade: { name: 'Midgrade', short: 'Midgrade', product: 'EPMM',  lead: 'rbob', outlook: 'regular' },
  premium:  { name: 'Premium',  short: 'Premium',  product: 'EPMP',  lead: 'rbob', outlook: 'regular' },
  diesel:   { name: 'Diesel',   short: 'Diesel',   product: 'EPD2D', lead: 'ulsd', outlook: 'diesel' },
};

export const KIND_LABELS = {
  metro: 'Metro areas',
  state: 'States',
  region: 'Regions',
  national: 'National',
};

// Every state (+DC) -> the most specific area we have data for, and a centroid
// for geolocation. Sub-district membership follows EIA's PADD definitions.
export const STATES = {
  AL: { name: 'Alabama', area: 'R30', lat: 32.81, lon: -86.79 },
  AK: { name: 'Alaska', area: 'R5XCA', lat: 61.37, lon: -152.40 },
  AZ: { name: 'Arizona', area: 'R5XCA', lat: 33.73, lon: -111.43 },
  AR: { name: 'Arkansas', area: 'R30', lat: 34.97, lon: -92.37 },
  CA: { name: 'California', area: 'SCA', lat: 36.12, lon: -119.68 },
  CO: { name: 'Colorado', area: 'SCO', lat: 39.06, lon: -105.31 },
  CT: { name: 'Connecticut', area: 'R1X', lat: 41.60, lon: -72.76 },
  DE: { name: 'Delaware', area: 'R1Y', lat: 39.32, lon: -75.51 },
  DC: { name: 'District of Columbia', area: 'R1Y', lat: 38.90, lon: -77.03 },
  FL: { name: 'Florida', area: 'SFL', lat: 27.77, lon: -81.69 },
  GA: { name: 'Georgia', area: 'R1Z', lat: 33.04, lon: -83.64 },
  HI: { name: 'Hawaii', area: 'R5XCA', lat: 21.09, lon: -157.50 },
  ID: { name: 'Idaho', area: 'R40', lat: 44.24, lon: -114.48 },
  IL: { name: 'Illinois', area: 'R20', lat: 40.35, lon: -88.99 },
  IN: { name: 'Indiana', area: 'R20', lat: 39.85, lon: -86.26 },
  IA: { name: 'Iowa', area: 'R20', lat: 42.01, lon: -93.21 },
  KS: { name: 'Kansas', area: 'R20', lat: 38.53, lon: -96.73 },
  KY: { name: 'Kentucky', area: 'R20', lat: 37.67, lon: -84.67 },
  LA: { name: 'Louisiana', area: 'R30', lat: 31.17, lon: -91.87 },
  ME: { name: 'Maine', area: 'R1X', lat: 44.69, lon: -69.38 },
  MD: { name: 'Maryland', area: 'R1Y', lat: 39.06, lon: -76.80 },
  MA: { name: 'Massachusetts', area: 'SMA', lat: 42.23, lon: -71.53 },
  MI: { name: 'Michigan', area: 'R20', lat: 43.33, lon: -84.54 },
  MN: { name: 'Minnesota', area: 'SMN', lat: 45.69, lon: -93.90 },
  MS: { name: 'Mississippi', area: 'R30', lat: 32.74, lon: -89.68 },
  MO: { name: 'Missouri', area: 'R20', lat: 38.46, lon: -92.29 },
  MT: { name: 'Montana', area: 'R40', lat: 46.92, lon: -110.45 },
  NE: { name: 'Nebraska', area: 'R20', lat: 41.13, lon: -98.27 },
  NV: { name: 'Nevada', area: 'R5XCA', lat: 38.31, lon: -117.06 },
  NH: { name: 'New Hampshire', area: 'R1X', lat: 43.45, lon: -71.56 },
  NJ: { name: 'New Jersey', area: 'R1Y', lat: 40.30, lon: -74.52 },
  NM: { name: 'New Mexico', area: 'R30', lat: 34.84, lon: -106.25 },
  NY: { name: 'New York', area: 'SNY', lat: 42.17, lon: -74.95 },
  NC: { name: 'North Carolina', area: 'R1Z', lat: 35.63, lon: -79.81 },
  ND: { name: 'North Dakota', area: 'R20', lat: 47.53, lon: -99.78 },
  OH: { name: 'Ohio', area: 'SOH', lat: 40.39, lon: -82.76 },
  OK: { name: 'Oklahoma', area: 'R20', lat: 35.57, lon: -96.93 },
  OR: { name: 'Oregon', area: 'R5XCA', lat: 44.57, lon: -122.07 },
  PA: { name: 'Pennsylvania', area: 'R1Y', lat: 40.59, lon: -77.21 },
  RI: { name: 'Rhode Island', area: 'R1X', lat: 41.68, lon: -71.51 },
  SC: { name: 'South Carolina', area: 'R1Z', lat: 33.86, lon: -80.95 },
  SD: { name: 'South Dakota', area: 'R20', lat: 44.30, lon: -99.44 },
  TN: { name: 'Tennessee', area: 'R20', lat: 35.75, lon: -86.69 },
  TX: { name: 'Texas', area: 'STX', lat: 31.05, lon: -97.56 },
  UT: { name: 'Utah', area: 'R40', lat: 40.15, lon: -111.86 },
  VT: { name: 'Vermont', area: 'R1X', lat: 44.05, lon: -72.71 },
  VA: { name: 'Virginia', area: 'R1Z', lat: 37.77, lon: -78.17 },
  WA: { name: 'Washington', area: 'SWA', lat: 47.40, lon: -121.49 },
  WV: { name: 'West Virginia', area: 'R1Z', lat: 38.49, lon: -80.95 },
  WI: { name: 'Wisconsin', area: 'R20', lat: 44.27, lon: -89.62 },
  WY: { name: 'Wyoming', area: 'R40', lat: 42.76, lon: -107.30 },
};

const METRO_SNAP_MILES = 75;

export function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Map a coordinate to an area id: nearest metro if close enough, else the
// area for the nearest state centroid. Returns { area, via, name }.
export function areaForCoords(lat, lon) {
  let best = null;
  for (const [id, a] of Object.entries(AREAS)) {
    if (a.kind !== 'metro') continue;
    const d = distanceMiles(lat, lon, a.lat, a.lon);
    if (!best || d < best.d) best = { id, d };
  }
  if (best && best.d <= METRO_SNAP_MILES) {
    return { area: best.id, via: 'metro', name: AREAS[best.id].name };
  }
  let state = null;
  for (const [code, s] of Object.entries(STATES)) {
    const d = distanceMiles(lat, lon, s.lat, s.lon);
    if (!state || d < state.d) state = { code, d };
  }
  const s = STATES[state.code];
  return { area: s.area, via: 'state', name: s.name };
}
