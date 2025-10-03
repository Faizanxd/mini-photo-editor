export async function exportCurrentPageAsPNG(page, options = {}) {
  const scale = options.scale || 2;
  if (!page) throw new Error("No page to export");
  const outW = Math.round(page.w * scale);
  const outH = Math.round(page.h * scale);
  const off = document.createElement("canvas");
  off.width = outW;
  off.height = outH;
  const ctx = off.getContext("2d");
  ctx.save();
  ctx.scale(scale, scale);
  page.draw(ctx);
  ctx.restore();
  return new Promise((resolve) => {
    off.toBlob((blob) => resolve({ blob, canvas: off }));
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
