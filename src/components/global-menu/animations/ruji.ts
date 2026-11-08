import tcyAnim from './TCY.json'

// Keep TCY's canvas, logo diameter, and hover animation; use RUJI artwork and purple waves.
const logoSize = 768
const logoScale = (150 / logoSize) * 100
const waveLayer = structuredClone(tcyAnim.layers[2])
const waveStart = [140 / 255, 45 / 255, 244 / 255]
const waveEnd = [213 / 255, 52 / 255, 234 / 255]

for (const group of waveLayer.shapes) {
  for (const shape of group.it) {
    if (!('g' in shape) || !shape.g) continue
    const stops = shape.g.k.k
    // Recolor only RGB stops, preserving the gradient's opacity stops and animation.
    for (let index = 0; index < shape.g.p * 4; index += 4) {
      for (let channel = 0; channel < 3; channel++) {
        stops[index + channel + 1] = waveStart[channel] + (waveEnd[channel] - waveStart[channel]) * stops[index]
      }
    }
  }
}

export const rujiAnim = {
  ...tcyAnim,
  assets: [{ id: 'ruji-logo', w: logoSize, h: logoSize, u: '/', p: 'ruji.png', e: 0 }],
  layers: [
    {
      ty: 2,
      nm: 'RUJI',
      refId: 'ruji-logo',
      ind: 1,
      parent: 2,
      sr: 1,
      st: 0,
      ip: 0,
      op: tcyAnim.layers[0].op,
      ks: {
        a: { a: 0, k: [logoSize / 2, logoSize / 2, 0] },
        p: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [logoScale, logoScale, 100] },
        r: { a: 0, k: 0 },
        o: { a: 0, k: 100 }
      }
    },
    { ...tcyAnim.layers[1], shapes: [] },
    waveLayer
  ]
}
