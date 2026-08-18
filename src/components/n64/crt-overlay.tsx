/**
 * A soft vignette painted over the whole app — `pointer-events: none`, lives
 * above the content but below nothing interactive. (An earlier pass also
 * added scanlines here; dropped because they read as literal lines across
 * the screen rather than a screen-filter texture.) The class itself is in
 * globals.css, where the reduced-motion query can switch it off.
 */
export function CrtOverlay() {
  return <div className="crt-vignette" aria-hidden />;
}
