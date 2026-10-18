/** Extract complete sprites before fitting them into atlas cells. Generated sheets need not have an exact grid. */
export function extractSpriteComponents(image, { alphaThreshold = 32, minPixels = 1500, edgePadding = 2 } = {}) {
  const { width, height, data } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || data?.length !== width * height * 4) throw new Error('Invalid RGBA image.');
  if (!Number.isInteger(alphaThreshold) || alphaThreshold < 1 || alphaThreshold > 255 || !Number.isInteger(minPixels) || minPixels < 1 || !Number.isInteger(edgePadding) || edgePadding < 0 || edgePadding > 8) throw new Error('Invalid component extraction options.');
  const labels = new Int32Array(width * height), queue = new Int32Array(width * height), components = [];
  let nextId = 0;
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || data[start * 4 + 3] < alphaThreshold) continue;
    const id = ++nextId;
    let head = 0, tail = 1, minX = width, minY = height, maxX = -1, maxY = -1;
    queue[0] = start; labels[start] = id;
    while (head < tail) {
      const index = queue[head++], x = index % width, y = Math.floor(index / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const neighbor of [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, y > 0 ? index - width : -1, y < height - 1 ? index + width : -1]) {
        if (neighbor >= 0 && !labels[neighbor] && data[neighbor * 4 + 3] >= alphaThreshold) { labels[neighbor] = id; queue[tail++] = neighbor; }
      }
    }
    if (tail >= minPixels) components.push({ id, pixelCount: tail, coreBounds: { minX, minY, maxX, maxY }, bounds: { minX, minY, maxX, maxY } });
  }
  const retained = new Map(components.map(component => [component.id, component]));
  const owners = new Int32Array(labels.length);
  // Low-alpha noise can connect otherwise separate figures. Keep only the short antialias fringe nearest a real sprite.
  for (let index = 0; index < labels.length; index++) {
    if (retained.has(labels[index])) { owners[index] = labels[index]; continue; }
    if (!data[index * 4 + 3] || data[index * 4 + 3] >= alphaThreshold) continue;
    const x = index % width, y = Math.floor(index / width);
    let closest = edgePadding * edgePadding + 1, owner = 0;
    for (let dy = -edgePadding; dy <= edgePadding; dy++) for (let dx = -edgePadding; dx <= edgePadding; dx++) {
      const distance = dx * dx + dy * dy, nx = x + dx, ny = y + dy;
      if (distance >= closest || distance > edgePadding * edgePadding || nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const label = labels[ny * width + nx];
      if (retained.has(label)) { closest = distance; owner = label; }
    }
    if (owner) {
      owners[index] = owner;
      const bounds = retained.get(owner).bounds;
      bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x); bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
    }
  }
  return components.map(component => {
    const { minX, minY, maxX, maxY } = component.bounds;
    const cropWidth = maxX - minX + 1, cropHeight = maxY - minY + 1, pixels = Buffer.alloc(cropWidth * cropHeight * 4);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const source = y * width + x;
      if (owners[source] !== component.id) continue;
      pixels.set(data.subarray(source * 4, source * 4 + 4), ((y - minY) * cropWidth + x - minX) * 4);
    }
    const { id, ...result } = component;
    return { ...result, image: { width: cropWidth, height: cropHeight, data: pixels } };
  });
}

export function groupAnimationComponents(components, frameCounts) {
  if (!Array.isArray(frameCounts) || frameCounts.some(count => !Number.isInteger(count) || count <= 0)) throw new Error('Invalid animation frame counts.');
  const expected = frameCounts.reduce((sum, count) => sum + count, 0);
  if (components.length !== expected) throw new Error(`Expected ${expected} sprite components, got ${components.length}.`);
  const ordered = [...components].sort((a, b) => a.bounds.minY + a.bounds.maxY - b.bounds.minY - b.bounds.maxY);
  const rows = [];
  for (const component of ordered) {
    const bounds = component.coreBounds || component.bounds, center = (bounds.minY + bounds.maxY) / 2;
    const row = rows.at(-1);
    const previousCenter = row && row.reduce((sum, frame) => sum + (frame.bounds.minY + frame.bounds.maxY) / 2, 0) / row.length;
    const previousHeight = row && Math.max(...row.map(frame => frame.bounds.maxY - frame.bounds.minY + 1));
    if (!row || center - previousCenter > Math.min(previousHeight, bounds.maxY - bounds.minY + 1) / 2) rows.push([component]);
    else row.push(component);
  }
  if (rows.length !== frameCounts.length || rows.some((row, index) => row.length !== frameCounts[index])) throw new Error('Sprite row counts do not match the expected animation frame counts.');
  return rows.map(row => row.sort((a, b) => a.bounds.minX + a.bounds.maxX - b.bounds.minX - b.bounds.maxX));
}
