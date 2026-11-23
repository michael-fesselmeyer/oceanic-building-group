import { describe, expect, it } from 'vitest';
import {
  MAP_BOUNDS,
  TOWN_BOUNDS,
  createProjection,
  isWithin,
  mapOutlines,
  milesToUnits,
  pathData,
  placeTowns,
  type Box,
  type MapTown,
} from '../../src/lib/areas-map';
import { COASTLINE, INTRACOASTAL, LOXAHATCHEE } from '../../src/lib/coast-geography';

const box = { west: -80.2, south: 26.8, east: -80.0, north: 27.0 };

describe('createProjection', () => {
  const projection = createProjection(box, 300);

  it('puts the north-west corner at the origin and the south-east corner at the far corner', () => {
    expect(projection.project([box.west, box.north])).toEqual({ x: 0, y: 0 });
    const far = projection.project([box.east, box.south]);
    expect(far.x).toBeCloseTo(300, 6);
    expect(far.y).toBeCloseTo(projection.height, 6);
  });

  it('shortens longitude by the cosine of the middle latitude', () => {
    const squeeze = Math.cos((26.9 * Math.PI) / 180);
    const origin = projection.project([-80.1, 26.9]);
    const east = projection.project([-80.0, 26.9]);
    const north = projection.project([-80.1, 27.0]);
    expect(east.x - origin.x).toBeCloseTo((origin.y - north.y) * squeeze, 6);
    expect(projection.height / projection.width).toBeCloseTo(1 / squeeze, 6);
  });

  it('keeps north up and east to the right', () => {
    const a = projection.project([-80.1, 26.9]);
    expect(projection.project([-80.1, 26.95]).y).toBeLessThan(a.y);
    expect(projection.project([-80.05, 26.9]).x).toBeGreaterThan(a.x);
  });
});

describe('isWithin and the town bounds', () => {
  it('accepts points inside or on the edge and refuses points outside', () => {
    expect(isWithin(box, 26.9, -80.1)).toBe(true);
    expect(isWithin(box, 27.0, -80.2)).toBe(true);
    expect(isWithin(box, 27.01, -80.1)).toBe(false);
    expect(isWithin(box, 26.9, -79.99)).toBe(false);
    // A longitude written without its minus sign is far outside.
    expect(isWithin(TOWN_BOUNDS, 26.9342, 80.0942)).toBe(false);
  });

  it('keeps every town a margin inside the drawn area', () => {
    expect(TOWN_BOUNDS.west).toBeGreaterThan(MAP_BOUNDS.west);
    expect(TOWN_BOUNDS.east).toBeLessThan(MAP_BOUNDS.east);
    expect(TOWN_BOUNDS.south).toBeGreaterThan(MAP_BOUNDS.south);
    expect(TOWN_BOUNDS.north).toBeLessThan(MAP_BOUNDS.north);
  });

  it('covers northern Palm Beach and southern Martin counties', () => {
    // Commonly published centers of the ends of the service area.
    expect(isWithin(TOWN_BOUNDS, 27.07, -80.14)).toBe(true); // Hobe Sound
    expect(isWithin(TOWN_BOUNDS, 26.65, -80.27)).toBe(true); // Wellington
    expect(isWithin(TOWN_BOUNDS, 27.2, -80.25)).toBe(false); // Stuart, farther north
    expect(isWithin(TOWN_BOUNDS, 26.36, -80.08)).toBe(false); // Boca Raton, farther south
  });
});

describe('geography', () => {
  const inside = ([longitude, latitude]: readonly [number, number]) =>
    isWithin(MAP_BOUNDS, latitude, longitude);

  it('runs the coastline from the north edge of the map to the south edge', () => {
    expect(COASTLINE[0]![1]).toBe(MAP_BOUNDS.north);
    expect(COASTLINE.at(-1)![1]).toBe(MAP_BOUNDS.south);
    expect(COASTLINE[0]![0]).toBeGreaterThan(MAP_BOUNDS.west);
  });

  it('stays inside the map', () => {
    expect(COASTLINE.every(inside)).toBe(true);
    expect(INTRACOASTAL.flat().every(inside)).toBe(true);
    expect(LOXAHATCHEE.flat().every(inside)).toBe(true);
  });

  it('draws the Intracoastal Waterway and the river as closed shapes', () => {
    expect(INTRACOASTAL.length).toBeGreaterThan(0);
    expect(LOXAHATCHEE.length).toBeGreaterThan(0);
    const outlines = mapOutlines(createProjection(MAP_BOUNDS));
    expect(outlines.intracoastal).toMatch(/^M[\d.]+ [\d.]+(L[\d.]+ [\d.]+)+Z/);
    expect(outlines.river).toMatch(/Z$/);
    expect(outlines.land).toMatch(/Z$/);
    expect(outlines.coast).not.toMatch(/Z$/);
  });
});

describe('pathData', () => {
  it('moves to the first point, draws to the rest and rounds to a tenth', () => {
    const projection = createProjection(box, 300);
    const path = pathData(
      [
        [-80.2, 27.0],
        [-80.1, 26.9],
      ],
      projection,
      false,
    );
    const middle = projection.project([-80.1, 26.9]);
    expect(path).toBe(`M0 0L${Math.round(middle.x * 10) / 10} ${Math.round(middle.y * 10) / 10}`);
    expect(pathData([[-80.2, 27.0]], projection, true)).toBe('M0 0Z');
  });
});

describe('milesToUnits', () => {
  it('measures miles along the north-south axis', () => {
    const projection = createProjection(box, 300);
    // 5 miles is about 8.05 km, and a degree of latitude about 111.2 km.
    expect(milesToUnits(5, projection)).toBeCloseTo((8.04672 / 111.2) * projection.scale, 6);
  });
});

describe('placeTowns', () => {
  const projection = createProjection(box, 300);
  const town = (name: string, latitude: number, longitude: number, count = 0): MapTown => ({
    name,
    href: `/areas/${name.toLowerCase().replace(/ /g, '-')}/`,
    latitude,
    longitude,
    count,
  });
  const overlap = (a: Box, b: Box) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  it('labels a town to the right of its mark by default', () => {
    const [placed] = placeTowns([town('Example Town', 26.9, -80.15)], projection);
    expect(placed!.side).toBe('right');
    expect(placed!.labelX).toBeGreaterThan(placed!.x);
  });

  it('moves the label to the left when the right would run off the map', () => {
    const [placed] = placeTowns([town('Example Shores', 26.9, -80.01)], projection);
    expect(placed!.side).toBe('left');
    expect(placed!.box.right).toBeLessThan(placed!.x);
  });

  it('moves a label to the left when it would cover a label already placed', () => {
    // The second town's label would run over the first town's mark.
    const placed = placeTowns(
      [town('Example Town', 26.9, -80.05), town('Example Parkland', 26.899, -80.08)],
      createProjection(box, 600),
    );
    expect(placed[0]!.side).toBe('right');
    expect(placed[1]!.side).toBe('left');
    expect(overlap(placed[0]!.box, placed[1]!.box)).toBe(false);
  });

  it('makes room for the count line under the name', () => {
    const [without] = placeTowns([town('Example Town', 26.9, -80.15)], projection);
    const [withCount] = placeTowns([town('Example Town', 26.9, -80.15, 3)], projection);
    expect(withCount!.box.bottom).toBeGreaterThan(without!.box.bottom);
  });

  it('keeps the order the towns were given in', () => {
    const towns = [town('South Example', 26.85, -80.1), town('North Example', 26.95, -80.1)];
    expect(placeTowns(towns, projection).map((placed) => placed.name)).toEqual([
      'South Example',
      'North Example',
    ]);
  });
});
