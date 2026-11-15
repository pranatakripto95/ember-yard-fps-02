// Ember Yard — the look, in one place.
// Six values plus one accent hue. Lighting does the rest, so no other
// colour appears anywhere in the game code. The same names are the CSS
// custom properties in index.html.
export const PALETTE = {
  canvas: '#14161a',
  surface: '#1e2228',
  hairline: '#2c323a',
  ink: '#e9e6df',
  muted: '#98a0a8',
  accent: '#f0a830',
};

export function shade(name) {
  return PALETTE[name];
}
