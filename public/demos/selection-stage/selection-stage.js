/*!
 * Selection Stage FX — Shifted Shape FX
 * A design-tool hero: floating layers get a selection frame, and every layer has its own
 * hover effect (3D tilt, fluid logo distortion, liquid ripples, cloth, frame sequence).
 * Plain JS, no dependencies. WebGL2 for the fluid, liquid and cloth layers.
 */

const SSFX_DEFAULTS = {
    background: "#0B0B0D",
    textColor: "#F4F2EE",
    selectionColor: "#3D7BFF",
    guideColor: "#FF3EA5",
    radius: 10,
    // centre
    heading: "Brands that\nshift shape.",
    subheading: "",
    subheadingStyle: null,
    // a logo (SVG / PNG / WebP) in place of the heading text; the heading text becomes its label
    headingImage: null,
    headingImageWidth: 46, // % of the stage width
    headingImageMaxWidth: 880, // px
    headingImageMobileWidth: 82, // % of the stage width on small screens
    headingFx: { effect: "fluid", strength: 0.55 }, // "fluid" = logo distortion on hover, "none" = still
    headingTag: "h1",
    headingStyle: null, // object of CSS properties, e.g. { fontFamily: "…", fontSize: "96px" }
    content: null, // replaces the heading: an element or an HTML string
    button: {
        show: true,
        text: "keep scrolling.. scrolling..",
        icon: "music", // music | arrow | arrow-up-right | play | plus | none
        link: "",
        newTab: false,
        size: 150,
        background: "", // empty = selectionColor
        color: "#FFFFFF",
        spin: 14, // seconds per rotation
        arrow: true, // small bouncing arrow under the button
    },
    gap: 34,
    // layout: "board" = an Affinity-style board that drifts opposite the cursor;
    // "classic" = the original Selection Stage (layers stack into a grid on mobile)
    mode: "board",
    board: {
        range: [0.3, 0.2], // how far the board shifts at the edges, as a share of the stage width / height
        ease: 2.6, // how quickly it follows (lower = floatier)
        depth: 0.25, // layers move at slightly different speeds
        invert: true, // move opposite to the cursor
        minBasis: 720, // layer widths are % of the stage width, clamped to this range (px)
        maxBasis: 1680,
        mobileScale: 1.15,
        idleDrift: true, // drift slowly on touch screens
        holdOnHover: 0.12, // while a thumb is hovered the board follows at this share of its speed (0 = stops, 1 = no hold)
        returnOnLeave: false,
        releaseTime: 1.1, // s: after a hover the board eases back into following the cursor
    },
    intro: {
        drop: true,
        delay: 0.15,
        stagger: 0.07,
        bounce: 0.4,
        speed: 9,
        spin: 14,
    },
    backdrop: {
        style: "lines", // lines | columns | grid | dots | gridDots | artboard | none
        size: 64,
        color: "", // empty = the text colour, faded
        opacity: 0.08,
        parallax: 0.35,
        // artboard only
        label: "Artboard 1",
        artboardColor: "",
        pasteboard: "",
        artboardWidth: 74,
        artboardHeight: 78,
    },
    contentAbove: true, // heading sits above the thumbs (pointer passes through it)
    bleed: false, // extend under a sidebar that pads the page (Framer's #main padding-left)
    showEffectLabel: false,
    tagStyle: "pill", // "pill" = icon + name in one label; "badge" = a KIND badge (cfg.kind, e.g. PIXEL) + the name
    showSize: true, // the W × H label under the frame
    // the selection frame follows a thumb's rounded corners: "auto" = the corner radius, or the
    // rounded corners of a cut-out PNG; "square" = always a plain rectangle; a number = that radius (px)
    frameCorners: "auto",
    // behaviour
    drag: true,
    resize: true, // drag the frame's handles to resize a thumb (mouse / pen)
    minSize: 56, // px, smallest a thumb can be resized to
    dragOnTouch: false,
    snap: true,
    mobileBreakpoint: 760,
    interactive: true, // false = static render (Framer canvas, thumbnails)
    staticFrameLayer: 0, // layer that shows the frame in static mode (-1 = none)
    maxDpr: 2,
    // effect settings
    tilt: { angle: 14, parallax: 6, glare: 0.35 },
    fluid: {
        colors: ["#3D7BFF", "#FF3EA5", "#FFB23D", "#3DFFC8"],
        distortion: 0.15,
        radius: 0.11,
        cycle: 0.12,
        halo: 0.12,
    },
    liquid: {
        grayscale: true,
        refraction: 0.035,
        radius: 0.035,
        damping: 0.985,
    },
    cloth: { pin: "top", wind: 0.35, stiffness: 1, push: 1, shading: 0.55 }, // shading: fold light & shadow, 0 = flat
    sequence: { fps: 6, speed: 1, pauseOnHover: true },
    layers: null, // null = the default set below
}

const SSFX_DEFAULT_LAYERS = [
    {
        effect: "tilt",
        name: "poster.png",
        x: 5,
        y: 9,
        width: 17,
        aspect: 0.78,
        rotation: -3,
    },
    {
        effect: "sequence",
        name: "brandmarks.gif",
        x: 29,
        y: 5,
        width: 10,
        aspect: 1,
        rotation: 2,
    },
    {
        effect: "liquid",
        name: "dunes.jpg",
        x: 8,
        y: 61,
        width: 21,
        aspect: 1.38,
        rotation: 2,
    },
    {
        effect: "cloth",
        name: "banner.png",
        x: 74,
        y: 7,
        width: 19,
        aspect: 0.82,
        rotation: 0,
    },
    {
        effect: "fluid",
        name: "wordmark.svg",
        x: 70,
        y: 63,
        width: 22,
        aspect: 1.75,
        rotation: 0,
    },
]

// The board: x / y are % of the stage (beyond 0–100 = off screen until the board drifts there),
// width is % of the stage width (clamped by board.minBasis / maxBasis)
const SSFX_BOARD_LAYERS = [
    {
        effect: "tilt",
        name: "poster.png",
        art: "poster",
        x: 3,
        y: 6,
        width: 18,
        aspect: 0.78,
    },
    {
        effect: "sequence",
        name: "brandmarks.gif",
        x: 30,
        y: -4,
        width: 11.5,
        aspect: 1,
    },
    {
        effect: "bend",
        name: "swiss-grid.png",
        art: "swiss",
        x: 61,
        y: -15,
        width: 16,
        aspect: 0.75,
    },
    {
        effect: "cloth",
        name: "banner.png",
        art: "cloth",
        x: 83,
        y: 7,
        width: 17.5,
        aspect: 0.82,
    },
    {
        effect: "liquid",
        name: "dunes.jpg",
        art: "photo",
        x: -7,
        y: 58,
        width: 22,
        aspect: 1.38,
    },
    {
        effect: "fluid",
        name: "wordmark.svg",
        art: "wordmark",
        x: 70,
        y: 68,
        width: 22,
        aspect: 1.75,
    },
    {
        effect: "tilt",
        name: "type-specimen.png",
        art: "type",
        x: 22,
        y: 78,
        width: 14,
        aspect: 1,
        strength: 0.75,
    },
    {
        effect: "bend",
        name: "arch.png",
        art: "arch",
        x: 104,
        y: 42,
        width: 17,
        aspect: 0.78,
    },
    {
        effect: "tilt",
        name: "halftone.png",
        art: "dots",
        x: -30,
        y: 12,
        width: 15.5,
        aspect: 0.8,
        strength: 1.3,
    },
    {
        effect: "cloth",
        name: "stripes.png",
        art: "stripes",
        x: 44,
        y: 102,
        width: 18,
        aspect: 1.25,
        pin: "corners",
    },
    {
        effect: "tilt",
        name: "night.jpg",
        art: "night",
        x: 116,
        y: -12,
        width: 18,
        aspect: 1.3,
        strength: 0.85,
    },
    {
        effect: "tilt",
        name: "shapes.png",
        art: "shapes",
        x: -26,
        y: 90,
        width: 14,
        aspect: 1,
        strength: 1.1,
    },
]

const SSFX_LABELS = {
    tilt: "3D",
    fluid: "Fluid",
    liquid: "Liquid",
    cloth: "Cloth",
    bend: "Bend",
    sequence: "Loop",
    image: "Image",
}

/* ------------------------------------------------------------------ utils */

const ssfxClamp = (v, a, b) => Math.min(b, Math.max(a, v))
const ssfxEl = (tag, cls, parent) => {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (parent) parent.appendChild(e)
    return e
}
const ssfxRgb = (hex) => {
    let h = String(hex || "#000").trim()
    const m = h.match(/rgba?\(([^)]+)\)/)
    if (m) {
        const p = m[1].split(",").map((s) => parseFloat(s))
        return [p[0] / 255, p[1] / 255, p[2] / 255]
    }
    h = h.replace("#", "")
    if (h.length === 3)
        h = h
            .split("")
            .map((c) => c + c)
            .join("")
    const n = parseInt(h.slice(0, 6), 16) || 0
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const ssfxMerge = (a, b) => {
    const out = Array.isArray(a) ? a.slice() : { ...a }
    if (!b) return out
    for (const k of Object.keys(b)) {
        const v = b[k]
        if (v === undefined) continue
        if (
            v &&
            typeof v === "object" &&
            !Array.isArray(v) &&
            !(v instanceof Node) &&
            a &&
            typeof a[k] === "object" &&
            a[k] &&
            !Array.isArray(a[k])
        )
            out[k] = ssfxMerge(a[k], v)
        else out[k] = v
    }
    return out
}
// a CSS colour as premultiplied [r, g, b, a] for the shaders (transparent when empty)
const ssfxBg = (c) => {
    if (!c || c === "transparent") return [0, 0, 0, 0]
    const m = String(c).match(/rgba\(([^)]+)\)/)
    const a = m ? parseFloat(m[1].split(",")[3] ?? "1") : 1
    const [r, g, b] = ssfxRgb(c)
    return [r * a, g * a, b * a, a]
}
const ssfxLum = (c) => {
    const [r, g, b] = ssfxRgb(c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ssfxReduced = () =>
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
const ssfxLoadImage = (src) =>
    new Promise((resolve, reject) => {
        if (
            src &&
            typeof src === "object" &&
            (src.tagName === "CANVAS" || src.tagName === "IMG")
        ) {
            if (src.tagName === "CANVAS" || src.complete) return resolve(src)
            src.onload = () => resolve(src)
            src.onerror = reject
            return
        }
        const img = new Image()
        if (!/^(data|blob):/.test(src)) img.crossOrigin = "anonymous"
        img.decoding = "async"
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error("Image failed to load: " + src))
        img.src = src
    })
// width / height of a picture; SVGs sized in % report no real size, so read their viewBox
const ssfxAspect = async (src, img) => {
    const nw = img.naturalWidth || img.width,
        nh = img.naturalHeight || img.height
    const svg = /\.svg(\?|#|$)/i.test(src) || /^data:image\/svg/i.test(src)
    if (svg) {
        try {
            const t = await (await fetch(src)).text()
            const m = t.match(
                /viewBox\s*=\s*["']\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i
            )
            if (m && +m[3] > 0 && +m[4] > 0) return +m[3] / +m[4]
        } catch (e) {}
    }
    return nw > 0 && nh > 0 ? nw / nh : 6
}
// draw a picture (crisp for SVGs) onto a canvas of a given width
const ssfxRaster = (img, aspect, width) => {
    const w = Math.max(2, Math.round(width))
    const h = Math.max(2, Math.round(w / aspect))
    const c = document.createElement("canvas")
    c.width = w
    c.height = h
    c.getContext("2d").drawImage(img, 0, 0, w, h)
    return c
}
// the box (0–1) around a picture's visible pixels, for cut-out PNGs/WebPs; null when it fills its rectangle
const ssfxAlphaBox = (img) => {
    try {
        if (img.__ssfxBox !== undefined) return img.__ssfxBox
        const iw = img.naturalWidth || img.width,
            ih = img.naturalHeight || img.height
        const sc = Math.min(1, 200 / Math.max(iw, ih))
        const w = Math.max(1, Math.round(iw * sc)),
            h = Math.max(1, Math.round(ih * sc))
        const c = document.createElement("canvas")
        c.width = w
        c.height = h
        const ctx = c.getContext("2d", { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, w, h)
        const d = ctx.getImageData(0, 0, w, h).data
        let x0 = w,
            y0 = h,
            x1 = -1,
            y1 = -1
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
                if (d[(y * w + x) * 4 + 3] > 24) {
                    if (x < x0) x0 = x
                    if (x > x1) x1 = x
                    if (y < y0) y0 = y
                    if (y > y1) y1 = y
                }
        let box = null
        if (x1 >= 0 && (x0 > 0 || y0 > 0 || x1 < w - 1 || y1 < h - 1))
            box = { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h }
        img.__ssfxBox = box
        return box
    } catch (e) {
        return null
    }
}
// the rounded corners of a picture's visible pixels: { rx, ry } as a share of the visible box's
// width / height (0 = square corners), or null when the outline isn't a (rounded) rectangle
const ssfxCornerShape = (img) => {
    try {
        if (img.__ssfxCorner !== undefined) return img.__ssfxCorner
        const iw = img.naturalWidth || img.width,
            ih = img.naturalHeight || img.height
        const sc = Math.min(1, 400 / Math.max(iw, ih))
        const w = Math.max(1, Math.round(iw * sc)),
            h = Math.max(1, Math.round(ih * sc))
        const c = document.createElement("canvas")
        c.width = w
        c.height = h
        const ctx = c.getContext("2d", { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, w, h)
        const d = ctx.getImageData(0, 0, w, h).data
        const A = (x, y) => d[(y * w + x) * 4 + 3]
        let x0 = w,
            y0 = h,
            x1 = -1,
            y1 = -1
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
                if (A(x, y) > 24) {
                    if (x < x0) x0 = x
                    if (x > x1) x1 = x
                    if (y < y0) y0 = y
                    if (y > y1) y1 = y
                }
        let out = null
        if (x1 >= 0) {
            const bw = x1 - x0 + 1,
                bh = y1 - y0 + 1
            const lim = Math.floor(Math.min(bw, bh) / 2) + 1
            // walk in along each corner's diagonal to the first solid pixel
            const diag = (cx, cy, sx, sy) => {
                for (let k = 0; k < lim; k++) {
                    const x = cx + sx * k,
                        y = cy + sy * k
                    if (x < 0 || y < 0 || x >= w || y >= h) break
                    if (A(x, y) > 128) return k
                }
                return -1
            }
            const ds = [
                diag(x0, y0, 1, 1),
                diag(x1, y0, -1, 1),
                diag(x1, y1, -1, -1),
                diag(x0, y1, 1, -1),
            ]
            const mx = Math.max(...ds),
                mn = Math.min(...ds)
            if (mn >= 0) {
                if (mx <= 1) out = { rx: 0, ry: 0 }
                else if (mx - mn <= Math.max(2, mx * 0.3)) {
                    const avg = ds.reduce((a, b) => a + b, 0) / 4
                    // a circular corner meets its diagonal at r · (1 − 1/√2) from the corner
                    const r = Math.min(
                        (avg + 0.5) / (1 - Math.SQRT1_2),
                        Math.min(bw, bh) / 2
                    )
                    // the straight parts of all four sides must be solid
                    const side = (len, at) => {
                        const a = Math.min(len / 2, r + 2),
                            b = Math.max(len / 2, len - r - 2)
                        for (let k = 0; k <= 6; k++) {
                            const t = Math.round(a + ((b - a) * k) / 6)
                            if (!(at(t) > 128)) return false
                        }
                        return true
                    }
                    const ok =
                        side(bw, (t) => A(x0 + t, Math.min(y1, y0 + 1))) &&
                        side(bw, (t) => A(x0 + t, Math.max(y0, y1 - 1))) &&
                        side(bh, (t) => A(Math.min(x1, x0 + 1), y0 + t)) &&
                        side(bh, (t) => A(Math.max(x0, x1 - 1), y0 + t))
                    if (ok) out = { rx: r / bw, ry: r / bh }
                }
            }
        }
        img.__ssfxCorner = out
        return out
    } catch (e) {
        return null
    }
}
// a point along a polyline, by length (t = 0–1)
const ssfxPoly = (pts) => {
    const acc = [0]
    for (let k = 1; k < pts.length; k++)
        acc.push(
            acc[k - 1] +
                Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])
        )
    const total = acc[acc.length - 1]
    return (t) => {
        if (pts.length < 2 || !total) return pts[0]
        const target = ssfxClamp(t, 0, 1) * total
        let k = 1
        while (k < acc.length - 1 && acc[k] < target) k++
        const seg = acc[k] - acc[k - 1]
        const f = seg ? (target - acc[k - 1]) / seg : 0
        return [
            pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f,
            pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f,
        ]
    }
}
const ssfxSrc = (src) =>
    src && src.tagName === "CANVAS" ? src.toDataURL() : src

/* ------------------------------------------------------------- default art */
// Generated in the browser so the component looks finished before you add your own images.

const SSFX_ART = (() => {
    const cache = {}
    const canvas = (w, h, draw) => {
        const c = document.createElement("canvas")
        c.width = w
        c.height = h
        draw(c.getContext("2d"), w, h)
        return c
    }
    const grain = (ctx, w, h, amt) => {
        const d = ctx.getImageData(0, 0, w, h)
        const a = d.data
        for (let i = 0; i < a.length; i += 4) {
            const n = (Math.random() - 0.5) * amt
            a[i] += n
            a[i + 1] += n
            a[i + 2] += n
        }
        ctx.putImageData(d, 0, 0)
    }
    const mono = "600 22px ui-monospace, 'SF Mono', Menlo, monospace"
    const make = {
        poster: () =>
            canvas(800, 1026, (ctx, w, h) => {
                let g = ctx.createLinearGradient(0, 0, w, h)
                g.addColorStop(0, "#1B2BFF")
                g.addColorStop(1, "#7A2BFF")
                ctx.fillStyle = g
                ctx.fillRect(0, 0, w, h)
                g = ctx.createRadialGradient(
                    w * 0.42,
                    h * 0.4,
                    20,
                    w * 0.5,
                    h * 0.48,
                    w * 0.5
                )
                g.addColorStop(0, "#FFD7A0")
                g.addColorStop(0.45, "#FF7A3D")
                g.addColorStop(1, "#FF3EA5")
                ctx.fillStyle = g
                ctx.beginPath()
                ctx.arc(w * 0.5, h * 0.47, w * 0.36, 0, Math.PI * 2)
                ctx.fill()
                // halftone
                ctx.fillStyle = "#0B0B0D"
                const step = 16
                for (let y = 0; y < h; y += step)
                    for (let x = 0; x < w; x += step) {
                        const t = ssfxClamp((y / h - 0.55) * 2.4, 0, 1)
                        const r = t * step * 0.55
                        if (r < 0.4) continue
                        ctx.beginPath()
                        ctx.arc(
                            x + ((y / step) % 2) * step * 0.5,
                            y,
                            r,
                            0,
                            Math.PI * 2
                        )
                        ctx.fill()
                    }
                ctx.fillStyle = "#F4F2EE"
                ctx.font =
                    "800 92px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
                ctx.fillText("SHIFT", 66, 160)
                ctx.font = mono
                ctx.fillText("Nº 01 — SHIFTED SHAPE", 70, h - 96)
                ctx.fillText("®", w - 96, 100)
                grain(ctx, w, h, 26)
            }),
        photo: () =>
            canvas(1200, 870, (ctx, w, h) => {
                let g = ctx.createLinearGradient(0, 0, 0, h)
                g.addColorStop(0, "#FFB59A")
                g.addColorStop(0.45, "#F7D7C4")
                g.addColorStop(1, "#B9A7FF")
                ctx.fillStyle = g
                ctx.fillRect(0, 0, w, h)
                ctx.fillStyle = "#FF6B3D"
                ctx.beginPath()
                ctx.arc(w * 0.66, h * 0.36, h * 0.13, 0, Math.PI * 2)
                ctx.fill()
                const dune = (y0, amp, c1, c2, ph) => {
                    const gg = ctx.createLinearGradient(0, y0 - amp, 0, h)
                    gg.addColorStop(0, c1)
                    gg.addColorStop(1, c2)
                    ctx.fillStyle = gg
                    ctx.beginPath()
                    ctx.moveTo(0, h)
                    for (let x = 0; x <= w; x += 8)
                        ctx.lineTo(
                            x,
                            y0 +
                                Math.sin((x / w) * 5 + ph) * amp +
                                Math.sin((x / w) * 11 + ph * 2) * amp * 0.3
                        )
                    ctx.lineTo(w, h)
                    ctx.fill()
                }
                dune(h * 0.55, 34, "#E7835E", "#9E3D5C", 0.4)
                dune(h * 0.68, 42, "#C2457A", "#4B1E66", 2.1)
                dune(h * 0.82, 30, "#3D2BFF", "#130F3A", 4.0)
                grain(ctx, w, h, 22)
            }),
        cloth: () =>
            canvas(840, 1024, (ctx, w, h) => {
                ctx.fillStyle = "#1F2DFF"
                ctx.fillRect(0, 0, w, h)
                const rows = 13
                const rh = h / rows
                ctx.textBaseline = "middle"
                for (let i = 0; i < rows; i++) {
                    ctx.fillStyle = i % 2 ? "#FF3EA5" : "#F4F2EE"
                    ctx.font = `800 ${rh * 0.62}px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`
                    const t = "SHIFTED SHAPE — "
                    const off = (i % 2 ? -0.35 : 0) * w
                    let x = off
                    while (x < w) {
                        ctx.fillText(t, x, rh * (i + 0.5))
                        x += ctx.measureText(t).width
                    }
                }
                ctx.strokeStyle = "rgba(11,11,13,.35)"
                ctx.lineWidth = 2
                for (let i = 1; i < rows; i++) {
                    ctx.beginPath()
                    ctx.moveTo(0, rh * i)
                    ctx.lineTo(w, rh * i)
                    ctx.stroke()
                }
                grain(ctx, w, h, 18)
            }),
        wordmark: (color) =>
            canvas(1400, 800, (ctx, w, h) => {
                ctx.fillStyle = color || "#F4F2EE"
                ctx.textBaseline = "alphabetic"
                ctx.font =
                    "800 300px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
                const lw = (t) => ctx.measureText(t).width
                const s1 = "shifted"
                const s2 = "shape"
                const sc = Math.min(1, (w * 0.86) / Math.max(lw(s1), lw(s2)))
                ctx.font = `800 ${300 * sc}px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`
                if ("letterSpacing" in ctx) ctx.letterSpacing = `${-14 * sc}px`
                ctx.fillText(s1, w * 0.05, h * 0.44)
                ctx.fillText(s2, w * 0.05, h * 0.86)
                // the mark: a circle that turns into a square
                const x = w * 0.05 + lw(s2) + 40 * sc
                const y = h * 0.86 - 190 * sc
                const s = 150 * sc
                ctx.beginPath()
                ctx.arc(
                    x + s / 2,
                    y + s / 2,
                    s / 2,
                    Math.PI * 0.5,
                    Math.PI * 1.5
                )
                ctx.lineTo(x + s, y)
                ctx.lineTo(x + s, y + s)
                ctx.closePath()
                ctx.fill()
            }),
        marks: () => {
            const P = [
                ["#3D7BFF", "#F4F2EE"],
                ["#FF3EA5", "#0B0B0D"],
                ["#F4F2EE", "#1F2DFF"],
                ["#FFB23D", "#0B0B0D"],
                ["#0B0B0D", "#3DFFC8"],
                ["#7A2BFF", "#FFD7A0"],
                ["#3DFFC8", "#0B0B0D"],
                ["#FF6B3D", "#F4F2EE"],
                ["#F4F2EE", "#FF3EA5"],
                ["#1B1B22", "#FFB23D"],
            ]
            const shapes = [
                (f) =>
                    `<path d="M200 110a90 90 0 1 0 0 180z" fill="${f}"/><rect x="200" y="110" width="90" height="180" fill="${f}" opacity=".45"/>`,
                (f) =>
                    `<path d="M200 95 300 270H100z" fill="${f}"/><path d="M200 175 255 270H145z" fill="${f}" opacity=".35"/>`,
                (f) =>
                    `<g fill="${f}">${[0, 45, 90, 135].map((a) => `<rect x="185" y="90" width="30" height="220" rx="15" transform="rotate(${a} 200 200)"/>`).join("")}</g>`,
                (f) =>
                    `<rect x="105" y="105" width="190" height="190" rx="64" fill="none" stroke="${f}" stroke-width="30"/><circle cx="200" cy="200" r="34" fill="${f}"/>`,
                (f) =>
                    `<g fill="none" stroke="${f}" stroke-width="22">${[50, 85, 120].map((r) => `<path d="M${200 - r} 260a${r} ${r} 0 0 1 ${r * 2} 0"/>`).join("")}</g>`,
                (f) =>
                    `<g fill="${f}">${[0, 1, 2].map((i) => [0, 1, 2].map((j) => `<circle cx="${130 + i * 70}" cy="${130 + j * 70}" r="${i === j ? 30 : 18}"/>`).join("")).join("")}</g>`,
                (f) =>
                    `<path d="M200 90 310 200 200 310 90 200z" fill="${f}"/><path d="M200 150 250 200 200 250 150 200z" fill="none" stroke="${P[6][0]}" stroke-width="12"/>`,
                (f) =>
                    `<g fill="none" stroke="${f}" stroke-width="20" stroke-linecap="round">${[150, 200, 250].map((y) => `<path d="M100 ${y}q25-35 50 0t50 0 50 0 50 0"/>`).join("")}</g>`,
                (f) =>
                    `<path d="M170 95h60v75h75v60h-75v75h-60v-75H95v-60h75z" fill="${f}"/>`,
                (f) =>
                    `<circle cx="160" cy="200" r="70" fill="${f}"/><circle cx="240" cy="200" r="70" fill="none" stroke="${f}" stroke-width="22"/>`,
            ]
            return shapes.map(
                (s, i) =>
                    "data:image/svg+xml;utf8," +
                    encodeURIComponent(
                        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${P[i][0]}"/>${s(P[i][1])}</svg>`
                    )
            )
        },
    }
    const SANS =
        "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    Object.assign(make, {
        swiss: () =>
            canvas(780, 1040, (ctx, w, h) => {
                ctx.fillStyle = "#F2EFE8"
                ctx.fillRect(0, 0, w, h)
                ctx.strokeStyle = "rgba(11,11,13,.12)"
                ctx.lineWidth = 2
                for (let x = 60; x < w; x += 110) {
                    ctx.beginPath()
                    ctx.moveTo(x, 0)
                    ctx.lineTo(x, h)
                    ctx.stroke()
                }
                ctx.fillStyle = "#0B0B0D"
                ctx.beginPath()
                ctx.arc(
                    w * 0.62,
                    h * 0.38,
                    w * 0.34,
                    Math.PI * 0.5,
                    Math.PI * 1.5
                )
                ctx.fill()
                ctx.fillStyle = "#FF3B1F"
                ctx.fillRect(w * 0.62, h * 0.04, w * 0.3, h * 0.68)
                ctx.fillStyle = "#0B0B0D"
                ctx.font = `800 300px ${SANS}`
                if ("letterSpacing" in ctx) ctx.letterSpacing = "-18px"
                ctx.fillText("07", 40, h - 60)
                ctx.font = mono
                if ("letterSpacing" in ctx) ctx.letterSpacing = "0px"
                ctx.fillText("GRID SYSTEMS", 50, 70)
                grain(ctx, w, h, 16)
            }),
        arch: () =>
            canvas(780, 1000, (ctx, w, h) => {
                ctx.fillStyle = "#FF6B3D"
                ctx.fillRect(0, 0, w, h)
                ctx.fillStyle = "#1F2DFF"
                const aw = w * 0.62
                const ax = (w - aw) / 2
                ctx.beginPath()
                ctx.moveTo(ax, h * 0.92)
                ctx.lineTo(ax, h * 0.42)
                ctx.arc(w / 2, h * 0.42, aw / 2, Math.PI, 0)
                ctx.lineTo(ax + aw, h * 0.92)
                ctx.fill()
                ctx.fillStyle = "#FFD7A0"
                ctx.beginPath()
                ctx.arc(w / 2, h * 0.5, w * 0.13, 0, Math.PI * 2)
                ctx.fill()
                ctx.fillStyle = "#0B0B0D"
                ctx.font = mono
                ctx.fillText("ARCH — 02", 50, 70)
                grain(ctx, w, h, 22)
            }),
        type: () =>
            canvas(900, 900, (ctx, w, h) => {
                ctx.fillStyle = "#FFB23D"
                ctx.fillRect(0, 0, w, h)
                ctx.fillStyle = "#0B0B0D"
                ctx.font = `italic 400 520px Georgia, 'Times New Roman', serif`
                ctx.textBaseline = "alphabetic"
                ctx.fillText("Aa", 40, h * 0.74)
                ctx.font = mono
                ctx.fillText("DISPLAY / ITALIC", 50, 70)
                ctx.fillText("ABCDEFGHIJKLM 0123456789", 50, h - 50)
                grain(ctx, w, h, 14)
            }),
        dots: () =>
            canvas(800, 1000, (ctx, w, h) => {
                ctx.fillStyle = "#F2EFE8"
                ctx.fillRect(0, 0, w, h)
                ctx.fillStyle = "#FF3EA5"
                const step = 22
                for (let y = 0; y < h + step; y += step)
                    for (let x = 0; x < w + step; x += step) {
                        const ox = x + ((y / step) % 2) * step * 0.5
                        const d = Math.hypot(ox / w - 0.5, (y / h - 0.42) * 0.8)
                        const r =
                            ssfxClamp(0.5 - d, 0, 0.5) * step * 1.25 +
                            (Math.sin(ox * 0.03 + y * 0.02) + 1) * 0.6
                        ctx.beginPath()
                        ctx.arc(ox, y, r, 0, Math.PI * 2)
                        ctx.fill()
                    }
                ctx.fillStyle = "#0B0B0D"
                ctx.font = mono
                ctx.fillText("HALFTONE 45°", 50, h - 50)
            }),
        stripes: () =>
            canvas(1000, 800, (ctx, w, h) => {
                const cols = [
                    "#F2EFE8",
                    "#1F2DFF",
                    "#F2EFE8",
                    "#FF3EA5",
                    "#F2EFE8",
                    "#FFB23D",
                ]
                const sw = w / 18
                for (let i = 0; i < 18; i++) {
                    ctx.fillStyle = cols[i % cols.length]
                    ctx.fillRect(i * sw, 0, sw + 1, h)
                }
                ctx.fillStyle = "#0B0B0D"
                ctx.font = `800 120px ${SANS}`
                ctx.textAlign = "center"
                ctx.fillText("SHIFT", w / 2, h / 2 + 40)
                ctx.textAlign = "left"
                grain(ctx, w, h, 16)
            }),
        night: () =>
            canvas(1100, 850, (ctx, w, h) => {
                const g = ctx.createLinearGradient(0, 0, 0, h)
                g.addColorStop(0, "#0E1033")
                g.addColorStop(0.6, "#5B2BA6")
                g.addColorStop(1, "#FF6B9A")
                ctx.fillStyle = g
                ctx.fillRect(0, 0, w, h)
                ctx.fillStyle = "#F2EFE8"
                for (let i = 0; i < 90; i++) {
                    const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * w
                    const y = (Math.sin(i * 47.3) * 0.5 + 0.5) * h * 0.6
                    ctx.globalAlpha = 0.3 + (i % 5) * 0.14
                    ctx.fillRect(x, y, 2, 2)
                }
                ctx.globalAlpha = 1
                ctx.beginPath()
                ctx.arc(w * 0.7, h * 0.3, 70, 0, Math.PI * 2)
                ctx.fill()
                ctx.fillStyle = "#0E1033"
                ctx.beginPath()
                ctx.moveTo(0, h)
                for (let x = 0; x <= w; x += 40)
                    ctx.lineTo(
                        x,
                        h * 0.78 -
                            Math.abs(Math.sin(x * 0.011)) * 120 -
                            (x % 120 === 0 ? 40 : 0)
                    )
                ctx.lineTo(w, h)
                ctx.fill()
                grain(ctx, w, h, 20)
            }),
        shapes: () =>
            canvas(900, 900, (ctx, w, h) => {
                ctx.fillStyle = "#3DFFC8"
                ctx.fillRect(0, 0, w, h)
                ctx.fillStyle = "#0B0B0D"
                ctx.fillRect(w * 0.12, h * 0.14, w * 0.4, w * 0.4)
                ctx.fillStyle = "#1F2DFF"
                ctx.beginPath()
                ctx.arc(w * 0.62, h * 0.58, w * 0.25, 0, Math.PI * 2)
                ctx.fill()
                ctx.fillStyle = "#FF3EA5"
                ctx.beginPath()
                ctx.moveTo(w * 0.2, h * 0.88)
                ctx.lineTo(w * 0.42, h * 0.5)
                ctx.lineTo(w * 0.64, h * 0.88)
                ctx.fill()
                grain(ctx, w, h, 16)
            }),
    })
    const get = (name, arg) => {
        const key = name + (arg || "")
        if (!cache[key]) cache[key] = make[name](arg)
        return cache[key]
    }
    get.has = (name) => !!make[name]
    return get
})()

/* ------------------------------------------------------------------ styles */

const SSFX_CSS = `
.ssfx{position:relative;width:100%;height:100%;overflow:hidden;background:var(--ssfx-bg);color:var(--ssfx-text);-webkit-user-select:none;user-select:none;touch-action:pan-y;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;isolation:isolate}
.ssfx *{box-sizing:border-box}
.ssfx-layer{position:absolute;left:0;top:0;transform-origin:50% 50%;will-change:transform;z-index:2}
.ssfx-layer.can-drag{cursor:grab}
.ssfx-layer.is-dragging{cursor:grabbing}
.ssfx-layer[data-effect=cloth]{cursor:grab}
.ssfx-layer[data-effect=cloth].is-grabbing{cursor:grabbing}
.ssfx-layer[data-effect=fluid]{cursor:crosshair}
.ssfx.is-touch .ssfx-layer{touch-action:pan-y}
.ssfx-layer.touch-drag{touch-action:none}
.ssfx-media{position:absolute;inset:0;border-radius:var(--ssfx-r);overflow:hidden;transform:translateZ(0);background:var(--ssfx-lbg,transparent)}
.ssfx-media img,.ssfx-media video,.ssfx-media canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:var(--ssfx-fit,cover);padding:var(--ssfx-pad,0);display:block;pointer-events:none;-webkit-user-drag:none}
.ssfx-media canvas.ssfx-gl{padding:0}
.ssfx-gl{position:absolute;pointer-events:none;display:block}
.ssfx-layer[data-effect=fluid] .ssfx-media{border-radius:0;overflow:visible}
.ssfx-layer[data-effect=fluid] .ssfx-media img{object-fit:contain}
.ssfx-layer[data-effect=tilt]{perspective:900px}
.ssfx-tilt{position:absolute;inset:0;transform-style:preserve-3d;will-change:transform}
.ssfx-tilt .ssfx-media img{inset:-7%;width:114%;height:114%;will-change:transform}
.ssfx-layer[data-fit=contain] .ssfx-tilt .ssfx-media img,.ssfx-layer.is-shaped .ssfx-tilt .ssfx-media img{inset:0;width:100%;height:100%;transform:none!important}
.ssfx-glint{position:absolute;inset:0;pointer-events:none;mix-blend-mode:soft-light}
.ssfx-bevel{position:absolute;inset:0;border-radius:inherit;padding:1.5px;pointer-events:none;opacity:0;mix-blend-mode:screen;background:conic-gradient(from var(--ssfx-a,0deg),#ff3ea5,#ffb23d,#3dffc8,#3d7bff,#b36bff,#ff3ea5);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
.ssfx-shadow{position:absolute;left:8%;right:8%;top:12%;bottom:-3%;border-radius:var(--ssfx-r);background:#000;filter:blur(26px);opacity:.28;pointer-events:none}
.ssfx-bg{position:absolute;inset:0;z-index:0;pointer-events:none}
.ssfx-bg[data-style=lines]{background-image:linear-gradient(to bottom,var(--ssfx-line) 1px,transparent 1px);background-size:100% var(--ssfx-grid)}
.ssfx-bg[data-style=columns]{background-image:linear-gradient(to right,var(--ssfx-line) 1px,transparent 1px);background-size:var(--ssfx-grid) 100%}
.ssfx-bg[data-style=grid]{background-image:linear-gradient(to bottom,var(--ssfx-line) 1px,transparent 1px),linear-gradient(to right,var(--ssfx-line) 1px,transparent 1px);background-size:var(--ssfx-grid) var(--ssfx-grid)}
.ssfx-bg[data-style=dots]{background-image:radial-gradient(circle at 1px 1px,var(--ssfx-dot) var(--ssfx-dotr,1.2px),transparent calc(var(--ssfx-dotr,1.2px) + .5px));background-size:var(--ssfx-grid) var(--ssfx-grid)}
.ssfx-bg[data-style=gridDots]{background-image:radial-gradient(circle at 1px 1px,var(--ssfx-dot) var(--ssfx-dotr,1.2px),transparent calc(var(--ssfx-dotr,1.2px) + .5px)),linear-gradient(to bottom,var(--ssfx-line2) 1px,transparent 1px),linear-gradient(to right,var(--ssfx-line2) 1px,transparent 1px);background-size:var(--ssfx-grid) var(--ssfx-grid)}
.ssfx-artboard{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--ssfx-board);box-shadow:0 0 0 1px rgba(0,0,0,.18),0 24px 70px rgba(0,0,0,.22)}
.ssfx-artboard-label{position:absolute;left:0;bottom:100%;margin-bottom:8px;font:500 11px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--ssfx-text);opacity:.55;white-space:nowrap}
.ssfx.content-above .ssfx-center{z-index:40}
.ssfx.content-above .ssfx-heading{pointer-events:none}
.ssfx-frame{position:absolute;inset:0;z-index:60;pointer-events:none;opacity:0;transition:opacity .34s ease}
.ssfx-frame.on{transition-duration:.18s}
.ssfx-frame-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible}
.ssfx-fp{fill:none;stroke:var(--ssfx-sel);stroke-width:1.5;stroke-linejoin:round}
.ssfx-fh{fill:#fff;stroke:var(--ssfx-sel);stroke-width:1.5}
.ssfx-fhit{fill:transparent;stroke:none;pointer-events:none}
.ssfx-frame.on.can-resize .ssfx-fhit{pointer-events:all}
.ssfx.is-resizing,.ssfx.is-resizing *{-webkit-user-select:none;user-select:none}
.ssfx-frame.on{opacity:1}
.ssfx-frame-box{position:absolute;inset:-1px;border:1.5px solid var(--ssfx-sel)}
.ssfx-h{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;background:#fff;border:1.5px solid var(--ssfx-sel);border-radius:2px}
.ssfx-tag,.ssfx-size{position:absolute;background:var(--ssfx-sel);color:#fff;font:500 11px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;border-radius:4px;white-space:nowrap;letter-spacing:0}
.ssfx-tag{left:0;top:0;transform-origin:0 0;padding:5px 7px;display:flex;gap:6px;align-items:center}
.ssfx-tag i{font-style:normal;opacity:.75;padding-left:6px;border-left:1px solid rgba(255,255,255,.35)}
.ssfx-tag svg{width:11px;height:11px;flex:none}
.ssfx-size{left:0;top:0;transform-origin:0 0;padding:4px 6px;font-size:10px}
.ssfx-tag.is-badge{background:none;padding:0;gap:9px;color:var(--ssfx-sel);font:500 13px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace}
.ssfx-tag.is-badge b{background:var(--ssfx-sel);color:#fff;font:700 12px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;padding:6px 8px 5px;border-radius:5px}
.ssfx-tag.is-badge i{border-left:0;padding-left:0;opacity:.7}
.ssfx-tag.is-empty,.ssfx-size.is-off{display:none}
.ssfx-sub{margin:calc(var(--ssfx-gap) * -0.45) 0 0;font-size:clamp(15px,1.35vw,21px);line-height:1.35;letter-spacing:-.01em;opacity:.72;max-width:36ch;text-wrap:balance}
.ssfx.content-above .ssfx-sub{pointer-events:none}
.ssfx-guide{position:absolute;left:0;top:0;background:var(--ssfx-guide);z-index:59;pointer-events:none}
.ssfx-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:max-content;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--ssfx-gap);pointer-events:none;max-width:min(92%,980px)}
.ssfx-center>*{pointer-events:auto}
.ssfx-heading em{font-style:italic;font-weight:inherit}
.ssfx-hlogo{display:block;margin:0;line-height:0;font-size:0}
.ssfx-hlogo-box{position:relative;--ssfx-fit:contain}
.ssfx-hlogo-box .ssfx-media{border-radius:0;overflow:visible;background:transparent}
.ssfx-hlogo-box>img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;pointer-events:none;-webkit-user-drag:none}
.ssfx-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.ssfx.content-above .ssfx-hlogo{pointer-events:none}
.ssfx-heading{margin:0;font-size:clamp(42px,7.2vw,124px);line-height:.92;letter-spacing:-.045em;font-weight:650;white-space:pre-line;text-wrap:balance}
.ssfx-btnwrap{display:flex;flex-direction:column;align-items:center;gap:14px}
.ssfx-btn{position:relative;display:grid;place-items:center;width:var(--ssfx-btn);height:var(--ssfx-btn);border-radius:50%;background:var(--ssfx-btn-bg);color:var(--ssfx-btn-fg);border:0;padding:0;cursor:pointer;text-decoration:none;transition:transform .55s cubic-bezier(.2,.9,.25,1.35);-webkit-tap-highlight-color:transparent}
.ssfx-btn:hover{transform:scale(1.07)}
.ssfx-btn:active{transform:scale(.97)}
.ssfx-btn:focus-visible{outline:2px solid var(--ssfx-btn-bg);outline-offset:5px}
.ssfx-ring{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ssfx-ring text{font:600 15.5px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;text-transform:uppercase;fill:currentColor}
.ssfx-icon{width:28%;height:28%;transition:transform .5s cubic-bezier(.2,.9,.25,1.35)}
.ssfx-btn:hover .ssfx-icon{transform:rotate(-12deg) scale(1.12)}
.ssfx-arrow{width:22px;height:22px;opacity:.7;animation:ssfx-bob 1.7s ease-in-out infinite}
@keyframes ssfx-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(7px)}}
.ssfx.is-mobile .ssfx-center{position:absolute;left:0;right:0;top:0;transform:none;max-width:none;padding:56px 20px 28px}
.ssfx.is-static *{transition:none!important;animation:none!important}
@media (prefers-reduced-motion:reduce){.ssfx-arrow{animation:none}}
`

const SSFX_ICONS = {
    music: '<path d="M9 18V5l12-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="18" cy="16" r="3" fill="currentColor"/>',
    arrow: '<path d="M12 4v16M5 13l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    "arrow-up-right":
        '<path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
}
const SSFX_TAG_ICON =
    '<svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="4.6" cy="4.6" r="1.1" fill="currentColor"/><path d="M2 9.5 5.5 6.5 10 10" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'

/* ------------------------------------------------------------------- WebGL */

const SSFX_QUAD_VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

const SSFX_GLSL_ENC = (float) => `
#define FLOATRT ${float ? 1 : 0}
vec4 dec(vec4 c){
#if FLOATRT
  return c;
#else
  return (c - 0.5) * 2.0;
#endif
}
vec4 enc(vec4 c){
#if FLOATRT
  return c;
#else
  return clamp(c * 0.5 + 0.5, 0.0, 1.0);
#endif
}`

const ssfxGL = {
    context(canvas) {
        try {
            return canvas.getContext("webgl2", {
                premultipliedAlpha: true,
                alpha: true,
                antialias: true,
                preserveDrawingBuffer: false,
            })
        } catch (e) {
            return null
        }
    },
    program(gl, vs, fs) {
        const sh = (t, s) => {
            const o = gl.createShader(t)
            gl.shaderSource(o, s)
            gl.compileShader(o)
            if (!gl.getShaderParameter(o, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(o) || "shader error")
            return o
        }
        const p = gl.createProgram()
        gl.attachShader(p, sh(gl.VERTEX_SHADER, vs))
        gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs))
        gl.bindAttribLocation(p, 0, "aPos")
        gl.bindAttribLocation(p, 1, "aUv")
        gl.bindAttribLocation(p, 2, "aNor")
        gl.linkProgram(p)
        if (!gl.getProgramParameter(p, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(p) || "link error")
        const u = {}
        const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
        for (let i = 0; i < n; i++) {
            const info = gl.getActiveUniform(p, i)
            u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(
                p,
                info.name
            )
        }
        return { p, u }
    },
    quad(gl) {
        const vao = gl.createVertexArray()
        gl.bindVertexArray(vao)
        const b = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, b)
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            gl.STATIC_DRAW
        )
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
        gl.bindVertexArray(null)
        return vao
    },
    target(gl, w, h, fmt) {
        const t = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            fmt.internal,
            w,
            h,
            0,
            gl.RGBA,
            fmt.type,
            null
        )
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        const f = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, f)
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            t,
            0
        )
        const ok =
            gl.checkFramebufferStatus(gl.FRAMEBUFFER) ===
            gl.FRAMEBUFFER_COMPLETE
        gl.clearColor(fmt.zero, fmt.zero, fmt.zero, fmt.zero)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        return { t, f, ok, w, h }
    },
    pingpong(gl, w, h) {
        let fmt = {
            internal: gl.RGBA8,
            type: gl.UNSIGNED_BYTE,
            float: false,
            zero: 0.5,
        }
        if (
            gl.getExtension("EXT_color_buffer_float") ||
            gl.getExtension("EXT_color_buffer_half_float")
        )
            fmt = {
                internal: gl.RGBA16F,
                type: gl.HALF_FLOAT,
                float: true,
                zero: 0,
            }
        let a = ssfxGL.target(gl, w, h, fmt)
        if (!a.ok && fmt.float) {
            fmt = {
                internal: gl.RGBA8,
                type: gl.UNSIGNED_BYTE,
                float: false,
                zero: 0.5,
            }
            a = ssfxGL.target(gl, w, h, fmt)
        }
        const b = ssfxGL.target(gl, w, h, fmt)
        return {
            fmt,
            w,
            h,
            read: a,
            write: b,
            swap() {
                const t = this.read
                this.read = this.write
                this.write = t
            },
            dispose() {
                for (const x of [this.read, this.write]) {
                    gl.deleteTexture(x.t)
                    gl.deleteFramebuffer(x.f)
                }
            },
        }
    },
    image(gl, img) {
        const t = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img) // throws on tainted images
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR_MIPMAP_LINEAR
        )
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        return t
    },
    // uv scale that makes an image of aspect `ia` cover (or contain) a box of aspect `ba`
    fit(ia, ba, contain) {
        const wider = ia > ba
        if (contain) return wider ? [1, ia / ba] : [ba / ia, 1]
        return wider ? [ba / ia, 1] : [1, ia / ba]
    },
}

/* ----------------------------------------------------------------- effects */

class SsfxEffect {
    constructor(stage, layer) {
        this.s = stage
        this.l = layer
        this.el = layer.el
        this.awake = true
        this.w = 1
        this.h = 1
        this.hover = false
        this.init()
    }
    init() {}
    resize(w, h) {
        this.w = w
        this.h = h
    }
    setImage() {}
    pointer() {}
    enter() {
        this.hover = true
        this.awake = true
    }
    leave() {
        this.hover = false
        this.awake = true
    }
    down() {
        return false
    }
    drag() {}
    up() {}
    moved() {}
    tick() {}
    tag() {
        return ""
    }
    // the area the layer visibly covers, in layer pixels (null = its own rectangle)
    bounds() {
        return null
    }
    destroy() {}
    // shown when WebGL is missing or the image cannot be used by WebGL (CORS)
    fallback(src) {
        if (this.fbImg) return
        if (this.canvas) this.canvas.style.display = "none"
        const m = ssfxEl("div", "ssfx-media", this.el)
        this.fbImg = ssfxEl("img", "", m)
        this.fbImg.alt = this.l.cfg.alt || ""
        if (src) this.fbImg.src = ssfxSrc(src)
        this.awake = false
        this.broken = true
    }
}

class SsfxImage extends SsfxEffect {
    init() {
        const m = ssfxEl("div", "ssfx-media", this.el)
        this.img = ssfxEl("img", "", m)
        this.img.alt = this.l.cfg.alt || ""
        this.img.draggable = false
        this.awake = false
    }
    setImage(src) {
        this.img.src = ssfxSrc(src)
    }
    enter() {}
    leave() {}
}

/* 3D tilt — the card leans toward the pointer, the picture slides inside it */
class SsfxTilt extends SsfxEffect {
    init() {
        this.shadow = ssfxEl("div", "ssfx-shadow", this.el)
        this.wrap = ssfxEl("div", "ssfx-tilt", this.el)
        this.card = ssfxEl("div", "ssfx-media", this.wrap)
        this.img = ssfxEl("img", "", this.card)
        this.img.alt = this.l.cfg.alt || ""
        this.img.draggable = false
        this.glint = ssfxEl("div", "ssfx-glint", this.card)
        this.bevel = ssfxEl("div", "ssfx-bevel", this.card)
        this.c = { rx: 0, ry: 0, u: 0.5, v: 0.5, k: 0 }
        this.t = { rx: 0, ry: 0, u: 0.5, v: 0.5, k: 0 }
        this.apply()
    }
    setImage(src) {
        this.img.src = ssfxSrc(src)
    }
    pointer(u, v) {
        const a = this.s.o.tilt.angle * (this.l.cfg.strength ?? 1)
        this.t.rx = (0.5 - v) * 2 * a
        this.t.ry = (u - 0.5) * 2 * a
        this.t.u = u
        this.t.v = v
        this.awake = true
    }
    enter() {
        this.t.k = 1
        this.awake = true
    }
    leave() {
        Object.assign(this.t, { rx: 0, ry: 0, u: 0.5, v: 0.5, k: 0 })
        this.awake = true
    }
    tick(dt) {
        const e = 1 - Math.exp(-dt * 9)
        let d = 0
        for (const k in this.c) {
            const n = this.c[k] + (this.t[k] - this.c[k]) * e
            d += Math.abs(n - this.t[k])
            this.c[k] = n
        }
        this.apply()
        if (d < 0.002) this.awake = false
    }
    // the tilted card's corners on screen (same maths as the CSS: perspective 900px)
    outline() {
        const { rx, ry, k } = this.c
        if (Math.abs(rx) + Math.abs(ry) + k < 0.005) return null
        const a = (rx * Math.PI) / 180
        const b = (ry * Math.PI) / 180
        const zt = k * 14
        const d = 900
        const w = this.l.w
        const h = this.l.h
        const c = [
            [-w / 2, -h / 2],
            [w / 2, -h / 2],
            [w / 2, h / 2],
            [-w / 2, h / 2],
        ].map(([px, py]) => {
            const xa = px * Math.cos(b) + zt * Math.sin(b)
            const za = -px * Math.sin(b) + zt * Math.cos(b)
            const yb = py * Math.cos(a) - za * Math.sin(a)
            const zb = py * Math.sin(a) + za * Math.cos(a)
            const sc = d / (d - zb)
            return [xa * sc + w / 2, yb * sc + h / 2]
        })
        return [
            [c[0], c[1]],
            [c[1], c[2]],
            [c[2], c[3]],
            [c[3], c[0]],
        ]
    }
    apply() {
        const { rx, ry, u, v, k } = this.c
        const o = this.s.o.tilt
        this.wrap.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(${(k * 14).toFixed(1)}px)`
        this.img.style.transform = `translate(${(-(u - 0.5) * o.parallax).toFixed(2)}%, ${(-(v - 0.5) * o.parallax).toFixed(2)}%)`
        this.glint.style.background = `radial-gradient(circle at ${(u * 100).toFixed(1)}% ${(v * 100).toFixed(1)}%, rgba(255,255,255,${(o.glare * k).toFixed(3)}), rgba(255,255,255,0) 58%)`
        this.bevel.style.opacity = (k * 0.85).toFixed(3)
        this.bevel.style.setProperty(
            "--ssfx-a",
            `${(Math.atan2(rx, ry) * 57.3).toFixed(1)}deg`
        )
        this.shadow.style.transform = `translate(${(-ry * 0.9).toFixed(1)}px, ${(rx * 0.6 + k * 14).toFixed(1)}px)`
        this.shadow.style.opacity = (0.22 + k * 0.28).toFixed(3)
    }
}

/* Frame sequence — loops brand marks / a GIF / a video, pauses on hover */
class SsfxSequence extends SsfxEffect {
    init() {
        this.card = ssfxEl("div", "ssfx-media", this.el)
        this.i = 0
        this.acc = 0
        this.paused = false
        this.frames = []
        this.durs = null
        this.token = 0
    }
    setImage(src) {
        const list = Array.isArray(src) ? src.filter(Boolean) : [src]
        this.load(list)
    }
    async load(list) {
        const token = ++this.token
        this.card.innerHTML = ""
        this.frames = []
        this.durs = null
        this.video = null
        this.i = 0
        const first = list[0]
        const isVideo =
            typeof first === "string" &&
            /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(first)
        const isGif =
            list.length === 1 &&
            typeof first === "string" &&
            (/\.gif(\?|#|$)/i.test(first) || /^data:image\/gif/.test(first))
        if (isVideo) {
            const v = ssfxEl("video", "", this.card)
            Object.assign(v, {
                muted: true,
                loop: true,
                playsInline: true,
                autoplay: !ssfxReduced() && this.s.o.interactive,
                src: first,
            })
            v.setAttribute("muted", "")
            v.setAttribute("playsinline", "")
            v.playbackRate = v.defaultPlaybackRate = this.speed()
            this.video = v
            this.awake = false
            return
        }
        this.cv = ssfxEl("canvas", "", this.card)
        this.ctx = this.cv.getContext("2d")
        if (isGif && typeof ImageDecoder !== "undefined") {
            try {
                const buf = await (await fetch(first)).arrayBuffer()
                const dec = new ImageDecoder({ data: buf, type: "image/gif" })
                await dec.tracks.ready
                const n = dec.tracks.selectedTrack.frameCount
                const frames = []
                const durs = []
                for (let i = 0; i < n; i++) {
                    const { image } = await dec.decode({ frameIndex: i })
                    frames.push(await createImageBitmap(image))
                    durs.push(Math.max(0.02, (image.duration || 100000) / 1e6))
                    image.close()
                }
                if (token !== this.token) return
                this.frames = frames
                this.durs = durs
                this.draw()
                return
            } catch (e) {
                /* fall through to a plain image */
            }
        }
        const imgs = await Promise.all(
            list.map((s) => ssfxLoadImage(s).catch(() => null))
        )
        if (token !== this.token) return
        this.frames = imgs.filter(Boolean)
        if (isGif && this.frames.length === 1) {
            // no ImageDecoder: show the GIF as is (it keeps playing on hover)
            this.card.innerHTML = ""
            const im = ssfxEl("img", "", this.card)
            im.src = first
            this.frames = []
            return
        }
        this.draw()
    }
    resize(w, h) {
        super.resize(w, h)
        if (!this.cv) return
        const d = Math.min(devicePixelRatio || 1, this.s.o.maxDpr)
        this.cv.width = Math.max(1, Math.round(w * d))
        this.cv.height = Math.max(1, Math.round(h * d))
        this.draw()
    }
    draw() {
        const f = this.frames[this.i]
        if (!f || !this.ctx) return
        const W = this.cv.width
        const H = this.cv.height
        const iw = f.naturalWidth || f.width
        const ih = f.naturalHeight || f.height
        const cfg = this.l.cfg
        const pad = ((cfg.padding || 0) / 100) * W
        const sc =
            cfg.fit === "contain"
                ? Math.min((W - pad * 2) / iw, (H - pad * 2) / ih)
                : Math.max(W / iw, H / ih)
        this.ctx.clearRect(0, 0, W, H)
        this.ctx.drawImage(
            f,
            (W - iw * sc) / 2,
            (H - ih * sc) / 2,
            iw * sc,
            ih * sc
        )
    }
    enter() {
        this.hover = true
        if (!this.s.o.sequence.pauseOnHover) return
        this.paused = true
        if (this.video) this.video.pause()
        this.s.refreshTag()
    }
    leave() {
        this.hover = false
        this.paused = false
        if (this.video && !ssfxReduced()) this.video.play().catch(() => {})
    }
    // 1 = the GIF's own timing (or the frames-per-second setting), 2 = twice as fast
    speed() {
        return ssfxClamp(
            Number(this.l.cfg.speed ?? this.s.o.sequence.speed ?? 1) || 1,
            0.05,
            10
        )
    }
    tick(dt) {
        if (
            this.paused ||
            this.frames.length < 2 ||
            !this.s.o.interactive ||
            ssfxReduced()
        )
            return
        this.acc += dt
        const dur =
            (this.durs
                ? this.durs[this.i]
                : 1 / Math.max(0.5, this.l.cfg.fps || this.s.o.sequence.fps)) /
            this.speed()
        if (this.acc >= dur) {
            this.acc = this.acc % dur
            this.i = (this.i + 1) % this.frames.length
            this.draw()
        }
    }
    tag() {
        if (!this.paused || this.frames.length < 2) return ""
        const p = (n) => String(n).padStart(2, "0")
        return `${p(this.i + 1)}/${p(this.frames.length)}`
    }
}

/* shared base for the WebGL layers.
   The WebGL canvas is created only when the layer comes into view, and created again if the
   browser takes it away (browsers allow ~16 WebGL canvases per page). Until then, and whenever
   WebGL can't run, the plain image is shown. */
class SsfxGLEffect extends SsfxEffect {
    init() {
        this.host = this.mount()
        this.state = "idle" // idle | active | lost | failed
        this.pad = 0
        this.ready = false
        this.revives = 0
        this.phWrap = ssfxEl("div", "ssfx-media ssfx-ph", this.el)
        this.ph = ssfxEl("img", "", this.phWrap)
        this.ph.alt = this.l.cfg.alt || ""
        this.ph.draggable = false
        if (this.l.effect === "liquid" && this.s.o.liquid.grayscale)
            this.ph.style.filter = "grayscale(1)"
        this.awake = false
    }
    get broken() {
        return this.state !== "active"
    }
    set broken(v) {}
    mount() {
        return this.el
    }
    activate() {
        if (this.state === "active" || this.state === "failed") return
        const canvas = ssfxEl("canvas", "ssfx-gl", this.host)
        const gl = ssfxGL.context(canvas)
        if (!gl) {
            canvas.remove()
            this.state = "failed"
            return
        }
        this.canvas = canvas
        this.gl = gl
        canvas.addEventListener("webglcontextlost", (e) => {
            e.preventDefault()
            if (this.canvas === canvas) this.lose()
        })
        this.ready = false
        this.tex = null
        this.pp = null
        this.simF = undefined
        this.P = null
        try {
            this.state = "active"
            this.setup()
        } catch (err) {
            console.warn("[Selection Stage FX]", err)
            this.fallback()
            return
        }
        if (this.w > 1) this.resize(this.w, this.h)
        if (this.src) this.loadTex(this.src)
        this.awake = true
    }
    lose() {
        this.state = "lost"
        this.lostAt = performance.now()
        this.ready = false
        if (this.canvas) this.canvas.style.display = "none"
        this.phWrap.style.display = ""
        this.awake = false
    }
    revive() {
        if (this.revives >= 4) return
        this.revives++
        if (this.canvas) this.canvas.remove()
        this.canvas = null
        this.gl = null
        this.state = "idle"
        this.activate()
    }
    fallback() {
        this.state = "failed"
        if (this.canvas) this.canvas.remove()
        this.canvas = null
        this.phWrap.style.display = ""
        this.awake = false
    }
    setImage(src) {
        this.src = src
        this.ph.src = ssfxSrc(src)
        if (this.state === "active") this.loadTex(src)
    }
    async loadTex(src) {
        try {
            let img = await ssfxLoadImage(src)
            if (this.l.raster) img = await this.l.raster(img, src)
            if (this.src !== src || this.state !== "active") return
            const gl = this.gl
            const t = ssfxGL.image(gl, img)
            if (this.tex) gl.deleteTexture(this.tex)
            this.tex = t
            this.imgAspect =
                (img.naturalWidth || img.width) /
                (img.naturalHeight || img.height)
            this.abox = ssfxAlphaBox(img)
            this.srcImg = img
            this.ready = true
            this.awake = true
            this.render(0)
            this.phWrap.style.display = "none"
        } catch (e) {
            console.warn(
                "[Selection Stage FX] using a plain image instead of WebGL:",
                e.message || e
            )
            this.fallback()
        }
    }
    sizeCanvas(cw, ch, left, top) {
        const d = Math.min(devicePixelRatio || 1, this.s.o.maxDpr)
        this.dpr = d
        this.cw = cw
        this.ch = ch
        this.canvas.width = Math.max(1, Math.round(cw * d))
        this.canvas.height = Math.max(1, Math.round(ch * d))
        Object.assign(this.canvas.style, {
            width: cw + "px",
            height: ch + "px",
            left: left + "px",
            top: top + "px",
        })
    }
    destroy() {
        if (this.gl) {
            const ext = this.gl.getExtension("WEBGL_lose_context")
            if (ext) ext.loseContext()
        }
    }
    render() {}
}

/* Fluid — logo / text distortion with a four-colour fluid trail (no selection frame) */
const SSFX_FLUID_SIM = (f) => `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uPrev; uniform vec2 uTexel, uPtr, uVel, uBurstPos;
uniform float uAspect, uDt, uTime, uDecay, uRadius, uSplat, uBurst;
${SSFX_GLSL_ENC(f)}
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
vec2 curl(vec2 p){ float e = 0.08;
  return vec2(noise(p+vec2(0,e)) - noise(p-vec2(0,e)), -(noise(p+vec2(e,0)) - noise(p-vec2(e,0)))) / (2.0*e); }
void main(){
  vec4 c = dec(texture(uPrev, vUv));
  vec2 back = vUv - c.xy * uDt * 0.02;
  vec4 s = dec(texture(uPrev, back));
  vec4 n = dec(texture(uPrev, back + vec2(uTexel.x, 0.0))) + dec(texture(uPrev, back - vec2(uTexel.x, 0.0)))
         + dec(texture(uPrev, back + vec2(0.0, uTexel.y))) + dec(texture(uPrev, back - vec2(0.0, uTexel.y)));
  s = mix(s, n * 0.25, 0.3);
  s.xy += curl(vUv * 3.2 + vec2(uTime * 0.11, -uTime * 0.07)) * s.z * uDt * 0.04;
  vec2 d = vUv - uPtr; d.x *= uAspect;
  float g = exp(-dot(d, d) / (uRadius * uRadius));
  s.xy += uVel * g * uSplat;
  s.z += g * min(length(uVel), 1.2) * uSplat * 0.9;
  vec2 bd = vUv - uBurstPos; bd.x *= uAspect;
  float bg = exp(-dot(bd, bd) / 0.02) * uBurst;
  s.xy += normalize(bd + 1e-5) * bg * 1.2;
  s.z += bg;
  s.xy *= uDecay;
  s.z = max(s.z * mix(uDecay, 1.0, 0.45) - 0.0018, 0.0);
  o = enc(clamp(s, vec4(-1.0, -1.0, 0.0, 0.0), vec4(1.0)));
}`

const SSFX_FLUID_SHOW = (f) => `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSim, uImg; uniform vec2 uFit, uScale; uniform float uDistort, uTime, uCycle, uHalo, uTint;
uniform vec3 uC0, uC1, uC2, uC3;
${SSFX_GLSL_ENC(f)}
// sample a picture with its gradients taken up front (no branch), the blur capped where the
// sheet folds edge-on, and a crisp transparent border instead of mip-blurred edge colour
vec4 ssfxTex(sampler2D t, vec2 uv){
  vec2 ts = vec2(textureSize(t, 0));
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  float lim = 3.0 / max(ts.x, ts.y);
  gx *= min(1.0, lim / max(length(gx), 1e-6));
  gy *= min(1.0, lim / max(length(gy), 1e-6));
  vec4 c = textureGrad(t, clamp(uv, 0.0, 1.0), gx, gy);
  vec2 px = max(fwidth(uv), vec2(1e-6));
  vec2 in2 = clamp(uv / px + 0.5, 0.0, 1.0) * clamp((1.0 - uv) / px + 0.5, 0.0, 1.0);
  return c * in2.x * in2.y;
}
vec4 img(vec2 uv){
  vec2 iu = (uv - 0.5) * uScale;            // canvas -> layer
  iu = iu * uFit + 0.5;                      // layer -> image (contain)
  return ssfxTex(uImg, iu);
}
vec3 grad(float t){
  t = fract(t) * 4.0;
  if (t < 1.0) return mix(uC0, uC1, smoothstep(0.0, 1.0, t));
  if (t < 2.0) return mix(uC1, uC2, smoothstep(1.0, 2.0, t));
  if (t < 3.0) return mix(uC2, uC3, smoothstep(2.0, 3.0, t));
  return mix(uC3, uC0, smoothstep(3.0, 4.0, t));
}
void main(){
  vec4 s = dec(texture(uSim, vUv));
  vec2 v = s.xy; float dye = clamp(s.z, 0.0, 1.0);
  vec2 off = v * uDistort;
  vec4 r = img(vUv - off * 1.25), g = img(vUv - off), b = img(vUv - off * 0.75);
  float a = max(max(r.a, g.a), b.a);
  vec3 base = vec3(r.r, g.g, b.b);
  vec3 tint = grad(atan(v.y, v.x) / 6.2831 + uTime * uCycle + vUv.x * 0.6 + vUv.y * 0.3);
  float k = smoothstep(0.02, 0.6, dye) * uTint;
  vec3 col = mix(base, tint * a, k);
  vec2 e = smoothstep(vec2(0.0), vec2(0.12), vUv) * smoothstep(vec2(0.0), vec2(0.12), 1.0 - vUv);
  float halo = smoothstep(0.05, 0.9, dye) * uHalo * uTint * (1.0 - a) * e.x * e.y;
  o = vec4(col + tint * halo, a + halo);
}`

class SsfxFluid extends SsfxGLEffect {
    setup() {
        const gl = this.gl
        this.quad = ssfxGL.quad(gl)
        this.ptr = { u: 0.5, v: 0.5, vx: 0, vy: 0 }
        this.burst = 0
        this.burstPos = [0.5, 0.5]
        this.time = 0
        this.idle = 0
    }
    buildSim() {
        const gl = this.gl
        const sw = 192
        const sh = Math.max(16, Math.round((sw * this.ch) / this.cw))
        if (this.pp && this.pp.w === sw && this.pp.h === sh) return
        if (this.pp) this.pp.dispose()
        this.pp = ssfxGL.pingpong(gl, sw, sh)
        const f = this.pp.fmt.float
        if (this.simF !== f) {
            this.simF = f
            this.sim = ssfxGL.program(gl, SSFX_QUAD_VS, SSFX_FLUID_SIM(f))
            this.show = ssfxGL.program(gl, SSFX_QUAD_VS, SSFX_FLUID_SHOW(f))
        }
    }
    resize(w, h) {
        super.resize(w, h)
        if (this.broken) return
        this.pad = Math.round(Math.min(w, h) * 0.18)
        this.sizeCanvas(
            w + this.pad * 2,
            h + this.pad * 2,
            -this.pad,
            -this.pad
        )
        this.buildSim()
        this.awake = true
        this.render(0)
    }
    pointer(u, v, x, y, vx, vy) {
        const nu = (x + this.pad) / this.cw
        const nv = 1 - (y + this.pad) / this.ch
        this.ptr = {
            u: nu,
            v: nv,
            vx: (vx / this.cw) * 1.6,
            vy: (-vy / this.ch) * 1.6,
        }
        this.awake = true
        this.idle = 0
    }
    enter() {
        this.hover = true
        this.awake = true
    }
    leave() {
        this.hover = false
        this.ptr.vx = this.ptr.vy = 0
    }
    down(x, y) {
        this.burst = 1
        this.burstPos = [(x + this.pad) / this.cw, 1 - (y + this.pad) / this.ch]
        this.awake = true
        this.idle = 0
        return true
    }
    tick(dt) {
        this.time += dt
        this.idle += dt
        this.render(dt)
        this.ptr.vx *= 0.6
        this.ptr.vy *= 0.6
        this.burst *= 0.5
        if (this.burst < 0.01) this.burst = 0
        if (!this.hover && this.idle > 5) this.awake = false
    }
    render(dt) {
        if (!this.ready || !this.pp || this.broken) return
        const gl = this.gl
        const o = this.s.o.fluid
        const st = this.l.cfg.strength ?? 1
        gl.bindVertexArray(this.quad)
        gl.disable(gl.BLEND)
        // simulate
        const step = Math.min(dt, 1 / 30)
        if (step > 0) {
            gl.useProgram(this.sim.p)
            const u = this.sim.u
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pp.write.f)
            gl.viewport(0, 0, this.pp.w, this.pp.h)
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, this.pp.read.t)
            gl.uniform1i(u.uPrev, 0)
            gl.uniform2f(u.uTexel, 1 / this.pp.w, 1 / this.pp.h)
            gl.uniform2f(u.uPtr, this.ptr.u, this.ptr.v)
            const vl = Math.hypot(this.ptr.vx, this.ptr.vy)
            const cap = vl > 1 ? 1 / vl : 1
            gl.uniform2f(u.uVel, this.ptr.vx * cap, this.ptr.vy * cap)
            gl.uniform2f(u.uBurstPos, this.burstPos[0], this.burstPos[1])
            gl.uniform1f(u.uAspect, this.cw / this.ch)
            gl.uniform1f(u.uDt, step * 60)
            gl.uniform1f(u.uTime, this.time)
            gl.uniform1f(u.uDecay, Math.pow(0.972, step * 60))
            gl.uniform1f(u.uRadius, o.radius)
            gl.uniform1f(u.uSplat, this.hover ? 0.55 * st : 0)
            gl.uniform1f(u.uBurst, this.burst * st)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
            this.pp.swap()
        }
        // show
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.useProgram(this.show.p)
        const u = this.show.u
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.pp.read.t)
        gl.uniform1i(u.uSim, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.tex)
        gl.uniform1i(u.uImg, 1)
        const fit = ssfxGL.fit(this.imgAspect, this.w / this.h, true)
        gl.uniform2f(u.uFit, fit[0], fit[1])
        gl.uniform2f(u.uScale, this.cw / this.w, this.ch / this.h)
        gl.uniform1f(u.uDistort, o.distortion * st)
        gl.uniform1f(u.uTime, this.time)
        gl.uniform1f(u.uCycle, o.cycle)
        gl.uniform1f(u.uHalo, o.halo)
        gl.uniform1f(u.uTint, ssfxClamp(Number(this.l.cfg.tint ?? 1), 0, 1.5))
        const own = (this.l.cfg.colors || []).filter(Boolean)
        const cs = (
            own.length
                ? own
                : o.colors && o.colors.length
                  ? o.colors
                  : SSFX_DEFAULTS.fluid.colors
        ).slice()
        while (cs.length < 4) cs.push(cs[cs.length - 1])
        ;["uC0", "uC1", "uC2", "uC3"].forEach((k, i) =>
            gl.uniform3fv(u[k], ssfxRgb(cs[i]))
        )
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    destroy() {
        if (this.pp) this.pp.dispose()
        super.destroy()
    }
}

/* Liquid — grayscale picture, liquid ripples under the pointer reveal the colour */
const SSFX_WAVE_SIM = (f) => `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uPrev; uniform vec2 uTexel, uA, uB;
uniform float uAspect, uRadius, uDrop, uDamp, uFade;
${SSFX_GLSL_ENC(f)}
void main(){
  vec4 c = dec(texture(uPrev, vUv));
  vec4 l = dec(texture(uPrev, vUv - vec2(uTexel.x, 0.0))), r = dec(texture(uPrev, vUv + vec2(uTexel.x, 0.0)));
  vec4 d = dec(texture(uPrev, vUv - vec2(0.0, uTexel.y))), u = dec(texture(uPrev, vUv + vec2(0.0, uTexel.y)));
  float h = (l.r + r.r + d.r + u.r) * 0.5 - c.g;
  h *= uDamp;
  vec2 pa = vUv - uA, ba = uB - uA; pa.x *= uAspect; ba.x *= uAspect;
  float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-7), 0.0, 1.0);
  float dist = length(pa - ba * t);
  float drop = smoothstep(uRadius, uRadius * 0.15, dist) * uDrop;
  h -= drop;
  float rv = max(c.b, max(max(l.b, r.b), max(d.b, u.b)) * 0.955);
  rv = clamp(max(rv, smoothstep(uRadius * 3.0, 0.0, dist) * step(0.0001, uDrop)) - uFade, 0.0, 1.0);
  o = enc(vec4(clamp(h, -1.0, 1.0), c.r, rv, 0.0));
}`

const SSFX_WAVE_SHOW = (f) => `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSim, uImg; uniform vec2 uTexel, uFit;
uniform float uRefract, uGray, uReveal, uPadF; uniform vec4 uBg;
${SSFX_GLSL_ENC(f)}
// sample a picture with its gradients taken up front (no branch), the blur capped where the
// sheet folds edge-on, and a crisp transparent border instead of mip-blurred edge colour
vec4 ssfxTex(sampler2D t, vec2 uv){
  vec2 ts = vec2(textureSize(t, 0));
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  float lim = 3.0 / max(ts.x, ts.y);
  gx *= min(1.0, lim / max(length(gx), 1e-6));
  gy *= min(1.0, lim / max(length(gy), 1e-6));
  vec4 c = textureGrad(t, clamp(uv, 0.0, 1.0), gx, gy);
  vec2 px = max(fwidth(uv), vec2(1e-6));
  vec2 in2 = clamp(uv / px + 0.5, 0.0, 1.0) * clamp((1.0 - uv) / px + 0.5, 0.0, 1.0);
  return c * in2.x * in2.y;
}
void main(){
  float hl = dec(texture(uSim, vUv - vec2(uTexel.x, 0.0))).r, hr = dec(texture(uSim, vUv + vec2(uTexel.x, 0.0))).r;
  float hd = dec(texture(uSim, vUv - vec2(0.0, uTexel.y))).r, hu = dec(texture(uSim, vUv + vec2(0.0, uTexel.y))).r;
  vec2 g = vec2(hr - hl, hu - hd);
  vec2 uv = vUv + g * uRefract;
  vec2 tuv = (uv - 0.5) * uFit * (1.0 + 2.0 * uPadF) + 0.5;
  vec4 tex = ssfxTex(uImg, tuv);
  vec4 base = tex + uBg * (1.0 - tex.a);
  vec3 col = base.rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float rv = clamp(max(dec(texture(uSim, vUv)).b, uReveal), 0.0, 1.0);
  col = mix(mix(col, vec3(lum) * vec3(1.0, 0.99, 0.97), uGray), col, smoothstep(0.0, 1.0, rv));
  vec3 n = normalize(vec3(-g * 7.0, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.55, 1.0));
  float spec = pow(max(dot(n, L), 0.0), 60.0) - pow(dot(vec3(0.0, 0.0, 1.0), L), 60.0);
  col += max(spec, 0.0) * 0.55 * base.a;
  col *= 1.0 - clamp(-g.y * 2.0, 0.0, 0.18);
  o = vec4(col, base.a);
}`

class SsfxLiquid extends SsfxGLEffect {
    mount() {
        this.media = ssfxEl("div", "ssfx-media", this.el)
        return this.media
    }
    setup() {
        this.quad = ssfxGL.quad(this.gl)
        this.a = [0.5, 0.5]
        this.b = [0.5, 0.5]
        this.drop = 0
        this.reveal = 0
        this.revealT = 0
        this.idle = 0
    }
    buildSim() {
        const gl = this.gl
        const sw = 256
        const sh = Math.max(16, Math.round((sw * this.h) / this.w))
        if (this.pp && this.pp.w === sw && this.pp.h === sh) return
        if (this.pp) this.pp.dispose()
        this.pp = ssfxGL.pingpong(gl, sw, sh)
        const f = this.pp.fmt.float
        if (this.simF !== f) {
            this.simF = f
            this.sim = ssfxGL.program(gl, SSFX_QUAD_VS, SSFX_WAVE_SIM(f))
            this.show = ssfxGL.program(gl, SSFX_QUAD_VS, SSFX_WAVE_SHOW(f))
        }
    }
    resize(w, h) {
        super.resize(w, h)
        if (this.broken) return
        this.sizeCanvas(w, h, 0, 0)
        this.buildSim()
        this.awake = true
        this.render(0)
    }
    pointer(u, v, x, y, vx, vy) {
        const p = [u, 1 - v]
        if (this.fresh) {
            this.a = p
            this.fresh = false
        }
        this.b = p
        const sp = Math.hypot(vx, vy)
        this.drop = Math.max(this.drop, ssfxClamp(sp / 2200, 0.05, 0.6))
        this.awake = true
        this.idle = 0
    }
    enter() {
        this.hover = true
        this.awake = true
        this.fresh = true
        this.revealT = 1
    }
    leave() {
        this.hover = false
        this.revealT = 0
    }
    moved(vx, vy) {
        if (this.hover)
            this.drop = Math.max(
                this.drop,
                ssfxClamp(Math.hypot(vx, vy) / 1500, 0, 0.8)
            )
    }
    down() {
        this.drop = 0.9
        return false
    }
    tick(dt) {
        this.idle += dt
        this.reveal +=
            (this.revealT - this.reveal) *
            (1 - Math.exp(-dt * (this.revealT ? 2.2 : 1.6)))
        this.steps = Math.min(3, Math.max(1, Math.round(dt * 60 * 1.5)))
        this.render(dt)
        this.a = this.b.slice()
        this.drop = 0
        if (!this.hover && this.idle > 4 && this.reveal < 0.002)
            this.awake = false
    }
    render(dt) {
        if (!this.ready || !this.pp || this.broken) return
        const gl = this.gl
        const o = this.s.o.liquid
        const st = this.l.cfg.strength ?? 1
        gl.bindVertexArray(this.quad)
        gl.disable(gl.BLEND)
        if (dt > 0) {
            gl.useProgram(this.sim.p)
            const u = this.sim.u
            gl.viewport(0, 0, this.pp.w, this.pp.h)
            gl.uniform2f(u.uTexel, 1 / this.pp.w, 1 / this.pp.h)
            gl.uniform1f(u.uAspect, this.w / this.h)
            gl.uniform1f(u.uRadius, o.radius)
            gl.uniform1f(u.uDamp, o.damping)
            gl.uniform1f(u.uFade, this.hover ? 0 : 0.012)
            for (let i = 0; i < this.steps; i++) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.pp.write.f)
                gl.activeTexture(gl.TEXTURE0)
                gl.bindTexture(gl.TEXTURE_2D, this.pp.read.t)
                gl.uniform1i(u.uPrev, 0)
                gl.uniform2f(u.uA, this.a[0], this.a[1])
                gl.uniform2f(u.uB, this.b[0], this.b[1])
                gl.uniform1f(u.uDrop, i === 0 ? this.drop * st : 0)
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
                this.pp.swap()
            }
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.useProgram(this.show.p)
        const u = this.show.u
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.pp.read.t)
        gl.uniform1i(u.uSim, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.tex)
        gl.uniform1i(u.uImg, 1)
        gl.uniform2f(u.uTexel, 1 / this.pp.w, 1 / this.pp.h)
        const cfg = this.l.cfg
        const fit = ssfxGL.fit(
            this.imgAspect,
            this.w / this.h,
            cfg.fit === "contain"
        )
        gl.uniform2f(u.uFit, fit[0], fit[1])
        gl.uniform1f(u.uPadF, (cfg.padding || 0) / 100)
        gl.uniform4fv(u.uBg, ssfxBg(cfg.background))
        gl.uniform1f(u.uRefract, o.refraction * st)
        gl.uniform1f(u.uGray, o.grayscale ? 1 : 0)
        gl.uniform1f(u.uReveal, this.reveal)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    destroy() {
        if (this.pp) this.pp.dispose()
        super.destroy()
    }
}

/* Cloth — the picture is a sheet of fabric: brush it and it ripples, grab it and pull */
const SSFX_CLOTH_VS = `#version 300 es
in vec3 aPos; in vec2 aUv; in vec3 aNor;
uniform vec2 uCanvas, uPad, uCenter; uniform float uPersp;
out vec2 vUv; out vec3 vNor;
void main(){
  float s = uPersp / max(uPersp - aPos.z, 1.0);
  vec2 p = uCenter + (aPos.xy - uCenter) * s + uPad;
  vUv = aUv; vNor = aNor;
  gl_Position = vec4(p.x / uCanvas.x * 2.0 - 1.0, 1.0 - p.y / uCanvas.y * 2.0, clamp(-aPos.z / 4000.0, -1.0, 1.0), 1.0);
}`

const SSFX_CLOTH_FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec3 vNor; out vec4 o;
uniform sampler2D uImg; uniform vec2 uFit, uSize; uniform float uR, uPadF, uShade; uniform vec4 uBg;

// sample a picture with its gradients taken up front (no branch), the blur capped where the
// sheet folds edge-on, and a crisp transparent border instead of mip-blurred edge colour
vec4 ssfxTex(sampler2D t, vec2 uv){
  vec2 ts = vec2(textureSize(t, 0));
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  float lim = 3.0 / max(ts.x, ts.y);
  gx *= min(1.0, lim / max(length(gx), 1e-6));
  gy *= min(1.0, lim / max(length(gy), 1e-6));
  vec4 c = textureGrad(t, clamp(uv, 0.0, 1.0), gx, gy);
  vec2 px = max(fwidth(uv), vec2(1e-6));
  vec2 in2 = clamp(uv / px + 0.5, 0.0, 1.0) * clamp((1.0 - uv) / px + 0.5, 0.0, 1.0);
  return c * in2.x * in2.y;
}
void main(){
  vec3 n = normalize(vNor);
  float back = step(n.z, 0.0);
  if (n.z < 0.0) n = -n;
  vec3 L = normalize(vec3(-0.35, -0.5, 1.0));
  float flat0 = dot(vec3(0.0, 0.0, 1.0), L);
  // soft, paper-like light: folds turning to the light brighten a little, folds turning away
  // darken gently and never below a floor, so the picture never goes muddy or black
  float d = dot(n, L) - flat0;
  float lit = d > 0.0 ? d * 1.1 : -(1.0 - exp(d * 2.2)) * 0.55;
  float shade = 1.0 + lit * uShade;
  shade = max(shade, 1.0 - 0.3 * uShade);
  vec2 tuv = (vec2(vUv.x, 1.0 - vUv.y) - 0.5) * uFit * (1.0 + 2.0 * uPadF) + 0.5;
  vec4 tex = ssfxTex(uImg, tuv);
  vec4 base = tex + uBg * (1.0 - tex.a);
  // shadow lifts toward the picture's own colour instead of plain grey
  vec3 col = mix(base.rgb * shade, base.rgb * mix(shade, 1.0, 0.35), step(shade, 1.0));
  col *= mix(1.0, 1.0 - 0.16 * uShade, back);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(n, H), 0.0), 34.0) - pow(dot(vec3(0.0, 0.0, 1.0), H), 34.0);
  col += max(sp, 0.0) * 0.2 * uShade * base.a;
  vec2 q = abs(vUv * uSize - uSize * 0.5) - (uSize * 0.5 - uR);
  float dd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uR;
  float a = clamp(0.5 - dd, 0.0, 1.0);
  o = vec4(col * a, base.a * a);
}`

class SsfxCloth extends SsfxGLEffect {
    setup() {
        const gl = this.gl
        this.prog = ssfxGL.program(gl, SSFX_CLOTH_VS, SSFX_CLOTH_FS)
        this.vao = gl.createVertexArray()
        this.bPos = gl.createBuffer()
        this.bUv = gl.createBuffer()
        this.bNor = gl.createBuffer()
        this.bIdx = gl.createBuffer()
        this.time = 0
        this.grab = -1
        this.ptr = null
        this.acc = 0
        this.energy = 1
    }
    build(w, h) {
        const cols = 26
        const rows = ssfxClamp(Math.round((cols * h) / w), 10, 44)
        this.cols = cols
        this.rows = rows
        const n = (cols + 1) * (rows + 1)
        this.P = new Float32Array(n * 3)
        this.Q = new Float32Array(n * 3) // previous
        this.R = new Float32Array(n * 2) // rest
        this.N = new Float32Array(n * 3)
        this.pin = new Uint8Array(n)
        const uv = new Float32Array(n * 2)
        const pinMode = this.l.cfg.pin || this.s.o.cloth.pin
        for (let j = 0; j <= rows; j++)
            for (let i = 0; i <= cols; i++) {
                const k = j * (cols + 1) + i
                const x = (i / cols) * w
                const y = (j / rows) * h
                this.P[k * 3] = this.Q[k * 3] = this.R[k * 2] = x
                this.P[k * 3 + 1] = this.Q[k * 3 + 1] = this.R[k * 2 + 1] = y
                uv[k * 2] = i / cols
                uv[k * 2 + 1] = j / rows
                if (pinMode === "top" && j === 0) this.pin[k] = 1
                if (pinMode === "corners" && j === 0 && (i === 0 || i === cols))
                    this.pin[k] = 1
                if (pinMode === "left" && i === 0) this.pin[k] = 1
            }
        // constraints: [a, b, restLength, stiffness]
        const C = []
        const add = (a, b, s) =>
            C.push(
                a,
                b,
                Math.hypot(
                    this.R[a * 2] - this.R[b * 2],
                    this.R[a * 2 + 1] - this.R[b * 2 + 1]
                ),
                s
            )
        const id = (i, j) => j * (cols + 1) + i
        for (let j = 0; j <= rows; j++)
            for (let i = 0; i <= cols; i++) {
                if (i < cols) add(id(i, j), id(i + 1, j), 1)
                if (j < rows) add(id(i, j), id(i, j + 1), 1)
                if (i < cols && j < rows) {
                    add(id(i, j), id(i + 1, j + 1), 0.6)
                    add(id(i + 1, j), id(i, j + 1), 0.6)
                }
                if (i < cols - 1) add(id(i, j), id(i + 2, j), 0.25)
                if (j < rows - 1) add(id(i, j), id(i, j + 2), 0.25)
            }
        this.C = new Float32Array(C)
        const idx = []
        for (let j = 0; j < rows; j++)
            for (let i = 0; i < cols; i++) {
                const a = id(i, j),
                    b = id(i + 1, j),
                    c = id(i, j + 1),
                    d = id(i + 1, j + 1)
                idx.push(a, c, b, b, c, d)
            }
        this.count = idx.length
        const gl = this.gl
        gl.bindVertexArray(this.vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bPos)
        gl.bufferData(gl.ARRAY_BUFFER, this.P.byteLength, gl.DYNAMIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bUv)
        gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bNor)
        gl.bufferData(gl.ARRAY_BUFFER, this.N.byteLength, gl.DYNAMIC_DRAW)
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bIdx)
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER,
            new Uint16Array(idx),
            gl.STATIC_DRAW
        )
        gl.bindVertexArray(null)
        this.energy = 1
    }
    resize(w, h) {
        const changed =
            Math.abs(w - this.w) > 0.5 || Math.abs(h - this.h) > 0.5 || !this.P
        super.resize(w, h)
        if (this.broken) return
        this.pad = Math.round(
            Math.max(w, h) *
                (this.effectPad ?? (this.l.effect === "bend" ? 0.24 : 0.4))
        )
        this.sizeCanvas(
            w + this.pad * 2,
            h + this.pad * 2,
            -this.pad,
            -this.pad
        )
        if (changed) this.build(w, h)
        this.awake = true
        this.render()
    }
    pointer(u, v, x, y, vx, vy) {
        this.ptr = { x, y, vx, vy }
        this.awake = true
    }
    leave() {
        this.hover = false
        this.ptr = null
    }
    down(x, y) {
        if (!this.P) return false
        let best = -1
        let bd = Infinity
        const n = this.P.length / 3
        for (let k = 0; k < n; k++) {
            const d = (this.P[k * 3] - x) ** 2 + (this.P[k * 3 + 1] - y) ** 2
            if (d < bd) {
                bd = d
                best = k
            }
        }
        this.grab = best
        this.grabTo = { x, y }
        this.el.classList.add("is-grabbing")
        this.awake = true
        return true
    }
    drag(x, y) {
        this.grabTo = { x, y }
        this.awake = true
    }
    up() {
        this.grab = -1
        this.el.classList.remove("is-grabbing")
    }
    // the picture's edge as drawn on screen (same projection as the vertex shader)
    outline() {
        if (this.state !== "active" || !this.P || !this.ready) return null
        const P = this.P,
            cols = this.cols,
            rows = this.rows,
            w = this.w,
            h = this.h
        const n = (cols + 1) * (rows + 1)
        const X = new Float32Array(n)
        const Y = new Float32Array(n)
        for (let k = 0; k < n; k++) {
            const s = 1100 / Math.max(1100 - P[k * 3 + 2], 1)
            X[k] = w / 2 + (P[k * 3] - w / 2) * s
            Y[k] = h / 2 + (P[k * 3 + 1] - h / 2) * s
        }
        const at = (u, v) => {
            const fi = ssfxClamp(u, 0, 1) * cols,
                fj = ssfxClamp(v, 0, 1) * rows
            const i0 = Math.min(cols - 1, Math.floor(fi)),
                j0 = Math.min(rows - 1, Math.floor(fj))
            const tx = fi - i0,
                ty = fj - j0
            const a = j0 * (cols + 1) + i0,
                b = a + 1,
                c = a + cols + 1,
                d = c + 1
            return [
                (X[a] * (1 - tx) + X[b] * tx) * (1 - ty) +
                    (X[c] * (1 - tx) + X[d] * tx) * ty,
                (Y[a] * (1 - tx) + Y[b] * tx) * (1 - ty) +
                    (Y[c] * (1 - tx) + Y[d] * tx) * ty,
            ]
        }
        const r = this.s.contentRect(this.l, this.imgAspect, this.abox)
        const S = 24
        const edge = (u0, v0, u1, v1) =>
            Array.from({ length: S + 1 }, (_, k) =>
                at(u0 + ((u1 - u0) * k) / S, v0 + ((v1 - v0) * k) / S)
            )
        return [
            edge(r.u0, r.v0, r.u1, r.v0),
            edge(r.u1, r.v0, r.u1, r.v1),
            edge(r.u1, r.v1, r.u0, r.v1),
            edge(r.u0, r.v1, r.u0, r.v0),
        ]
    }
    // the layer itself moves (drop-in, board drift, drag): the fabric lags behind
    moved(vx, vy, dt) {
        const d = Math.max(dt || 1 / 60, 1 / 240)
        const ax = (vx - (this.lvx || 0)) / d
        const ay = (vy - (this.lvy || 0)) / d
        this.lvx = vx
        this.lvy = vy
        this.inx = ssfxClamp((this.inx || 0) + ax, -9000, 9000)
        this.iny = ssfxClamp((this.iny || 0) + ay, -9000, 9000)
        this.awake = true
    }
    alwaysOn() {
        return !!this.s.o.cloth.wind && !ssfxReduced()
    }
    step(h) {
        const P = this.P,
            Q = this.Q,
            R = this.R,
            pin = this.pin
        const n = P.length / 3
        const o = this.s.o.cloth
        const pinMode = this.l.cfg.pin || o.pin
        const kRest = pinMode === "none" ? 60 : pinMode === "top" ? 10 : 18
        const g = pinMode === "none" ? 0 : 900
        const wind = ssfxReduced()
            ? 0
            : (o.wind ?? 0.35) * Math.min(this.w, this.h) * 0.9
        const t = this.time
        const damp = 0.982
        const ptr = this.ptr
        const R2 = Math.pow(Math.min(this.w, this.h) * 0.24, 2)
        let energy = 0
        for (let k = 0; k < n; k++) {
            const i3 = k * 3
            if (pin[k] && k !== this.grab) {
                P[i3] = Q[i3] = R[k * 2]
                P[i3 + 1] = Q[i3 + 1] = R[k * 2 + 1]
                P[i3 + 2] = Q[i3 + 2] = 0
                continue
            }
            const x = P[i3],
                y = P[i3 + 1],
                z = P[i3 + 2]
            let vx = (x - Q[i3]) * damp,
                vy = (y - Q[i3 + 1]) * damp,
                vz = (z - Q[i3 + 2]) * damp
            energy += vx * vx + vy * vy + vz * vz
            Q[i3] = x
            Q[i3 + 1] = y
            Q[i3 + 2] = z
            let ax = (R[k * 2] - x) * kRest
            let ay = (R[k * 2 + 1] - y) * kRest + g * 0.08
            let az = -z * kRest * 0.6
            const ry = R[k * 2 + 1] / this.h
            if (wind)
                az +=
                    Math.sin(
                        t * 1.7 + R[k * 2] * 0.018 + R[k * 2 + 1] * 0.011
                    ) *
                    wind *
                    ry *
                    (0.6 + 0.4 * Math.sin(t * 0.43))
            if (this.inx || this.iny) {
                const reach =
                    pinMode === "none"
                        ? 0.5
                        : pinMode === "left"
                          ? R[k * 2] / this.w
                          : ry
                ax -= this.inx * 0.45 * reach
                ay -= this.iny * 0.45 * reach
                az +=
                    Math.hypot(this.inx, this.iny) *
                    0.08 *
                    reach *
                    Math.sin(R[k * 2] * 0.02 + t * 3)
            }
            if (ptr) {
                const dx = x - ptr.x,
                    dy = y - ptr.y
                const d2 = dx * dx + dy * dy
                if (d2 < R2) {
                    const f =
                        (1 - d2 / R2) ** 2 *
                        (o.push ?? 1) *
                        (this.l.cfg.strength ?? 1)
                    ax += ptr.vx * f * 2.2
                    ay += ptr.vy * f * 2.2
                    az -= (Math.hypot(ptr.vx, ptr.vy) * 3.2 + 160) * f
                }
            }
            P[i3] = x + vx + ax * h * h
            P[i3 + 1] = y + vy + ay * h * h
            P[i3 + 2] = z + vz + az * h * h
        }
        if (this.grab >= 0 && this.grabTo) {
            const i3 = this.grab * 3
            P[i3] += (this.grabTo.x - P[i3]) * 0.5
            P[i3 + 1] += (this.grabTo.y - P[i3 + 1]) * 0.5
            P[i3 + 2] += (Math.min(this.w, this.h) * 0.16 - P[i3 + 2]) * 0.3
        }
        const C = this.C
        const stiff = o.stiffness ?? 1
        for (let it = 0; it < 5; it++) {
            for (let c = 0; c < C.length; c += 4) {
                const a = C[c] * 3,
                    b = C[c + 1] * 3
                const dx = P[b] - P[a],
                    dy = P[b + 1] - P[a + 1],
                    dz = P[b + 2] - P[a + 2]
                const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6
                const diff = ((d - C[c + 2]) / d) * C[c + 3] * stiff * 0.5
                const pa = pin[C[c]] || C[c] === this.grab ? 0 : 1
                const pb = pin[C[c + 1]] || C[c + 1] === this.grab ? 0 : 1
                const s = pa + pb
                if (!s) continue
                const fa = (pa / s) * 2,
                    fb = (pb / s) * 2
                P[a] += dx * diff * fa
                P[a + 1] += dy * diff * fa
                P[a + 2] += dz * diff * fa
                P[b] -= dx * diff * fb
                P[b + 1] -= dy * diff * fb
                P[b + 2] -= dz * diff * fb
            }
        }
        this.energy = energy
    }
    normals() {
        const P = this.P,
            N = this.N,
            cols = this.cols,
            rows = this.rows
        const id = (i, j) =>
            (ssfxClamp(j, 0, rows) * (cols + 1) + ssfxClamp(i, 0, cols)) * 3
        for (let j = 0; j <= rows; j++)
            for (let i = 0; i <= cols; i++) {
                const l = id(i - 1, j),
                    r = id(i + 1, j),
                    u = id(i, j - 1),
                    d = id(i, j + 1)
                const ax = P[r] - P[l],
                    ay = P[r + 1] - P[l + 1],
                    az = P[r + 2] - P[l + 2]
                const bx = P[d] - P[u],
                    by = P[d + 1] - P[u + 1],
                    bz = P[d + 2] - P[u + 2]
                // y points down in our space, so this cross product faces the viewer (+z) when flat
                let nx = ay * bz - az * by,
                    ny = az * bx - ax * bz,
                    nz = ax * by - ay * bx
                const ln = Math.hypot(nx, ny, nz) || 1
                const k = id(i, j)
                N[k] = nx / ln
                N[k + 1] = ny / ln
                N[k + 2] = nz / ln
            }
    }
    tick(dt) {
        if (!this.P) return
        this.time += dt
        this.acc += Math.min(dt, 0.1)
        const h = 1 / 90
        let steps = 0
        while (this.acc >= h && steps < 6) {
            this.step(h)
            this.acc -= h
            steps++
        }
        if (this.ptr) {
            this.ptr.vx *= 0.5
            this.ptr.vy *= 0.5
        }
        this.inx = (this.inx || 0) * 0.5
        this.iny = (this.iny || 0) * 0.5
        if (Math.abs(this.inx) < 1) this.inx = 0
        if (Math.abs(this.iny) < 1) this.iny = 0
        this.render()
        const still =
            !this.hover &&
            this.grab < 0 &&
            this.energy < 0.02 &&
            !this.alwaysOn() &&
            !this.inx &&
            !this.iny
        if (still) this.awake = false
    }
    render() {
        if (!this.ready || !this.P || this.broken) return
        const gl = this.gl
        this.normals()
        gl.bindVertexArray(this.vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bPos)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.P)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bNor)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.N)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clearDepth(1)
        gl.enable(gl.DEPTH_TEST)
        gl.depthFunc(gl.LEQUAL)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.useProgram(this.prog.p)
        const u = this.prog.u
        gl.uniform2f(u.uCanvas, this.cw, this.ch)
        gl.uniform2f(u.uPad, this.pad, this.pad)
        gl.uniform2f(u.uCenter, this.w / 2, this.h / 2)
        gl.uniform1f(u.uPersp, 1100)
        gl.uniform2f(u.uSize, this.w, this.h)
        gl.uniform1f(
            u.uR,
            Math.min(this.s.radius(this.l), Math.min(this.w, this.h) / 2)
        )
        gl.uniform1f(
            u.uShade,
            ssfxClamp(
                Number(this.l.cfg.shading ?? this.s.o.cloth.shading ?? 0.55),
                0,
                2
            )
        )
        const cfg = this.l.cfg
        const fit = ssfxGL.fit(
            this.imgAspect,
            this.w / this.h,
            cfg.fit === "contain"
        )
        gl.uniform2f(u.uFit, fit[0], fit[1])
        gl.uniform1f(u.uPadF, (cfg.padding || 0) / 100)
        gl.uniform4fv(u.uBg, ssfxBg(cfg.background))
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.tex)
        gl.uniform1i(u.uImg, 0)
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0)
        gl.bindVertexArray(null)
    }
}

/* Bend — the picture is a sheet of paper that curls around a cylinder in the direction it moves:
   flick across it (or drag it) and it rolls up, then springs back flat. It unrolls when it lands
   during the drop-in, and rolls up and open again when clicked. */
class SsfxBend extends SsfxCloth {
    build(w, h) {
        super.build(w, h)
        this.pin.fill(0)
        // each value on its own: the intro may already have rolled the sheet up (roll() runs
        // before WebGL exists), and a half-set state would leave the curl stuck at NaN
        const num = (v, d) => (Number.isFinite(v) ? v : d)
        this.c = num(this.c, 0) // curl: 0 = flat, 1 = rolled into a tube
        this.cv = num(this.cv, 0)
        this.dx = num(this.dx, 1) // direction the sheet curls along
        this.dy = num(this.dy, 0)
        this.px = num(this.px, 0)
        this.py = num(this.py, 0)
        this.mx = num(this.mx, 0)
        this.my = num(this.my, 0)
        this.time = num(this.time, 0)
        this.rollUntil = num(this.rollUntil, 0)
    }
    pointer(u, v, x, y, vx, vy) {
        // the pointer moving across the sheet counts as the sheet moving the other way
        this.px += (-vx - this.px) * 0.4
        this.py += (-vy - this.py) * 0.4
        this.hu = u
        this.hv = v
        this.awake = true
    }
    enter() {
        this.hover = true
        this.awake = true
    }
    leave() {
        this.hover = false
        this.awake = true
    }
    down() {
        return false
    }
    moved(vx, vy) {
        this.mx += (vx - this.mx) * 0.5
        this.my += (vy - this.my) * 0.5
        this.awake = true
    }
    // rolled up as a tube until `delay` seconds from now, then unrolls
    roll(delay = 0, dir) {
        this.c = Math.max(this.c || 0, 0.98)
        this.cv = 0
        if (dir) {
            this.dx = dir[0]
            this.dy = dir[1]
        }
        this.rollUntil = (Number.isFinite(this.time) ? this.time : 0) + delay
        this.awake = true
    }
    click() {
        this.rollUntil = this.time + 0.22
        this.cv += 9
        this.awake = true
    }
    alwaysOn() {
        return (
            this.hover ||
            Math.abs(this.c) > 0.002 ||
            Math.abs(this.cv) > 0.01 ||
            Math.hypot(this.px + this.mx, this.py + this.my) > 4 ||
            this.time < this.rollUntil
        )
    }
    step(h) {
        const st = (this.l.cfg.strength ?? 1) * (this.s.o.bend?.amount ?? 1)
        const vx = this.px + this.mx
        const vy = this.py + this.my
        const sp = Math.hypot(vx, vy)
        if (sp > 60) {
            // turn the curl direction towards the motion, smoothly
            const k = 1 - Math.exp(-h * 10)
            this.dx += (vx / sp - this.dx) * k
            this.dy += (vy / sp - this.dy) * k
            const l = Math.hypot(this.dx, this.dy) || 1
            this.dx /= l
            this.dy /= l
        }
        // hovering: the sheet lifts into a soft bend along the side the pointer is on,
        // and rolls further the faster the pointer moves
        let lift = 0
        if (this.hover && this.hu !== undefined) {
            const ox = (this.hu - 0.5) * this.w
            const oy = (this.hv - 0.5) * this.h
            const ol = Math.hypot(ox, oy)
            if (ol > 2 && sp < 60) {
                const k = 1 - Math.exp(-h * 4)
                this.dx += (ox / ol - this.dx) * k
                this.dy += (oy / ol - this.dy) * k
                const l = Math.hypot(this.dx, this.dy) || 1
                this.dx /= l
                this.dy /= l
            }
            lift =
                0.14 +
                0.12 *
                    Math.min(1, (ol / (0.5 * Math.max(this.w, this.h))) ** 1.5)
        }
        let target = ssfxClamp((lift + sp / 900) * st, 0, 0.85)
        if (this.time < this.rollUntil) target = 1
        // spring with a little overshoot, like paper snapping flat
        this.cv += ((target - this.c) * 80 - this.cv * 7.5) * h
        this.c = ssfxClamp(this.c + this.cv * h, -0.25, 1)
        const d = Math.exp(-h * 3.5)
        this.px *= d
        this.py *= d
        this.mx *= d
        this.my *= d

        const P = this.P,
            R = this.R
        const n = P.length / 3
        const w = this.w,
            hh = this.h
        const dx = this.dx,
            dy = this.dy
        const half = Math.abs(dx) * w * 0.5 + Math.abs(dy) * hh * 0.5
        const theta = this.c * Math.PI * 2
        const rad = Math.abs(theta) > 1e-4 ? (2 * half) / theta : 0
        for (let k = 0; k < n; k++) {
            const px = R[k * 2] - w / 2
            const py = R[k * 2 + 1] - hh / 2
            const s = px * dx + py * dy // along the curl
            const t = -px * dy + py * dx // along the cylinder axis
            let s2 = s
            let z = 0
            if (rad) {
                const a = s / rad
                s2 = rad * Math.sin(a)
                z = -rad * (1 - Math.cos(a))
            }
            P[k * 3] = w / 2 + dx * s2 - dy * t
            P[k * 3 + 1] = hh / 2 + dy * s2 + dx * t
            P[k * 3 + 2] = z
        }
        this.energy = this.alwaysOn() ? 1 : 0
    }
}

const SSFX_EFFECTS = {
    tilt: SsfxTilt,
    fluid: SsfxFluid,
    liquid: SsfxLiquid,
    cloth: SsfxCloth,
    bend: SsfxBend,
    sequence: SsfxSequence,
    image: SsfxImage,
}

/* ------------------------------------------------------------------- stage */

class SelectionStageFX {
    constructor(root, options = {}) {
        if (!root) throw new Error("SelectionStageFX: no root element")
        this.root = root
        this.o = ssfxMerge(SSFX_DEFAULTS, options)
        this.layers = []
        this.hoverL = null
        this.frameL = null
        this.dragS = null
        this.visible = true
        this.ringA = 0
        this.ringV = 1
        this.btnHover = false
        this.raf = 0
        this.time = 0
        this.off = { x: 0, y: 0 }
        this.offT = { x: 0, y: 0 }
        this.loop = this.loop.bind(this)
        if (!this.o.interactive) this.stopAt = performance.now() + 1800
        this.injectCSS()
        this.build()
        this.wake()
    }

    get board() {
        return this.o.mode !== "classic"
    }

    injectCSS() {
        const doc = this.root.ownerDocument || document
        let s = doc.getElementById("ssfx-style")
        if (!s) {
            s = doc.createElement("style")
            s.id = "ssfx-style"
            doc.head.appendChild(s)
        }
        if (s.textContent !== SSFX_CSS) s.textContent = SSFX_CSS
    }

    build() {
        const o = this.o
        const w = (this.wrap = ssfxEl("div", "ssfx", this.root))
        if (!o.interactive) w.classList.add("is-static")
        if (o.contentAbove) w.classList.add("content-above")
        this.applyVars()

        this.bg = ssfxEl("div", "ssfx-bg", w)
        this.bg.dataset.style = o.backdrop.style || "none"
        if (o.backdrop.style === "artboard") {
            this.artboard = ssfxEl("div", "ssfx-artboard", this.bg)
            const lab = ssfxEl("div", "ssfx-artboard-label", this.artboard)
            lab.textContent = o.backdrop.label || ""
        }

        this.buildCenter()
        const layers =
            o.layers && o.layers.length
                ? o.layers
                : this.board
                  ? SSFX_BOARD_LAYERS
                  : SSFX_DEFAULT_LAYERS
        layers.forEach((cfg, i) => this.addLayer(cfg, i))

        this.guideV = ssfxEl("div", "ssfx-guide", w)
        this.guideH = ssfxEl("div", "ssfx-guide", w)
        this.guideV.style.display = this.guideH.style.display = "none"

        const f = (this.frame = ssfxEl("div", "ssfx-frame", w))
        f.innerHTML = `<svg class="ssfx-frame-svg" aria-hidden="true"><path class="ssfx-fp"/>${'<rect class="ssfx-fh" width="9" height="9" rx="2"/>'.repeat(8)}${'<rect class="ssfx-fhit" width="22" height="22"/>'.repeat(8)}</svg>`
        this.fPath = f.querySelector(".ssfx-fp")
        this.fHandles = [...f.querySelectorAll(".ssfx-fh")]
        this.fHits = [...f.querySelectorAll(".ssfx-fhit")]
        if (o.interactive) this.bindResize()
        this.tagEl = ssfxEl("div", "ssfx-tag", f)
        this.sizeEl = ssfxEl("div", "ssfx-size", f)

        this.ro = new ResizeObserver(() => this.layout())
        this.ro.observe(w)
        if (o.bleed && typeof MutationObserver !== "undefined") {
            // the sidebar changes the page padding through a style on <html>
            const doc = this.root.ownerDocument || document
            this.mo = new MutationObserver(() => this.layout())
            this.mo.observe(doc.documentElement, {
                attributes: true,
                attributeFilter: ["style"],
            })
            this.onWinResize = () => this.layout()
            window.addEventListener("resize", this.onWinResize)
        }
        this.io = new IntersectionObserver((e) => {
            this.visible = e[0].isIntersecting
            if (this.visible) this.wake()
        })
        this.io.observe(w)

        this.coarse =
            typeof matchMedia !== "undefined" &&
            matchMedia("(pointer: coarse)").matches
        if (o.interactive) {
            this.onMove = (e) => this.pointerMove(e)
            this.onUp = (e) => this.pointerUp(e)
            w.addEventListener("pointermove", this.onMove)
            w.addEventListener("pointerup", this.onUp)
            w.addEventListener("pointercancel", this.onUp)
            w.addEventListener("pointerleave", () => {
                if (this.logo && this.logo.hover && this.logo.fx) {
                    this.logo.hover = false
                    this.logo.fx.leave()
                }
                if (!this.dragS) this.setHover(null)
                if (this.board && this.o.board.returnOnLeave)
                    this.offT = { x: 0, y: 0 }
                this.wake()
            })
        }
        this.layout()
    }

    applyVars() {
        const o = this.o
        const st = this.wrap.style
        const bd = o.backdrop
        const tc = ssfxRgb(o.textColor).map((v) => Math.round(v * 255))
        const dark = ssfxLum(o.background) < 0.5
        st.setProperty(
            "--ssfx-bg",
            bd.style === "artboard"
                ? bd.pasteboard || (dark ? "#1B1B1F" : "#DCDAD4")
                : o.background
        )
        st.setProperty("--ssfx-board", bd.artboardColor || o.background)
        st.setProperty("--ssfx-text", o.textColor)
        st.setProperty("--ssfx-sel", o.selectionColor)
        st.setProperty("--ssfx-guide", o.guideColor)
        st.setProperty("--ssfx-r", o.radius + "px")
        st.setProperty("--ssfx-gap", o.gap + "px")
        st.setProperty("--ssfx-btn", o.button.size + "px")
        st.setProperty("--ssfx-btn-bg", o.button.background || o.selectionColor)
        st.setProperty("--ssfx-btn-fg", o.button.color)
        const gs = bd.size || 64
        st.setProperty("--ssfx-grid", gs + "px")
        st.setProperty("--ssfx-dotr", (gs < 14 ? 0.8 : gs < 28 ? 1 : 1.2) + "px")
        st.setProperty(
            "--ssfx-line2",
            bd.color
                ? `color-mix(in srgb, ${bd.color} 55%, transparent)`
                : `rgba(${tc[0]},${tc[1]},${tc[2]},${((bd.opacity ?? 0.08) * 0.55).toFixed(3)})`
        )
        st.setProperty(
            "--ssfx-line",
            bd.color ||
                `rgba(${tc[0]},${tc[1]},${tc[2]},${(bd.opacity ?? 0.08).toFixed(3)})`
        )
        st.setProperty(
            "--ssfx-dot",
            bd.color ||
                `rgba(${tc[0]},${tc[1]},${tc[2]},${Math.min(1, (bd.opacity ?? 0.08) * 2.2).toFixed(3)})`
        )
    }

    buildCenter() {
        const o = this.o
        const c = (this.center = ssfxEl("div", "ssfx-center", this.wrap))
        if (o.content) {
            if (typeof o.content === "string") c.innerHTML = o.content
            else c.appendChild(o.content)
        } else if (o.content !== false && o.headingImage) {
            this.buildLogo(c)
        } else if (o.content !== false && o.heading) {
            const h = ssfxEl(o.headingTag || "h1", "ssfx-heading", c)
            // *word* becomes italic
            h.innerHTML = String(o.heading)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            if (o.headingStyle) Object.assign(h.style, o.headingStyle)
            this.headingEl = h
        }
        if (o.subheading && !o.content) {
            const sub = ssfxEl("p", "ssfx-sub", c)
            sub.textContent = o.subheading
            if (o.subheadingStyle) Object.assign(sub.style, o.subheadingStyle)
        }
        const b = o.button
        if (!b.show) return
        const bw = ssfxEl("div", "ssfx-btnwrap", c)
        const btn = ssfxEl(b.link ? "a" : "button", "ssfx-btn", bw)
        if (b.link) {
            btn.href = b.link
            if (b.newTab) {
                btn.target = "_blank"
                btn.rel = "noopener"
            }
        } else btn.type = "button"
        btn.setAttribute(
            "aria-label",
            (b.text || "").replace(/[.\s]+$/, "") || "Open"
        )
        const text = String(b.text || "").trim()
        if (text) {
            const unit = text + " ✦ "
            const ring = unit.repeat(Math.max(1, Math.round(42 / unit.length)))
            const fs = Math.min(
                17,
                (2 * Math.PI * 80) / (ring.length * 0.68)
            ).toFixed(2)
            const id = "ssfx-p" + Math.random().toString(36).slice(2, 8)
            const R = 80
            const len = (2 * Math.PI * R).toFixed(1)
            btn.innerHTML = `<svg class="ssfx-ring" viewBox="0 0 200 200" aria-hidden="true"><defs><path id="${id}" d="M100,100 m-${R},0 a${R},${R} 0 1,1 ${R * 2},0 a${R},${R} 0 1,1 -${R * 2},0"/></defs><text dy="5" style="font-size:${fs}px"><textPath href="#${id}" textLength="${len}" lengthAdjust="spacing">${ring.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</textPath></text></svg>`
            this.ring = btn.querySelector(".ssfx-ring")
        }
        if (b.icon && b.icon !== "none" && SSFX_ICONS[b.icon]) {
            btn.insertAdjacentHTML(
                "beforeend",
                `<svg class="ssfx-icon" viewBox="0 0 24 24" aria-hidden="true">${SSFX_ICONS[b.icon]}</svg>`
            )
        }
        btn.addEventListener("pointerenter", () => (this.btnHover = true))
        btn.addEventListener("pointerleave", () => (this.btnHover = false))
        if (b.arrow)
            bw.insertAdjacentHTML(
                "beforeend",
                `<svg class="ssfx-arrow" viewBox="0 0 24 24" aria-hidden="true">${SSFX_ICONS.arrow}</svg>`
            )
        this.button = btn
    }

    // the heading as a logo picture, with the logo distortion on hover; it stays in place
    buildLogo(c) {
        const o = this.o
        let src = o.headingImage
        if (src && typeof src === "object" && src.src) src = src.src
        const h = ssfxEl(o.headingTag || "h1", "ssfx-heading ssfx-hlogo", c)
        const label = String(o.headingAlt || o.heading || "")
            .replace(/\*/g, "")
            .trim()
        if (label) ssfxEl("span", "ssfx-sr", h).textContent = label
        const box = ssfxEl("div", "ssfx-hlogo-box", h)
        box.setAttribute("aria-hidden", "true")
        this.headingEl = h
        const fxOn =
            o.interactive &&
            (o.headingFx?.effect ?? "fluid") !== "none" &&
            !ssfxReduced()
        const G = (this.logo = {
            cfg: {
                strength: o.headingFx?.strength ?? 0.55,
                tint: o.headingFx?.tint ?? 1,
                colors: o.headingFx?.colors || null,
                alt: label,
            },
            el: box,
            effect: "fluid",
            w: 1,
            h: 1,
            aspect: 6,
            hidden: false,
            hover: false,
        })
        if (fxOn) {
            // the texture is drawn from the logo at the size it is shown (sharp SVGs)
            G.raster = async (img, s) => {
                G.aspect = await ssfxAspect(s, img)
                this.layoutLogo()
                const d = Math.min(devicePixelRatio || 1, 2)
                return ssfxRaster(
                    img,
                    G.aspect,
                    ssfxClamp(G.w * d * 1.35, 900, 2600)
                )
            }
            G.fx = new SsfxFluid(this, G)
            G.fx.setImage(src)
        } else {
            const im = ssfxEl("img", "", box)
            im.alt = ""
            im.draggable = false
            im.src = ssfxSrc(src)
        }
        // the size follows the logo's own proportions
        ssfxLoadImage(ssfxSrc(src))
            .then((img) => ssfxAspect(ssfxSrc(src), img))
            .then((a) => {
                if (this.dead) return
                G.aspect = a
                this.layoutLogo()
            })
            .catch(() => {})
    }

    layoutLogo() {
        const G = this.logo
        if (!G || !this.W) return
        const o = this.o
        const pct = this.mobile
            ? (o.headingImageMobileWidth ?? 82)
            : (o.headingImageWidth ?? 46)
        const w = Math.min((pct / 100) * this.W, o.headingImageMaxWidth || 1e9)
        const h = w / (G.aspect || 6)
        G.w = w
        G.h = h
        G.el.style.width = w.toFixed(1) + "px"
        G.el.style.height = h.toFixed(1) + "px"
        const fx = G.fx
        if (!fx) return
        if (fx.state === "idle") fx.activate()
        if (Math.abs(fx.w - w) > 0.5 || Math.abs(fx.h - h) > 0.5)
            fx.resize(w, h)
        this.wake()
    }

    // the pointer over the logo (the logo itself lets the pointer through to the thumbs)
    logoPointer(p, vx, vy) {
        const G = this.logo
        if (!G || !G.fx) return
        const r = G.el.getBoundingClientRect()
        const wr = this.wrap.getBoundingClientRect()
        const lx = p.x - (r.left - wr.left)
        const ly = p.y - (r.top - wr.top)
        const m = Math.min(24, G.h * 0.25)
        const inside = p && lx > -m && ly > -m && lx < G.w + m && ly < G.h + m
        if (inside) {
            if (!G.hover) {
                G.hover = true
                G.fx.enter()
            }
            G.fx.pointer(lx / G.w, ly / G.h, lx, ly, vx, vy)
            this.wake()
        } else if (G.hover) {
            G.hover = false
            G.fx.leave()
            this.wake()
        }
    }

    addLayer(cfg, index) {
        const o = this.o
        const effect = SSFX_EFFECTS[cfg.effect] ? cfg.effect : "image"
        const el = ssfxEl("div", "ssfx-layer", this.wrap)
        el.dataset.effect = effect
        el.dataset.fit = cfg.fit || "cover"
        if (cfg.background) el.style.setProperty("--ssfx-lbg", cfg.background)
        if (cfg.fit) el.style.setProperty("--ssfx-fit", cfg.fit)
        if (cfg.padding) el.style.setProperty("--ssfx-pad", cfg.padding + "%")
        // a thumb's own corner radius (px); otherwise the stage's radius
        if (typeof cfg.radius === "number")
            el.style.setProperty("--ssfx-r", Math.max(0, cfg.radius) + "px")
        // a stable pseudo-random number per layer, for depth and the intro
        const rnd = (k) => {
            const x = Math.sin((index + 1) * 12.9898 + k * 78.233) * 43758.5453
            return x - Math.floor(x)
        }
        const spread = o.board.depth ?? 0.25
        const L = {
            cfg: { ...cfg },
            el,
            effect,
            index,
            rnd,
            x: cfg.x ?? 10,
            y: cfg.y ?? 10,
            bx: 0,
            by: 0,
            left: 0,
            top: 0,
            w: 100,
            h: 100,
            rot: 0,
            dragRot: 0,
            dragRotT: 0,
            iy: 0,
            ir: 0,
            depth: cfg.depth ?? 1 + (rnd(1) - 0.5) * 2 * spread,
            z: 2 + index,
            hasFrame: cfg.frame ?? effect !== "fluid",
            canDrag:
                o.drag &&
                (cfg.drag ?? (effect !== "fluid" && effect !== "cloth")),
        }
        el.style.zIndex = L.z
        if (L.canDrag) el.classList.add("can-drag")
        L.fx = new SSFX_EFFECTS[effect](this, L)
        let src = cfg.image
        if (src && typeof src === "object" && src.src) src = src.src
        if (effect === "sequence")
            L.fx.setImage(
                cfg.images && cfg.images.length
                    ? cfg.images
                    : src || cfg.video || SSFX_ART("marks")
            )
        else L.fx.setImage(src || this.defaultArt(effect, cfg.art))
        if (effect !== "sequence")
            this.detectShape(L, src || this.defaultArt(effect, cfg.art))
        // follow the picture's own proportions (cfg.aspect is used until it has loaded)
        if (cfg.autoAspect && src && effect !== "sequence") {
            const s0 = ssfxSrc(src)
            ssfxLoadImage(s0)
                .then((im) => ssfxAspect(s0, im))
                .then((a) => {
                    if (
                        this.dead ||
                        !(a > 0) ||
                        Math.abs(a - (L.cfg.aspect || 0)) < 0.004
                    )
                        return
                    L.cfg.aspect = a
                    if (this.W) this.layout()
                })
                .catch(() => {})
        }
        if (o.interactive) {
            el.addEventListener("pointerenter", () => {
                if (!this.dragS) this.setHover(L)
            })
            el.addEventListener("pointerleave", (e) => {
                if (this.onHandle(e.relatedTarget)) return
                if (!this.dragS && this.hoverL === L) this.setHover(null)
            })
            el.addEventListener("pointerdown", (e) => this.pointerDown(e, L))
        }
        this.layers.push(L)
        return L
    }

    defaultArt(effect, art) {
        if (art && SSFX_ART.has(art))
            return SSFX_ART(
                art,
                art === "wordmark" ? this.o.textColor : undefined
            )
        if (effect === "tilt") return SSFX_ART("poster")
        if (effect === "liquid") return SSFX_ART("photo")
        if (effect === "cloth") return SSFX_ART("cloth")
        if (effect === "bend") return SSFX_ART("swiss")
        if (effect === "fluid") return SSFX_ART("wordmark", this.o.textColor)
        return SSFX_ART("poster")
    }

    radius(L) {
        return L.cfg.radius ?? this.o.radius
    }

    // read the picture's own outline (rounded corners of a cut-out PNG) for the selection frame
    detectShape(L, src) {
        L.shape = null
        if (!src || L.effect === "fluid") return
        const s0 = ssfxSrc(src)
        ssfxLoadImage(s0)
            .then((im) => {
                if (this.dead || L.shapeSrc !== s0) return
                L.shape = ssfxCornerShape(im)
                L.shapeAspect =
                    (im.naturalWidth || im.width) /
                    (im.naturalHeight || im.height || 1)
                this.applyShape(L)
                if (this.frameL === L || this.fadeL === L) this.updateFrame(L)
            })
            .catch(() => {})
        L.shapeSrc = s0
    }

    // does the picture fill the layer edge to edge (so its own corners are the thumb's corners)?
    shapeFills(L) {
        const cfg = L.cfg
        if (cfg.fit === "contain") return !cfg.background
        return Math.abs((L.shapeAspect || 0) / (L.w / L.h || 1) - 1) < 0.04
    }

    // a picture with rounded corners of its own: the card (clip, bevel, shadow) takes that shape
    // and shows the whole picture, so the corners aren't cropped by the tilt's parallax
    applyShape(L) {
        const sh = L.shape
        const own = typeof L.cfg.radius === "number"
        const on =
            !own &&
            !!sh &&
            (sh.rx > 0 || sh.ry > 0) &&
            L.cfg.fit !== "contain" &&
            this.shapeFills(L)
        L.el.classList.toggle("is-shaped", on)
        if (on)
            L.el.style.setProperty(
                "--ssfx-r",
                `${(sh.rx * 100).toFixed(2)}% / ${(sh.ry * 100).toFixed(2)}%`
            )
        else if (own)
            L.el.style.setProperty("--ssfx-r", Math.max(0, L.cfg.radius) + "px")
        else L.el.style.removeProperty("--ssfx-r")
    }

    // corner radii of the frame, as a share of the framed box (null = square corners)
    frameRadii(L, rect, Wc, Hc) {
        const set = L.cfg.corners ?? this.o.frameCorners ?? "auto"
        if (set === "square" || set === 0 || set === false) return null
        let rx = 0,
            ry = 0
        if (typeof set === "number" && set > 0) rx = ry = set
        else if (typeof L.cfg.radius === "number" && L.effect !== "fluid") {
            const cutout = L.cfg.fit === "contain" && !L.cfg.background
            // the thumb's own radius is what you see, so the frame traces exactly that
            rx = ry = cutout ? 0 : Math.max(0, L.cfg.radius)
        } else {
            const full =
                rect.u0 <= 0.001 &&
                rect.v0 <= 0.001 &&
                rect.u1 >= 0.999 &&
                rect.v1 >= 0.999
            const cutout = L.cfg.fit === "contain" && !L.cfg.background
            // the layer's own corner radius (the thumb is clipped to it); cut-outs keep their own outline
            if (full && !cutout && L.effect !== "fluid")
                rx = ry = this.radius(L) || 0
            // the picture's own rounded corners, when the picture fills the framed box
            const sh = L.shape
            const cfg = L.cfg
            if (sh && (sh.rx > 0 || sh.ry > 0)) {
                if (this.shapeFills(L)) {
                    rx = Math.max(rx, sh.rx * Wc)
                    ry = Math.max(ry, sh.ry * Hc)
                }
            }
        }
        const m = Math.min(Wc, Hc) / 2
        rx = Math.min(rx, m)
        ry = Math.min(ry, m)
        if (rx < 0.75 || ry < 0.75) return null
        return { ru: rx / Wc, rv: ry / Hc, px: Math.min(rx, ry) }
    }

    /* layout */
    // run the board under a sidebar: reach the window's left edge, and open the left side
    // of any clipping parent frames (Framer clips page roots) without unclipping the rest
    applyBleed() {
        if (!this.o.bleed || !this.o.interactive) return
        const doc = this.root.ownerDocument || document
        const pad = Math.max(
            0,
            Math.round(this.root.getBoundingClientRect().left)
        )
        if (pad !== this.bleedPx) {
            this.bleedPx = pad
            this.wrap.style.marginLeft = pad ? -pad + "px" : ""
            this.wrap.style.width = pad ? `calc(100% + ${pad}px)` : ""
            this.center.style.marginLeft = pad ? pad / 2 + "px" : ""
        }
        this.bleedOpened = this.bleedOpened || []
        let n = this.root.parentElement
        while (n && n !== doc.body && n !== doc.documentElement) {
            let rec = this.bleedOpened.find((r) => r.el === n)
            const cs = getComputedStyle(n)
            const clips =
                rec || cs.overflowX === "hidden" || cs.overflowX === "clip"
            if (clips) {
                if (!rec) {
                    rec = {
                        el: n,
                        overflow: n.style.overflow,
                        clipPath: n.style.clipPath,
                    }
                    this.bleedOpened.push(rec)
                }
                const left = Math.max(
                    0,
                    Math.ceil(n.getBoundingClientRect().left)
                )
                n.style.overflow = "visible"
                n.style.clipPath = `inset(0 0 0 ${-left - 1}px)`
            }
            n = n.parentElement
        }
        if (this.bleedOpened.length && this.bodyOverflowX === undefined) {
            // the frames no longer clip sideways, so stop wide content from scrolling the page
            this.bodyOverflowX = doc.body.style.overflowX
            doc.body.style.overflowX = "hidden"
        }
    }

    restoreBleed() {
        ;(this.bleedOpened || []).forEach((r) => {
            r.el.style.overflow = r.overflow
            r.el.style.clipPath = r.clipPath
        })
        this.bleedOpened = []
        if (this.bodyOverflowX !== undefined) {
            ;(this.root.ownerDocument || document).body.style.overflowX =
                this.bodyOverflowX
            this.bodyOverflowX = undefined
        }
    }

    layout() {
        this.applyBleed()
        const W = this.wrap.clientWidth
        const H = this.wrap.clientHeight
        if (!W) return
        const first = !this.W
        this.W = W
        this.H = H
        const o = this.o
        const mobile = W < o.mobileBreakpoint
        this.mobile = mobile
        this.layoutLogo()
        const stack = mobile && !this.board
        this.wrap.classList.toggle("is-mobile", stack)
        this.wrap.classList.toggle("is-touch", mobile)
        if (!stack) {
            this.wrap.style.minHeight = ""
            const b = o.board
            const basis = this.board
                ? ssfxClamp(W, b.minBasis ?? 720, b.maxBasis ?? 1680) *
                  (mobile ? (b.mobileScale ?? 1) : 1)
                : W
            this.basis = basis
            for (const L of this.layers) {
                const hide = mobile && L.cfg.mobile === "Hide"
                L.el.style.display = hide ? "none" : ""
                L.hidden = hide
                L.w = (L.cfg.width / 100) * basis
                L.h = L.w / (L.cfg.aspect || 1)
                L.bx = (L.x / 100) * W
                L.by = (L.y / 100) * H
                L.rot = L.cfg.rotation || 0
                if (L.shape) this.applyShape(L)
                L.el.classList.toggle(
                    "touch-drag",
                    mobile && o.dragOnTouch && L.canDrag
                )
                this.size(L)
            }
        } else {
            const pad = 16
            const gap = 12
            const top = this.center.offsetHeight + 8
            const colW = (W - pad * 2 - gap) / 2
            const colsY = [top, top + colW * 0.28]
            for (const L of this.layers) {
                const mode = L.cfg.mobile || "Show"
                L.hidden = mode === "Hide"
                if (L.hidden) {
                    L.el.style.display = "none"
                    continue
                }
                L.el.style.display = ""
                const wide = mode === "Wide"
                const c = wide
                    ? colsY[0] > colsY[1]
                        ? 1
                        : 0
                    : colsY[0] <= colsY[1]
                      ? 0
                      : 1
                L.w = wide ? W - pad * 2 : colW
                L.h = L.w / (L.cfg.aspect || 1)
                if (wide) {
                    const y = Math.max(colsY[0], colsY[1])
                    L.bx = pad
                    L.by = y
                    colsY[0] = colsY[1] = y + L.h + gap
                } else {
                    L.bx = pad + c * (colW + gap)
                    L.by = colsY[c]
                    colsY[c] += L.h + gap
                }
                L.rot = (L.cfg.rotation || 0) * 0.5
                L.el.classList.toggle("touch-drag", o.dragOnTouch && L.canDrag)
                this.size(L)
            }
            this.wrap.style.minHeight =
                Math.ceil(Math.max(colsY[0], colsY[1]) + pad + 24) + "px"
        }
        if (this.artboard) {
            const bd = o.backdrop
            this.artboard.style.width =
                ((bd.artboardWidth ?? 74) / 100) * W + "px"
            this.artboard.style.height =
                ((bd.artboardHeight ?? 78) / 100) * H + "px"
        }
        if (first) this.startIntro()
        this.positionAll(0)
        for (const L of this.layers) {
            // during the drop-in the layers start above the stage: judge by where they land
            const iy = L.iy
            L.top -= iy
            this.wakeGL(L)
            L.top += iy
        }
        if (!this.o.interactive && this.o.staticFrameLayer >= 0) {
            const L = this.layers[this.o.staticFrameLayer]
            if (L && !L.hidden) this.showFrame(L, false)
        } else if (this.frameL) this.showFrame(this.frameL, false)
        this.wake()
    }

    size(L) {
        L.el.style.width = L.w + "px"
        L.el.style.height = L.h + "px"
        if (Math.abs(L.fx.w - L.w) > 0.5 || Math.abs(L.fx.h - L.h) > 0.5)
            L.fx.resize(L.w, L.h)
    }

    positionAll(dt) {
        for (const L of this.layers) {
            if (L.hidden) continue
            if (
                this.dragS &&
                this.dragS.L === L &&
                (this.dragS.mode === "move" || this.dragS.mode === "resize")
            )
                continue
            const nl = L.bx + this.off.x * L.depth
            const nt = L.by + this.off.y * L.depth + L.iy
            if (dt > 0) {
                const vx = (nl - L.left) / dt
                const vy = (nt - L.top) / dt
                const moving = Math.abs(vx) + Math.abs(vy) > 2
                if (moving || L.mv) L.fx.moved(vx, vy, dt)
                L.mv = moving
            }
            L.left = nl
            L.top = nt
            this.transform(L)
        }
        if (this.board) {
            const p = this.o.backdrop.parallax ?? 0.35
            const x = this.off.x * p
            const y = this.off.y * p
            if (this.artboard)
                this.artboard.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
            else
                this.bg.style.backgroundPosition = `${x.toFixed(1)}px ${y.toFixed(1)}px`
        }
        if (this.frameL) this.updateFrame()
        else if (this.fadeL) this.updateFrame(this.fadeL)
    }

    transform(L) {
        const s =
            (this.dragS && this.dragS.L === L && this.dragS.moved ? 1.025 : 1) *
            (L.rs || 1)
        L.el.style.transform = `translate3d(${L.left.toFixed(1)}px, ${L.top.toFixed(1)}px, 0) rotate(${(L.rot + L.dragRot + L.ir).toFixed(2)}deg) scale(${s})`
    }

    // create WebGL for layers that come into view; bring it back if the browser dropped it
    wakeGL(L) {
        const fx = L.fx
        if (!fx.activate || L.hidden) return
        if (fx.state === "idle" && this.inView(L, 260)) fx.activate()
        else if (
            fx.state === "lost" &&
            this.inView(L, 0) &&
            performance.now() - fx.lostAt > 1200
        )
            fx.revive()
    }

    inView(L, pad = 80) {
        return (
            !L.hidden &&
            L.left < this.W + pad &&
            L.left + L.w > -pad &&
            L.top < this.H + pad &&
            L.top + L.h > -pad
        )
    }

    /* intro: the thumbs drop in */
    startIntro() {
        const it = this.o.intro
        if (!it || !it.drop || !this.o.interactive || ssfxReduced()) return
        const order = this.layers
            .filter((L) => !L.hidden)
            .sort((a, b) => a.by + a.rnd(3) * 120 - (b.by + b.rnd(3) * 120))
        order.forEach((L, i) => {
            L.intro = {
                delay: (it.delay ?? 0.15) + i * (it.stagger ?? 0.07),
                y: -(L.by + L.h + 40 + L.rnd(4) * this.H * 0.35),
                v: 0,
                r: (L.rnd(5) - 0.5) * 2 * (it.spin ?? 14),
                rv: 0,
            }
            L.iy = L.intro.y
            L.ir = L.intro.r
            if (L.fx.roll) L.fx.roll(L.intro.delay + 0.32, [1, 0])
        })
        this.introT = 0
    }

    replayIntro() {
        this.startIntro()
        this.positionAll(0)
        this.wake()
    }

    stepIntro(dt) {
        let active = false
        const it = this.o.intro
        const w = it.speed ?? 9
        const zeta = 1 - ssfxClamp(it.bounce ?? 0.4, 0, 0.9)
        this.introT = (this.introT || 0) + dt
        for (const L of this.layers) {
            const s = L.intro
            if (!s) continue
            active = true
            if (this.introT < s.delay) continue
            const n = 3
            const h = dt / n
            for (let i = 0; i < n; i++) {
                s.v += (-w * w * s.y - 2 * zeta * w * s.v) * h
                s.y += s.v * h
                s.rv += (-w * w * 0.8 * s.r - 2 * 0.55 * w * s.rv) * h
                s.r += s.rv * h
            }
            L.iy = s.y
            L.ir = s.r
            if (
                Math.abs(s.y) < 0.3 &&
                Math.abs(s.v) < 4 &&
                Math.abs(s.r) < 0.05
            ) {
                L.iy = L.ir = 0
                L.intro = null
            }
        }
        return active
    }

    /* selection frame */
    setHover(L) {
        if (L === this.hoverL) return
        const prev = this.hoverL
        this.hoverL = L
        if (prev) prev.fx.leave()
        if (L) {
            L.fx.enter()
            const hold = this.o.board.holdOnHover
            if (this.board && hold !== false && hold !== 1 && this.lastBoardP) {
                this.offT = { x: this.off.x, y: this.off.y }
                this.anchor = {
                    off: { ...this.offT },
                    t: this.boardTarget(this.lastBoardP),
                }
            }
            this.release = null
            this.wake()
        } else {
            // let go of the hold gradually, so the thumb (and its frame) drift back instead of snapping
            const A = this.anchor
            this.anchor = null
            if (
                this.board &&
                A &&
                !this.dragS &&
                (this.o.board.releaseTime ?? 1.1) > 0
            )
                this.release = { off: A.off, t: A.t, t0: performance.now() }
            else if (this.board && this.lastBoardP && !this.dragS)
                this.offT = this.boardTarget(this.lastBoardP)
            this.wake()
        }
        if (L && L.hasFrame)
            this.showFrame(
                L,
                !!prev && prev.hasFrame && this.frame.classList.contains("on")
            )
        else this.hideFrame()
    }

    // ease the hold out: the share of cursor movement the board follows goes back up to 1
    releaseStep(t) {
        const R = this.release
        const hold =
            this.o.board.holdOnHover === true
                ? 0
                : (this.o.board.holdOnHover ?? 0.12)
        const k = ssfxClamp(
            (performance.now() - R.t0) /
                1000 /
                (this.o.board.releaseTime ?? 1.1),
            0,
            1
        )
        const g = hold + (1 - hold) * k * k * (3 - 2 * k)
        this.offT = {
            x: R.off.x + (t.x - R.t.x) * g,
            y: R.off.y + (t.y - R.t.y) * g,
        }
        if (k >= 1) this.release = null
    }

    showFrame(L, glide) {
        this.fadeL = null
        this.frameL = L
        const f = this.frame
        this.glide =
            glide && this.framePts
                ? {
                      from: this.framePts.map((p) => p.slice()),
                      fromH: (this.frameH || []).map((p) => p.slice()),
                      t0: performance.now(),
                  }
                : null
        this.updateFrame()
        f.classList.add("on")
        this.refreshTag()
    }

    hideFrame() {
        this.frame.classList.remove("on")
        // keep the frame on its thumb while it fades out
        if (this.frameL) {
            this.fadeL = this.frameL
            this.fadeUntil = performance.now() + 400
        }
        this.frameL = null
        this.wake()
    }

    // the part of the layer the picture covers (0–1): all of it, unless it's a cut-out
    // picture shown with fit "contain" and no background colour
    contentRect(L, aspect, abox) {
        const cfg = L.cfg
        if (cfg.fit !== "contain" || cfg.background || !aspect)
            return { u0: 0, v0: 0, u1: 1, v1: 1 }
        const pad = (cfg.padding || 0) / 100
        const bw = 1 - pad * 2
        const bh = 1 - ((pad * L.w) / L.h) * 2
        const box = (bw * L.w) / (bh * L.h)
        const sw = aspect > box ? bw : (bh * L.h * aspect) / L.w
        const sh = aspect > box ? (bw * L.w) / aspect / L.h : bh
        const r = {
            u0: 0.5 - sw / 2,
            v0: 0.5 - sh / 2,
            u1: 0.5 + sw / 2,
            v1: 0.5 + sh / 2,
        }
        if (!abox) return r
        // hug the visible pixels of a cut-out picture
        return {
            u0: r.u0 + abox.x0 * sw,
            u1: r.u0 + abox.x1 * sw,
            v0: r.v0 + abox.y0 * sh,
            v1: r.v0 + abox.y1 * sh,
        }
    }

    // the frame traces the picture's outline as it is on screen right now (tilted, curled, rippling),
    // with rounded corners where the thumb has them
    updateFrame(L = this.frameL) {
        if (!L) return
        const N = 12 // points per straight side
        const A = 7 // points per corner arc
        const img = L.fx.srcImg || L.fx.img || L.fx.ph
        const aspect =
            L.fx.imgAspect ||
            (img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : 0)
        const rect = this.contentRect(
            L,
            aspect,
            L.fx.abox ||
                (img &&
                img.naturalWidth &&
                L.cfg.fit === "contain" &&
                !L.cfg.background
                    ? ssfxAlphaBox(img)
                    : null)
        )
        let edges = L.fx.outline && L.fx.outline()
        // the tilted card is the whole layer
        const whole = edges && L.effect === "tilt"
        const box = whole ? { u0: 0, v0: 0, u1: 1, v1: 1 } : rect
        if (!edges) {
            const x0 = rect.u0 * L.w,
                x1 = rect.u1 * L.w,
                y0 = rect.v0 * L.h,
                y1 = rect.v1 * L.h
            edges = [
                [
                    [x0, y0],
                    [x1, y0],
                ],
                [
                    [x1, y0],
                    [x1, y1],
                ],
                [
                    [x1, y1],
                    [x0, y1],
                ],
                [
                    [x0, y1],
                    [x0, y0],
                ],
            ]
        }
        // a Coons patch over the four (possibly curved) edges: any (u, v) of the box → layer pixels
        const top = ssfxPoly(edges[0]),
            right = ssfxPoly(edges[1]),
            bottom = ssfxPoly(edges[2]),
            left = ssfxPoly(edges[3])
        const c00 = edges[0][0],
            c10 = edges[1][0],
            c11 = edges[2][0],
            c01 = edges[3][0]
        const at = (u, v) => {
            const T = top(u),
                B = bottom(1 - u),
                Lf = left(1 - v),
                R = right(v)
            const p = []
            for (let i = 0; i < 2; i++)
                p.push(
                    (1 - v) * T[i] +
                        v * B[i] +
                        (1 - u) * Lf[i] +
                        u * R[i] -
                        ((1 - u) * (1 - v) * c00[i] +
                            u * (1 - v) * c10[i] +
                            (1 - u) * v * c01[i] +
                            u * v * c11[i])
                )
            return p
        }
        const Wc = Math.max(1, (box.u1 - box.u0) * L.w)
        const Hc = Math.max(1, (box.v1 - box.v0) * L.h)
        const rad = this.frameRadii(L, box, Wc, Hc)
        const ru = rad ? rad.ru : 0,
            rv = rad ? rad.rv : 0
        // the outline in (u, v): corner arc, straight side, corner arc …
        const UV = []
        const arcs = [
            [ru, rv, Math.PI],
            [1 - ru, rv, Math.PI * 1.5],
            [1 - ru, 1 - rv, 0],
            [ru, 1 - rv, Math.PI * 0.5],
        ]
        for (let c = 0; c < 4; c++) {
            const [cu, cv, a0] = arcs[c]
            for (let k = 0; k < A; k++) {
                const a = a0 + (Math.PI / 2) * (k / (A - 1))
                UV.push([cu + ru * Math.cos(a), cv + rv * Math.sin(a)])
            }
            const p = UV[UV.length - 1]
            const [nu, nv, na] = arcs[(c + 1) % 4]
            const q = [nu + ru * Math.cos(na), nv + rv * Math.sin(na)]
            for (let k = 1; k < N; k++)
                UV.push([
                    p[0] + ((q[0] - p[0]) * k) / N,
                    p[1] + ((q[1] - p[1]) * k) / N,
                ])
        }
        const S = L.rs || 1
        const r = ((L.rot + L.dragRot + L.ir) * Math.PI) / 180
        const co = Math.cos(r)
        const si = Math.sin(r)
        const cx = L.left + L.w / 2
        const cy = L.top + L.h / 2
        const toStage = (uv) => {
            const q = at(uv[0], uv[1])
            const x = (q[0] - L.w / 2) * S
            const y = (q[1] - L.h / 2) * S
            return [cx + x * co - y * si, cy + x * si + y * co]
        }
        let P = UV.map(toStage)
        // handles: corners + side middles; on rounded corners they sit where each arc meets its sides
        // (or on the arc itself when the radius is small)
        const big = rad && rad.px * S >= 11
        const hUV = !rad
            ? [
                  [0, 0],
                  [0.5, 0],
                  [1, 0],
                  [1, 0.5],
                  [1, 1],
                  [0.5, 1],
                  [0, 1],
                  [0, 0.5],
              ]
            : big
              ? [
                    [ru, 0],
                    [1 - ru, 0],
                    [1, rv],
                    [1, 1 - rv],
                    [1 - ru, 1],
                    [ru, 1],
                    [0, 1 - rv],
                    [0, rv],
                ]
              : [
                    [ru * (1 - Math.SQRT1_2), rv * (1 - Math.SQRT1_2)],
                    [0.5, 0],
                    [1 - ru * (1 - Math.SQRT1_2), rv * (1 - Math.SQRT1_2)],
                    [1, 0.5],
                    [1 - ru * (1 - Math.SQRT1_2), 1 - rv * (1 - Math.SQRT1_2)],
                    [0.5, 1],
                    [ru * (1 - Math.SQRT1_2), 1 - rv * (1 - Math.SQRT1_2)],
                    [0, 0.5],
                ]
        let H = hUV.map(toStage)
        if (this.glide) {
            const t = Math.min(1, (performance.now() - this.glide.t0) / 380)
            const ease = 1 - Math.pow(1 - t, 3)
            const F = this.glide.from
            const FH = this.glide.fromH
            if (F && F.length === P.length)
                P = P.map((p, n) => [
                    F[n][0] + (p[0] - F[n][0]) * ease,
                    F[n][1] + (p[1] - F[n][1]) * ease,
                ])
            if (FH && FH.length === H.length)
                H = H.map((p, n) => [
                    FH[n][0] + (p[0] - FH[n][0]) * ease,
                    FH[n][1] + (p[1] - FH[n][1]) * ease,
                ])
            if (t >= 1) this.glide = null
        }
        this.framePts = P
        this.frameH = H
        let d = ""
        for (let n = 0; n < P.length; n++)
            d += (n ? "L" : "M") + P[n][0].toFixed(1) + " " + P[n][1].toFixed(1)
        this.fPath.setAttribute("d", d + "Z")
        const hr = rad ? "4.5" : "2"
        // which way each handle resizes (cursor), turned with the thumb
        const deg = (L.rot + L.dragRot + L.ir) % 180
        const cur = (base) => {
            const a = (((base + deg) % 180) + 180) % 180
            return a < 22.5 || a >= 157.5
                ? "ew-resize"
                : a < 67.5
                  ? "nwse-resize"
                  : a < 112.5
                    ? "ns-resize"
                    : "nesw-resize"
        }
        const bases = rad
            ? big
                ? [45, 45, 135, 135, 45, 45, 135, 135]
                : [45, 90, 135, 0, 45, 90, 135, 0]
            : [45, 90, 135, 0, 45, 90, 135, 0]
        for (let h = 0; h < 8; h++) {
            const p = H[h]
            const el = this.fHandles[h]
            el.setAttribute("x", (p[0] - 4.5).toFixed(1))
            el.setAttribute("y", (p[1] - 4.5).toFixed(1))
            if (el.getAttribute("rx") !== hr) el.setAttribute("rx", hr)
            const hit = this.fHits[h]
            hit.setAttribute("x", (p[0] - 11).toFixed(1))
            hit.setAttribute("y", (p[1] - 11).toFixed(1))
            const c = cur(bases[h])
            if (hit.style.cursor !== c) hit.style.cursor = c
        }
        this.frameHUV = hUV
        this.frame.classList.toggle("can-resize", this.canResize(L))
        // labels follow the top and bottom edges (from the sharp corners of the box)
        const tl = toStage([0, 0])
        const tr = toStage([1, 0])
        const ta = (Math.atan2(tr[1] - tl[1], tr[0] - tl[0]) * 180) / Math.PI
        this.tagEl.style.transform = `translate(${tl[0].toFixed(1)}px, ${tl[1].toFixed(1)}px) rotate(${ta.toFixed(2)}deg) translate(-1px, calc(-100% - 9px))`
        const bm = toStage([0.5, 1])
        const br = toStage([1, 1])
        const bl = toStage([0, 1])
        const ba = (Math.atan2(br[1] - bl[1], br[0] - bl[0]) * 180) / Math.PI
        this.sizeEl.style.transform = `translate(${bm[0].toFixed(1)}px, ${bm[1].toFixed(1)}px) rotate(${ba.toFixed(2)}deg) translate(-50%, 9px)`
        this.sizeEl.classList.toggle("is-off", this.o.showSize === false)
        const sz = `${Math.round(L.w * S)} × ${Math.round(L.h * S)}`
        if (this.sizeEl.textContent !== sz) this.sizeEl.textContent = sz
    }

    /* resize: drag a handle of the selection frame */
    canResize(L) {
        return (
            !!L &&
            this.o.interactive &&
            this.o.resize !== false &&
            L.cfg.resize !== false &&
            !(this.mobile && !this.board) &&
            !this.coarse
        )
    }

    onHandle(el) {
        return !!(el && el.classList && el.classList.contains("ssfx-fhit"))
    }

    bindResize() {
        this.fHits.forEach((hit, h) => {
            hit.addEventListener("pointerdown", (e) => this.resizeDown(e, h))
            hit.addEventListener("pointerleave", (e) => {
                if (this.dragS) return
                const to = e.relatedTarget
                if (this.onHandle(to)) return
                const L = this.hoverL
                if (L && to && L.el.contains(to)) return
                this.setHover(
                    to ? this.layers.find((l) => l.el.contains(to)) || null : null
                )
            })
        })
    }

    resizeDown(e, h) {
        const L = this.frameL
        if (e.button > 0 || !L || !this.canResize(L) || this.dragS) return
        const uv = this.frameHUV[h]
        // the point that stays put: the opposite corner (or the opposite side for a side handle)
        const side = (v) => (v < 0.34 ? 0 : v > 0.66 ? 1 : 0.5)
        const hu = side(uv[0]),
            hv = side(uv[1])
        const au = hu === 0.5 ? 0.5 : 1 - hu,
            av = hv === 0.5 ? 0.5 : 1 - hv
        const th = ((L.rot + L.dragRot + L.ir) * Math.PI) / 180
        const w0 = L.w,
            h0 = L.h
        // anchor and handle relative to the centre, unrotated
        const a0 = [(au - 0.5) * w0, (av - 0.5) * h0]
        const d0 = [(hu - au) * w0, (hv - av) * h0]
        const cx = L.left + w0 / 2,
            cy = L.top + h0 / 2
        const Aw = [
            cx + a0[0] * Math.cos(th) - a0[1] * Math.sin(th),
            cy + a0[0] * Math.sin(th) + a0[1] * Math.cos(th),
        ]
        this.dragS = {
            L,
            mode: "resize",
            th,
            Aw,
            a0,
            d0,
            w0,
            h0,
            p0: this.point(e),
            el: e.currentTarget,
        }
        L.rs = 1
        this.zTop = (this.zTop || 30) + 1
        L.el.style.zIndex = this.zTop
        this.wrap.classList.add("is-resizing")
        try {
            e.currentTarget.setPointerCapture(e.pointerId)
        } catch (err) {}
        this.hoverMoveR = (ev) => this.resizeMove(ev)
        this.hoverUpR = (ev) => this.resizeUp(ev)
        e.currentTarget.addEventListener("pointermove", this.hoverMoveR)
        e.currentTarget.addEventListener("pointerup", this.hoverUpR)
        e.currentTarget.addEventListener("pointercancel", this.hoverUpR)
        e.preventDefault()
        e.stopPropagation()
        this.wake()
    }

    resizeMove(e) {
        const D = this.dragS
        if (!D || D.mode !== "resize") return
        e.stopPropagation()
        const L = D.L
        const p = this.point(e)
        const vx = p.x - D.Aw[0],
            vy = p.y - D.Aw[1]
        const c = Math.cos(-D.th),
            s = Math.sin(-D.th)
        const lx = vx * c - vy * s,
            ly = vx * s + vy * c
        const dd = D.d0[0] * D.d0[0] + D.d0[1] * D.d0[1] || 1
        let k = (lx * D.d0[0] + ly * D.d0[1]) / dd
        const minK = (this.o.minSize ?? 56) / Math.min(D.w0, D.h0)
        const maxK = (Math.max(this.W, this.H) * 0.95) / Math.max(D.w0, D.h0)
        k = ssfxClamp(k, Math.min(1, minK), Math.max(1, maxK))
        L.rs = k
        // keep the anchor in place: the centre moves with the scale
        const ax = D.a0[0] * k,
            ay = D.a0[1] * k
        const C = [
            D.Aw[0] - (ax * Math.cos(D.th) - ay * Math.sin(D.th)),
            D.Aw[1] - (ax * Math.sin(D.th) + ay * Math.cos(D.th)),
        ]
        this.placeAt(L, C[0] - D.w0 / 2, C[1] - D.h0 / 2)
        this.transform(L)
        this.updateFrame()
        this.wake()
    }

    resizeUp(e) {
        const D = this.dragS
        if (!D || D.mode !== "resize") return
        e.stopPropagation()
        this.dragS = null
        const el = D.el
        try {
            el.releasePointerCapture(e.pointerId)
        } catch (err) {}
        el.removeEventListener("pointermove", this.hoverMoveR)
        el.removeEventListener("pointerup", this.hoverUpR)
        el.removeEventListener("pointercancel", this.hoverUpR)
        this.wrap.classList.remove("is-resizing")
        const L = D.L
        const k = L.rs || 1
        L.rs = 1
        // bake the scale into the layer's real size (crisp pictures, WebGL at the new size)
        const cx = L.left + L.w / 2,
            cy = L.top + L.h / 2
        L.w *= k
        L.h *= k
        if (this.basis) L.cfg.width = (L.w / this.basis) * 100
        this.size(L)
        this.placeAt(L, cx - L.w / 2, cy - L.h / 2)
        this.transform(L)
        this.updateFrame()
        const doc = this.root.ownerDocument || document
        const under = doc.elementFromPoint(e.clientX, e.clientY)
        if (!this.onHandle(under)) {
            const over = under
                ? this.layers.find((l) => l.el.contains(under))
                : null
            this.setHover(over || null)
        }
        this.wake()
    }

    // put a layer at a stage position, keeping its spot on the drifting board in step
    placeAt(L, left, top) {
        L.left = left
        L.top = top
        L.bx = left - this.off.x * L.depth
        L.by = top - this.off.y * L.depth - L.iy
        L.x = (L.bx / this.W) * 100
        L.y = (L.by / this.H) * 100
    }

    refreshTag() {
        const L = this.frameL
        if (!L) return
        const extra = L.fx.tag()
        if (this.o.tagStyle === "badge") {
            const esc = (t) =>
                String(t)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
            const kind = String(L.cfg.kind ?? "").trim()
            const nm = String(L.cfg.name ?? "").trim()
            const html = `${kind ? `<b>${esc(kind)}</b>` : ""}${nm ? `<span>${esc(nm)}</span>` : ""}${extra ? `<i>${extra}</i>` : ""}`
            this.tagEl.classList.add("is-badge")
            this.tagEl.classList.toggle("is-empty", !html)
            if (this.tagEl.innerHTML !== html) this.tagEl.innerHTML = html
            return
        }
        this.tagEl.classList.remove("is-badge", "is-empty")
        const label = SSFX_LABELS[L.effect] || ""
        const name = (L.cfg.name || "Layer " + (L.index + 1)).replace(
            /</g,
            "&lt;"
        )
        const html = `${SSFX_TAG_ICON}<span>${name}</span>${extra ? `<i>${extra}</i>` : label && this.o.showEffectLabel ? `<i>${label}</i>` : ""}`
        if (this.tagEl.innerHTML !== html) this.tagEl.innerHTML = html
    }

    /* pointer */
    point(e) {
        const r = this.wrap.getBoundingClientRect()
        const sx = r.width / (this.wrap.offsetWidth || r.width) || 1
        const sy = r.height / (this.wrap.offsetHeight || r.height) || 1
        return { x: (e.clientX - r.left) / sx, y: (e.clientY - r.top) / sy }
    }

    toLayer(L, p) {
        const cx = L.left + L.w / 2
        const cy = L.top + L.h / 2
        const a = (-(L.rot + L.dragRot + L.ir) * Math.PI) / 180
        const dx = p.x - cx
        const dy = p.y - cy
        return {
            x: dx * Math.cos(a) - dy * Math.sin(a) + L.w / 2,
            y: dx * Math.sin(a) + dy * Math.cos(a) + L.h / 2,
        }
    }

    pointerMove(e) {
        const p = this.point(e)
        const now = performance.now()
        const dt = Math.max(1, now - (this.lastT || now - 16)) / 1000
        const vx = this.lastP ? (p.x - this.lastP.x) / dt : 0
        const vy = this.lastP ? (p.y - this.lastP.y) / dt : 0
        this.lastP = p
        this.lastT = now
        const D = this.dragS
        if (D && D.mode === "resize") return
        if (this.logo && !D) this.logoPointer(p, vx, vy)
        if (this.board && !D && e.pointerType === "mouse") {
            const t = this.boardTarget(p)
            const A = this.anchor
            if (A) {
                const g =
                    this.o.board.holdOnHover === true
                        ? 0
                        : (this.o.board.holdOnHover ?? 0.12)
                this.offT.x = A.off.x + (t.x - A.t.x) * g
                this.offT.y = A.off.y + (t.y - A.t.y) * g
            } else if (this.release) this.releaseStep(t)
            else this.offT = t
            this.mouseSeen = true
            this.lastBoardP = p
            this.wake()
        }
        if (D) {
            if (D.mode === "fx") {
                const lp = this.toLayer(D.L, p)
                D.L.fx.drag(lp.x, lp.y)
                D.L.fx.pointer(lp.x / D.L.w, lp.y / D.L.h, lp.x, lp.y, vx, vy)
                this.wake()
                return
            }
            if (!D.moved && Math.hypot(p.x - D.p0.x, p.y - D.p0.y) < 4) return
            if (!D.moved) {
                D.moved = true
                D.L.el.classList.add("is-dragging")
                this.zTop = (this.zTop || 30) + 1
                D.L.el.style.zIndex = this.zTop
                this.frame.style.transition = "opacity .18s ease"
            }
            let left = p.x - D.gx
            let top = p.y - D.gy
            if (this.o.snap) [left, top] = this.snap(D.L, left, top)
            const L = D.L
            L.left = left
            L.top = top
            L.bx = left - this.off.x * L.depth
            L.by = top - this.off.y * L.depth - L.iy
            L.x = (L.bx / this.W) * 100
            L.y = (L.by / this.H) * 100
            L.dragRotT = ssfxClamp(vx * 0.012, -10, 10)
            L.fx.moved(vx, vy, dt)
            const lp = this.toLayer(L, p)
            L.fx.pointer(lp.x / L.w, lp.y / L.h, lp.x, lp.y, vx, vy)
            this.transform(L)
            this.updateFrame()
            this.wake()
            return
        }
        const L = this.hoverL
        if (L) {
            const lp = this.toLayer(L, p)
            L.fx.pointer(lp.x / L.w, lp.y / L.h, lp.x, lp.y, vx, vy)
            this.wake()
        }
    }

    boardTarget(p) {
        const r = this.o.board.range || [0.3, 0.2]
        const k = this.o.board.invert === false ? 1 : -1
        return {
            x: k * (p.x / this.W - 0.5) * 2 * r[0] * this.W,
            y: k * (p.y / this.H - 0.5) * 2 * r[1] * this.H,
        }
    }

    pointerDown(e, L) {
        if (e.button > 0) return
        if (e.pointerType !== "mouse" && this.hoverL !== L) this.setHover(L)
        const p = this.point(e)
        const lp = this.toLayer(L, p)
        this.lastP = p
        this.lastT = performance.now()
        const touchBlocked =
            this.mobile && e.pointerType !== "mouse" && !this.o.dragOnTouch
        if (L.fx.down(lp.x, lp.y)) {
            if (L.effect === "cloth" && touchBlocked) {
                L.fx.up()
                return
            }
            this.dragS = { L, mode: "fx" }
        } else if (L.canDrag && !touchBlocked) {
            this.dragS = {
                L,
                mode: "move",
                p0: p,
                gx: p.x - L.left,
                gy: p.y - L.top,
                moved: false,
            }
        } else return
        try {
            L.el.setPointerCapture(e.pointerId)
        } catch (err) {}
        e.preventDefault()
        this.wake()
    }

    pointerUp(e) {
        const D = this.dragS
        if (!D || D.mode === "resize") return
        this.dragS = null
        try {
            D.L.el.releasePointerCapture(e.pointerId)
        } catch (err) {}
        D.L.el.classList.remove("is-dragging")
        if (D.mode === "fx") D.L.fx.up()
        if (D.mode === "move" && !D.moved && D.L.fx.click) D.L.fx.click()
        D.L.dragRotT = 0
        this.guideV.style.display = this.guideH.style.display = "none"
        this.transform(D.L)
        if (e.pointerType === "mouse") {
            const doc = this.root.ownerDocument || document
            const under = doc.elementFromPoint(e.clientX, e.clientY)
            const over = under
                ? this.layers.find((l) => l.el.contains(under))
                : null
            this.setHover(over || null)
        }
        this.wake()
    }

    snap(L, left, top) {
        const T = 6
        const xs = [[this.W / 2, null]]
        const ys = [[this.H / 2, null]]
        for (const o of this.layers) {
            if (o === L || o.hidden || !this.inView(o, 0)) continue
            xs.push([o.left, o], [o.left + o.w / 2, o], [o.left + o.w, o])
            ys.push([o.top, o], [o.top + o.h / 2, o], [o.top + o.h, o])
        }
        let bx = null
        let by = null
        for (const edge of [left, left + L.w / 2, left + L.w])
            for (const [x, o] of xs) {
                const d = x - edge
                if (Math.abs(d) < T && (!bx || Math.abs(d) < Math.abs(bx.d)))
                    bx = { d, x, o }
            }
        for (const edge of [top, top + L.h / 2, top + L.h])
            for (const [y, o] of ys) {
                const d = y - edge
                if (Math.abs(d) < T && (!by || Math.abs(d) < Math.abs(by.d)))
                    by = { d, y, o }
            }
        const gv = this.guideV
        const gh = this.guideH
        if (bx) {
            left += bx.d
            const y0 = Math.min(top, bx.o ? bx.o.top : 0) - 12
            const y1 =
                Math.max(top + L.h, bx.o ? bx.o.top + bx.o.h : this.H) + 12
            Object.assign(gv.style, {
                display: "block",
                width: "1px",
                height: y1 - y0 + "px",
                transform: `translate(${bx.x - 0.5}px, ${y0}px)`,
            })
        } else gv.style.display = "none"
        if (by) {
            top += by.d
            const x0 = Math.min(left, by.o ? by.o.left : 0) - 12
            const x1 =
                Math.max(left + L.w, by.o ? by.o.left + by.o.w : this.W) + 12
            Object.assign(gh.style, {
                display: "block",
                height: "1px",
                width: x1 - x0 + "px",
                transform: `translate(${x0}px, ${by.y - 0.5}px)`,
            })
        } else gh.style.display = "none"
        return [left, top]
    }

    /* animation */
    wake() {
        if (!this.raf && !this.dead) {
            this.last = performance.now()
            this.raf = requestAnimationFrame(this.loop)
        }
    }

    loop(now) {
        this.raf = 0
        if (this.dead) return
        const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000))
        this.last = now
        if (!this.visible) return
        this.time += dt
        let busy = false

        // board: drifts opposite the cursor (or slowly by itself on touch screens)
        let moved = false
        if (
            this.board &&
            this.o.interactive &&
            !(
                this.dragS &&
                (this.dragS.mode === "move" || this.dragS.mode === "resize")
            )
        ) {
            const b = this.o.board
            if (
                !this.mouseSeen &&
                (this.coarse || this.mobile) &&
                b.idleDrift &&
                !ssfxReduced()
            ) {
                const r = b.range || [0.3, 0.2]
                this.offT.x = Math.sin(this.time * 0.17) * r[0] * this.W * 0.6
                this.offT.y =
                    Math.sin(this.time * 0.13 + 1.3) * r[1] * this.H * 0.6
                busy = true
            }
            if (this.release && this.lastBoardP) {
                this.releaseStep(this.boardTarget(this.lastBoardP))
                busy = true
            }
            const e = 1 - Math.exp(-dt * (b.ease ?? 2.6))
            const nx = this.off.x + (this.offT.x - this.off.x) * e
            const ny = this.off.y + (this.offT.y - this.off.y) * e
            if (Math.abs(nx - this.off.x) + Math.abs(ny - this.off.y) > 0.02)
                moved = true
            this.off.x = nx
            this.off.y = ny
        }
        const intro = this.stepIntro(dt)
        if (moved || intro || this.layers.some((L) => L.mv)) {
            this.positionAll(dt)
            busy = true
        }

        for (const L of this.layers) {
            if (L.hidden) continue
            if (
                Math.abs(L.dragRot - L.dragRotT) > 0.01 ||
                Math.abs(L.dragRot) > 0.01
            ) {
                L.dragRot += (L.dragRotT - L.dragRot) * (1 - Math.exp(-dt * 10))
                if (!this.dragS || this.dragS.L !== L)
                    L.dragRotT *= Math.exp(-dt * 8)
                if (Math.abs(L.dragRot) < 0.01 && Math.abs(L.dragRotT) < 0.01)
                    L.dragRot = L.dragRotT = 0
                this.transform(L)
                if (this.frameL === L) this.updateFrame()
                else if (this.fadeL === L) this.updateFrame(L)
                busy = true
            }
            const seen = this.inView(L)
            this.wakeGL(L)
            if (L.effect === "sequence") {
                if (seen) L.fx.tick(dt)
                if (L.fx.frames.length > 1) busy = true
                if (L === this.frameL) this.refreshTag()
            } else if (L.fx.awake && seen) {
                L.fx.tick(dt)
                busy = true
            }
        }
        const G = this.logo
        if (G && G.fx) {
            const fx = G.fx
            if (fx.state === "lost" && performance.now() - fx.lostAt > 1200)
                fx.revive()
            if (fx.awake && this.visible) {
                fx.tick(dt)
                busy = true
            }
        }
        if (this.frameL) {
            this.updateFrame()
            if (this.glide) busy = true
        } else if (this.fadeL) {
            if (performance.now() < this.fadeUntil) {
                this.updateFrame(this.fadeL)
                busy = true
            } else this.fadeL = null
        }
        if (this.ring && this.o.interactive && !ssfxReduced()) {
            const target = this.btnHover ? 3.2 : 1
            this.ringV += (target - this.ringV) * (1 - Math.exp(-dt * 4))
            this.ringA =
                (this.ringA +
                    (dt * 360 * this.ringV) / Math.max(1, this.o.button.spin)) %
                360
            this.ring.style.transform = `rotate(${this.ringA.toFixed(2)}deg)`
            busy = true
        }
        if (!this.o.interactive && now > (this.stopAt || 0)) busy = false
        if (busy || this.dragS) this.raf = requestAnimationFrame(this.loop)
    }

    /* public API */
    setLayerImage(index, src) {
        const L = this.layers[index]
        if (!L) return
        L.cfg.image = src
        L.fx.setImage(src)
        if (L.effect !== "sequence") this.detectShape(L, src)
        this.wake()
    }

    set(options) {
        const keep = this.layers.map((L) => ({
            x: L.x,
            y: L.y,
            image: L.cfg.image,
        }))
        this.destroy()
        this.dead = false
        this.o = ssfxMerge(this.o, options)
        if (options.layers === null) this.o.layers = null
        else if (!options.layers) {
            const base =
                this.o.layers && this.o.layers.length
                    ? this.o.layers
                    : this.board
                      ? SSFX_BOARD_LAYERS
                      : SSFX_DEFAULT_LAYERS
            this.o.layers = base.map((l, i) =>
                keep[i]
                    ? {
                          ...l,
                          x: keep[i].x,
                          y: keep[i].y,
                          image: keep[i].image || l.image,
                      }
                    : l
            )
        }
        this.layers = []
        this.hoverL = this.frameL = this.fadeL = null
        this.W = 0
        this.off = { x: 0, y: 0 }
        this.offT = { x: 0, y: 0 }
        const intro = this.o.intro
        this.o.intro = { ...intro, drop: false }
        this.injectCSS()
        this.build()
        this.o.intro = intro
        if (!this.o.interactive) this.stopAt = performance.now() + 1800
        this.wake()
        return this
    }

    destroy() {
        this.dead = true
        cancelAnimationFrame(this.raf)
        this.raf = 0
        clearTimeout(this.glideT)
        if (this.ro) this.ro.disconnect()
        if (this.io) this.io.disconnect()
        if (this.mo) this.mo.disconnect()
        this.restoreBleed()
        if (this.onWinResize)
            window.removeEventListener("resize", this.onWinResize)
        for (const L of this.layers) L.fx.destroy()
        if (this.logo && this.logo.fx) this.logo.fx.destroy()
        if (this.wrap && this.wrap.parentNode)
            this.wrap.parentNode.removeChild(this.wrap)
    }
}

export { SelectionStageFX, SSFX_DEFAULTS, SSFX_BOARD_LAYERS, SSFX_DEFAULT_LAYERS }
export default SelectionStageFX
