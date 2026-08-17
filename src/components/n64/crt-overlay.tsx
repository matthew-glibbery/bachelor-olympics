/**
 * Scanlines and a vignette, painted over the whole app.
 *
 * Both layers are `pointer-events: none` and live above the content but below
 * nothing interactive — they're purely a filter over the top. The classes
 * themselves are in globals.css, where the reduced-motion query can switch the
 * scanlines off for anyone who finds the shimmer unpleasant.
 */
export function CrtOverlay() {
  return (
    <>
      <div className="crt-vignette" aria-hidden />
      <div className="crt-overlay" aria-hidden />
    </>
  );
}
