export function HomepageAmbientFlowField({
  albumId,
  accentColor,
  accentSecondaryColor,
}: {
  albumId: string;
  accentColor: string;
  accentSecondaryColor: string;
}) {
  return <div
    className="ad-ambient-flow"
    aria-hidden="true"
    data-flow-album-id={albumId}
    data-flow-accent={accentColor}
    data-flow-secondary-accent={accentSecondaryColor}
    data-flow-pointer-energy="0.0000"
    data-flow-vinyl-energy="0.0000"
  >
    <div className="ad-ambient-flow__palette">
      <span className="ad-ambient-flow__ambient" />
      <span className="ad-ambient-flow__rim" />
      <span className="ad-ambient-flow__edge ad-ambient-flow__edge--left" />
      <span className="ad-ambient-flow__edge ad-ambient-flow__edge--right" />
      <span className="ad-ambient-flow__edge ad-ambient-flow__edge--top" />
      <span className="ad-ambient-flow__edge ad-ambient-flow__edge--bottom" />
    </div>
    <span className="ad-ambient-flow__header-suppression" />
  </div>;
}
