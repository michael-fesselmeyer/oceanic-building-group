// The map on /areas/: projection, outlines and label placement. Everything is worked out at
// build time and drawn as inline SVG; nothing runs in the browser. Kept free of Astro imports
// so unit tests can use it.
import { COASTLINE, INTRACOASTAL, LOXAHATCHEE, MAP_BOUNDS, type LonLat } from './coast-geography';
import { projectCountLabel } from './towns';

export { MAP_BOUNDS };

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Where a town may be placed: northern Palm Beach and southern Martin counties, a margin inside
 * the drawn area so a mark never sits on the edge. The content schema refuses a town outside it.
 */
export const TOWN_BOUNDS: Bounds = { west: -80.3, south: 26.62, east: -80.03, north: 27.1 };

/** Width of the drawing in SVG units. Text sizes are CSS pixels in the same units. */
export const MAP_WIDTH = 400;

/** Kilometres in one degree of latitude, near enough for a scale bar at this latitude. */
const KM_PER_DEGREE = 111.2;
const KM_PER_MILE = 1.609344;

export interface Point {
  x: number;
  y: number;
}

export interface Projection {
  width: number;
  height: number;
  /** SVG units per degree of latitude. */
  scale: number;
  project(point: LonLat): Point;
}

/**
 * Equirectangular projection for a small area: longitude is shortened by the cosine of the
 * middle latitude so distances east and north look the same, and north is up.
 */
export function createProjection(bounds: Bounds, width: number = MAP_WIDTH): Projection {
  const middle = ((bounds.north + bounds.south) / 2) * (Math.PI / 180);
  const squeeze = Math.cos(middle);
  const scale = width / ((bounds.east - bounds.west) * squeeze);
  return {
    width,
    height: (bounds.north - bounds.south) * scale,
    scale,
    project: ([longitude, latitude]) => ({
      x: (longitude - bounds.west) * squeeze * scale,
      y: (bounds.north - latitude) * scale,
    }),
  };
}

/** True when the point is inside the bounds, edges included. */
export function isWithin(bounds: Bounds, latitude: number, longitude: number): boolean {
  return (
    latitude >= bounds.south &&
    latitude <= bounds.north &&
    longitude >= bounds.west &&
    longitude <= bounds.east
  );
}

const round = (value: number) => Math.round(value * 10) / 10;

/** An SVG path through the points, closed when `closed` is set. */
export function pathData(
  points: readonly LonLat[],
  projection: Projection,
  closed: boolean,
): string {
  const steps = points.map((point, index) => {
    const { x, y } = projection.project(point);
    return `${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
  });
  return steps.join('') + (closed ? 'Z' : '');
}

export interface MapOutlines {
  /** The land, closed along the west edge of the map. The sea is the background. */
  land: string;
  /** The shore alone, for the coastline stroke. */
  coast: string;
  intracoastal: string;
  river: string;
}

export function mapOutlines(projection: Projection, bounds: Bounds = MAP_BOUNDS): MapOutlines {
  const land: LonLat[] = [...COASTLINE, [bounds.west, bounds.south], [bounds.west, bounds.north]];
  const rings = (list: readonly (readonly LonLat[])[]) =>
    list.map((ring) => pathData(ring, projection, true)).join('');
  return {
    land: pathData(land, projection, true),
    coast: pathData(COASTLINE, projection, false),
    intracoastal: rings(INTRACOASTAL),
    river: rings(LOXAHATCHEE),
  };
}

/** Length in SVG units of a scale bar for the given number of miles. */
export function milesToUnits(miles: number, projection: Projection): number {
  return ((miles * KM_PER_MILE) / KM_PER_DEGREE) * projection.scale;
}

export interface MapTown {
  name: string;
  href: string;
  latitude: number;
  longitude: number;
  /** Portfolio projects in the town; a count line is shown only above zero. */
  count: number;
}

export interface LabelStyle {
  /** Size of the town name in SVG units. */
  nameSize: number;
  /** Size of the count line. */
  countSize: number;
  /** Gap between the mark and the label. */
  gap: number;
  /** Average glyph width as a share of the size, for estimating label widths. */
  glyphWidth: number;
}

/** Matches --text-sm and --text-xs, the sizes the map's labels are drawn at. */
export const LABEL_STYLE: LabelStyle = { nameSize: 15, countSize: 13, gap: 12, glyphWidth: 0.56 };

/** The name's baseline sits this share of its size below the mark, so the name centers on it. */
export const NAME_DROP = 0.32;
/** The count line's baseline sits this many of its sizes below the name's. */
export const COUNT_LEADING = 1.25;

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlacedTown extends MapTown, Point {
  side: 'right' | 'left';
  /** Where the label's text starts (right side) or ends (left side). */
  labelX: number;
  /** Estimated outline of the label, for collision checks. */
  box: Box;
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function labelBox(town: MapTown, at: Point, side: 'right' | 'left', style: LabelStyle): Box {
  const lines = [
    town.name.length * style.nameSize,
    town.count > 0 ? projectCountLabel(town.count).length * style.countSize : 0,
  ];
  const width = Math.max(...lines) * style.glyphWidth;
  // A line of text takes about its full size above the baseline and a third below it, as the
  // browser measures it, so labels are kept that far apart.
  const baseline = at.y + style.nameSize * NAME_DROP;
  const top = baseline - style.nameSize;
  const bottom =
    town.count > 0
      ? baseline + style.countSize * (COUNT_LEADING + 0.35)
      : baseline + style.nameSize * 0.35;
  return side === 'right'
    ? { left: at.x + style.gap, right: at.x + style.gap + width, top, bottom }
    : { left: at.x - style.gap - width, right: at.x - style.gap, top, bottom };
}

/**
 * Puts each town on the map with its label to the right of the mark, or to the left when the
 * right would run off the map or into a label already placed. Towns are placed north to south.
 */
export function placeTowns(
  towns: readonly MapTown[],
  projection: Projection,
  style: LabelStyle = LABEL_STYLE,
): PlacedTown[] {
  const placed: PlacedTown[] = [];
  const marks = towns.map((town) => projection.project([town.longitude, town.latitude]));
  const order = towns
    .map((town, index) => ({ town, at: marks[index]! }))
    .sort((a, b) => a.at.y - b.at.y);

  for (const { town, at } of order) {
    const fits = (box: Box) =>
      box.left >= 0 &&
      box.right <= projection.width &&
      !placed.some((other) => overlaps(box, other.box)) &&
      !marks.some(
        (mark) =>
          mark !== at &&
          overlaps(box, {
            left: mark.x - 5,
            right: mark.x + 5,
            top: mark.y - 5,
            bottom: mark.y + 5,
          }),
      );
    const right = labelBox(town, at, 'right', style);
    const left = labelBox(town, at, 'left', style);
    const side = fits(right) || !fits(left) ? 'right' : 'left';
    placed.push({
      ...town,
      ...at,
      side,
      labelX: side === 'right' ? at.x + style.gap : at.x - style.gap,
      box: side === 'right' ? right : left,
    });
  }
  // Back in the order the towns were given, so the map's links follow the list below it.
  return towns.map((town) => placed.find((entry) => entry.href === town.href)!);
}
