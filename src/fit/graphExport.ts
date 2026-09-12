/// <reference types="vite/client" />

import {
  exportPngSize,
  exportSizePixels,
  validateExportSizing,
  type ExportSizing,
} from "./exportSizing";

const SVG_NS = "http://www.w3.org/2000/svg";

// Copy presentation, never page layout rules. In particular, an external SVG
// must not inherit the app's viewport-dependent .fit-plot width and height.
const presentation = [
  "color",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "paint-order",
  "vector-effect",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "letter-spacing",
  "word-spacing",
  "text-anchor",
  "dominant-baseline",
  "alignment-baseline",
  "text-decoration",
  "shape-rendering",
  "text-rendering",
  "visibility",
  "display",
  "clip-rule",
] as const;

function frozenPlot(source: SVGSVGElement, index: number): SVGSVGElement {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const originals = [source, ...source.querySelectorAll<SVGElement>("*")];
  const copies = [clone, ...clone.querySelectorAll<SVGElement>("*")];
  originals.forEach((element, i) => {
    const copy = copies[i];
    if (element.classList.contains("fit-selection-box")) {
      copy.remove();
      return;
    }
    const styles = getComputedStyle(element);
    copy.removeAttribute("style");
    copy.removeAttribute("class");
    copy.removeAttribute("tabindex");
    for (const attribute of [...copy.attributes]) {
      if (attribute.name.startsWith("on")) copy.removeAttribute(attribute.name);
    }
    for (const property of presentation) {
      const value = styles.getPropertyValue(property);
      if (value) copy.style.setProperty(property, value);
    }
    // Plot geometry is already explicit in its SVG attributes. Keep those
    // values: computed CSS geometry rounds coordinates before serializing.
  });
  clone
    .querySelectorAll("script,style,foreignObject")
    .forEach((node) => node.remove());
  // Keep every clip reference local and unique in the combined SVG.
  const ids = new Map<string, string>();
  for (const element of [
    clone,
    ...clone.querySelectorAll<SVGElement>("[id]"),
  ]) {
    if (element.id) {
      const id = `graph-${index}-${element.id}`;
      ids.set(element.id, id);
      element.id = id;
    }
  }
  for (const element of [clone, ...clone.querySelectorAll<SVGElement>("*")]) {
    for (const attribute of [...element.attributes]) {
      const value = attribute.value.replace(
        /url\(\s*["']?[^()"']*#([^()"']+)["']?\s*\)/g,
        (match, id: string) => (ids.has(id) ? `url(#${ids.get(id)})` : match),
      );
      if (value !== attribute.value)
        element.setAttribute(attribute.name, value);
    }
  }
  clone.setAttribute("overflow", "hidden");
  return clone;
}

function combinedGraph(plots: SVGSVGElement[], name: string) {
  if (!plots.length) throw new Error("No graph is available to export.");
  const parts = plots.map((plot, index) => {
    const box = plot.viewBox.baseVal;
    const width = box.width || plot.clientWidth;
    const height = box.height || plot.clientHeight;
    if (!(width > 0 && height > 0))
      throw new Error("The graph has no drawable area.");
    const frame = plot.querySelector<SVGRectElement>(".fit-plot-frame");
    return {
      clone: frozenPlot(plot, index),
      width,
      height,
      frameLeft: frame ? frame.x.baseVal.value - box.x : 0,
      frameWidth: frame?.width.baseVal.value || width,
    };
  });
  const target = parts[0];
  const placed = parts.map((part) => {
    const scale = target.frameWidth / part.frameWidth;
    return { ...part, scale, x: target.frameLeft - part.frameLeft * scale };
  });
  const left = Math.min(0, ...placed.map((part) => part.x));
  const width =
    Math.max(...placed.map((part) => part.x + part.width * part.scale)) - left;
  const height = placed.reduce(
    (sum, part) => sum + part.height * part.scale,
    0,
  );
  const root = document.createElementNS(SVG_NS, "svg");
  root.setAttribute("xmlns", SVG_NS);
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = name;
  root.append(title);
  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", "white");
  root.append(background);
  let y = 0;
  for (const part of placed) {
    part.clone.setAttribute("x", String(part.x - left));
    part.clone.setAttribute("y", String(y));
    part.clone.setAttribute("width", String(part.width * part.scale));
    part.clone.setAttribute("height", String(part.height * part.scale));
    root.append(part.clone);
    y += part.height * part.scale;
  }
  return { root, width, height };
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Canvas encoders normally write 96 dpi. Supply the chosen physical resolution
// so image editors and publication systems recover the requested figure size.
async function pngWithResolution(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const physical = new Uint8Array(21);
  const view = new DataView(physical.buffer);
  view.setUint32(0, 9);
  physical.set([112, 72, 89, 115], 4); // pHYs
  const pixelsPerMetre = Math.round(dpi / 0.0254);
  view.setUint32(8, pixelsPerMetre);
  view.setUint32(12, pixelsPerMetre);
  physical[16] = 1; // metre units
  let crc = 0xffffffff;
  for (const byte of physical.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts: BlobPart[] = [bytes.slice(0, 8)];
  const source = new DataView(bytes.buffer);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = source.getUint32(offset);
    const end = offset + length + 12;
    if (end > bytes.length) throw new Error("The PNG image is incomplete.");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type !== "pHYs") parts.push(bytes.slice(offset, end));
    if (type === "IHDR") parts.push(physical);
    offset = end;
  }
  return new Blob(parts, { type: "image/png" });
}

let pdfFont: Promise<string> | undefined;
async function loadPdfFont(): Promise<string> {
  if (!pdfFont) {
    pdfFont = (async () => {
      const { default: url } =
        await import("dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url");
      const response = await fetch(url);
      if (!response.ok)
        throw new Error("The bundled PDF font could not be loaded.");
      const buffer = await response.arrayBuffer();
      // svg2pdf measures text in the browser before writing vector PDF text.
      const font = await new FontFace("DataToolExport", buffer).load();
      document.fonts.add(font);
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      }
      return btoa(binary);
    })().catch((error) => {
      pdfFont = undefined;
      throw error;
    });
  }
  return pdfFont;
}

/** Download a self-contained figure; all conversion stays in the browser. */
export async function exportPlotGraph(
  plots: SVGSVGElement[],
  name: string,
  format: "svg" | "png" | "pdf",
  sizing?: ExportSizing,
): Promise<void> {
  if (sizing) {
    const error = validateExportSizing(sizing);
    if (error) throw new Error(error);
  }
  const pngSize = sizing && format === "png" ? exportPngSize(sizing) : null;
  await document.fonts.ready;
  const { root, width, height } = combinedGraph(plots, name);
  const physicalSize = sizing ? exportSizePixels(sizing) : { width, height };
  const fileName =
    name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "fit-graph";
  if (format === "pdf") {
    const [{ jsPDF }, { svg2pdf }, font] = await Promise.all([
      import("jspdf"),
      import("svg2pdf.js"),
      loadPdfFont(),
    ]);
    const pdfWidth = physicalSize.width * 0.75,
      pdfHeight = physicalSize.height * 0.75;
    const pdf = new jsPDF({
      unit: "pt",
      format: [pdfWidth, pdfHeight],
      orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
      compress: true,
      putOnlyUsedFonts: true,
    });
    pdf.addFileToVFS("DataToolExport.ttf", font);
    pdf.addFont("DataToolExport.ttf", "DataToolExport", "normal");
    for (const text of root.querySelectorAll<SVGElement>("text,tspan")) {
      text.style.fontFamily = "DataToolExport";
      text.style.fontStyle = "normal";
      text.style.fontWeight = "normal";
    }
    pdf.setProperties({ title: name, creator: "Data Tool 2027" });
    await svg2pdf(root, pdf, {
      x: 0,
      y: 0,
      width: pdfWidth,
      height: pdfHeight,
      loadExternalStyleSheets: false,
      loadImages: false,
    });
    download(pdf.output("blob"), `${fileName}.pdf`);
    return;
  }
  if (sizing) {
    root.setAttribute("width", `${sizing.widthMm}mm`);
    root.setAttribute("height", `${sizing.heightMm}mm`);
  }
  const source = new XMLSerializer().serializeToString(root);
  const svg = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  if (format === "svg") {
    download(svg, `${fileName}.svg`);
    return;
  }
  const url = URL.createObjectURL(svg);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(
      3,
      Math.sqrt(32_000_000 / (width * height)),
      16384 / Math.max(width, height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = pngSize?.width ?? Math.ceil(width * scale);
    canvas.height = pngSize?.height ?? Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot create PNG images.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!png) throw new Error("The PNG image could not be encoded.");
    download(
      sizing ? await pngWithResolution(png, sizing.pngDpi) : png,
      `${fileName}.png`,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
