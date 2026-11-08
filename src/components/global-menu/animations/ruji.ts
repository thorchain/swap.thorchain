import tcyAnim from './TCY.json'

// Keep TCY's canvas, logo diameter, and hover animation; replace its artwork with RUJI.
const logoSize = 768
const logoScale = (150 / logoSize) * 100

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
    tcyAnim.layers[2]
  ]
}
