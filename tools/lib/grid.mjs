export function generateGridSvg(config) {
  const {
    width = "350mm",
    height = "500mm",
    cols = 12,
    rows = 12,
    margin = 15,
    gutter = 4,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    overlay = false,
    useOffset = false,
  } = config;

  // Resolve margins
  const mt = marginTop !== undefined ? marginTop : margin;
  const mb = marginBottom !== undefined ? marginBottom : margin;
  const ml = marginLeft !== undefined ? marginLeft : margin;
  const mr = marginRight !== undefined ? marginRight : margin;

  // Parse dimensions
  const parseDim = (dim) => parseFloat(dim);
  const pageWmm = parseDim(width);
  const pageHmm = parseDim(height);

  const contentWmm = pageWmm - ml - mr;
  const contentHmm = pageHmm - mt - mb;

  const colWmm = (contentWmm - gutter * (cols - 1)) / cols;
  const rowHmm = contentHmm / rows;

  // Determine SVG dimensions and offsets
  const svgW = overlay ? contentWmm : pageWmm;
  const svgH = overlay ? contentHmm : pageHmm;
  const offsetX = overlay ? 0 : ml;
  const offsetY = overlay ? 0 : mt;

  // Generate SVG content
  const colRects = [];
  for (let i = 0; i < cols; i += 1) {
    const x = offsetX + i * (colWmm + gutter);
    colRects.push(
      `<rect x="${x}" y="${offsetY}" width="${colWmm}" height="${contentHmm}" fill="#00FFFF" fill-opacity="0.2" stroke="none"/>`
    );
  }

  const hLines = [];
  for (let i = 0; i <= rows; i += 1) {
    const y = offsetY + i * rowHmm;
    hLines.push(y);
  }

  let styleTop = "0";
  let styleLeft = "0";

  if (useOffset) {
    styleTop = `-${mt}mm`;
    styleLeft = `-${ml}mm`;
  } else if (overlay) {
    styleTop = `${mt}mm`;
    styleLeft = `${ml}mm`;
  }

  const pageBorder = overlay
    ? ""
    : `<rect x="0" y="0" width="${pageWmm}" height="${pageHmm}" fill="none" stroke="#000" stroke-width="1" stroke-dasharray="4"/>`;

  return `
<svg class="debug-grid" width="${svgW}mm" height="${svgH}mm" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="top: ${styleTop}; left: ${styleLeft};">
  ${pageBorder}
  <rect x="${offsetX}" y="${offsetY}" width="${contentWmm}" height="${contentHmm}" fill="none" stroke="#FF00FF" stroke-width="1"/>
  ${colRects.join("\n  ")}
  ${hLines
    .map(
      (y) =>
        `<line x1="${offsetX}" y1="${y}" x2="${offsetX + contentWmm}" y2="${y}" stroke="#000" stroke-opacity="0.2" stroke-width="0.5"/>`
    )
    .join("\n  ")}
</svg>
`;
}
