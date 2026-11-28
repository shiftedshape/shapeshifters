/*!
 * Fluid Logo · Shapeshifters (shapeshifters.supply)
 * Type, an SVG or a PNG logo that smears into a four-colour fluid trail under the pointer.
 * From Selection Stage FX. Plain JS, WebGL2, no dependencies.
 */

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
uniform sampler2D uSim, uImg; uniform vec2 uFit, uScale, uOff; uniform float uDistort, uTime, uCycle, uHalo, uTint;
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
  vec2 iu = (uv - 0.5 - uOff) * uScale;            // canvas -> layer
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


/* ------------------------------------------------------------------ Fluid Logo */

export const FLUID_LOGO_DEFAULTS = {
    // what to show: text, or an image (SVG / PNG / WebP) when `image` is set
    text: "shifted\nshape",
    image: null,
    alt: "", // label for screen readers; defaults to the text
    // type
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontWeight: 800,
    fontStyle: "normal",
    letterSpacing: -0.045, // em
    lineHeight: 0.92, // × font size
    textAlign: "left", // left | center | right (lines against each other)
    color: "#F4F2EE",
    // placement inside the element
    align: "center", // left | center | right
    valign: "center", // top | center | bottom
    padding: 0.08, // room around the logo for the trail, as a share of the element's shorter side
    // the effect
    colors: ["#3D7BFF", "#FF3EA5", "#FFB23D", "#3DFFC8"],
    strength: 1,
    distortion: 0.15,
    brush: 0.11,
    cycle: 0.12, // how fast the trail colours turn
    halo: 0.12, // coloured glow around the letters
    tint: 1, // 0 = distortion only, no colour
    clickBurst: true,
    interactive: true,
    maxDpr: 2,
}

const flReduced = () =>
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches

// text as a tightly cropped canvas, `width` px wide
function flTextCanvas(o, width) {
    const lines = String(o.text ?? "").split("\n")
    const probe = document.createElement("canvas").getContext("2d")
    const font = (px) =>
        `${o.fontStyle || "normal"} ${o.fontWeight || 400} ${px}px ${o.fontFamily}`
    const base = 200
    probe.font = font(base)
    if ("letterSpacing" in probe) probe.letterSpacing = `${(o.letterSpacing || 0) * base}px`
    let widest = 1
    for (const l of lines) widest = Math.max(widest, probe.measureText(l).width)
    const size = (base * width) / widest
    const lh = size * (o.lineHeight || 1)
    const pad = Math.ceil(size * 0.3)
    const c = document.createElement("canvas")
    c.width = Math.ceil(width + pad * 2)
    c.height = Math.ceil(lh * (lines.length - 1) + size * 1.3 + pad * 2)
    const ctx = c.getContext("2d", { willReadFrequently: true })
    ctx.font = font(size)
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${(o.letterSpacing || 0) * size}px`
    ctx.fillStyle = o.color || "#000"
    ctx.textBaseline = "alphabetic"
    lines.forEach((l, i) => {
        const w = ctx.measureText(l).width
        const x =
            o.textAlign === "center" ? pad + (width - w) / 2 : o.textAlign === "right" ? pad + width - w : pad
        ctx.fillText(l, x, pad + size + i * lh)
    })
    // crop to the visible pixels
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
    for (let y = 0; y < c.height; y += 1)
        for (let x = 0; x < c.width; x += 1)
            if (d[(y * c.width + x) * 4 + 3] > 8) {
                if (x < x0) x0 = x
                if (x > x1) x1 = x
                if (y < y0) y0 = y
                if (y > y1) y1 = y
            }
    if (x1 < 0) return c
    const m = 2
    const out = document.createElement("canvas")
    out.width = x1 - x0 + 1 + m * 2
    out.height = y1 - y0 + 1 + m * 2
    out.getContext("2d").drawImage(c, x0 - m, y0 - m, out.width, out.height, 0, 0, out.width, out.height)
    return out
}

export class FluidLogo {
    constructor(el, options = {}) {
        if (!el) throw new Error("FluidLogo: no element")
        this.el = el
        this.o = { ...FLUID_LOGO_DEFAULTS, ...options }
        if (getComputedStyle(el).position === "static") el.style.position = "relative"
        el.setAttribute("role", "img")
        this.label()
        this.canvas = document.createElement("canvas")
        Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", pointerEvents: "none" })
        el.appendChild(this.canvas)
        this.gl = ssfxGL.context(this.canvas)
        this.supported = !!this.gl && this.o.interactive && !flReduced()
        this.ptr = { u: 0.5, v: 0.5, vx: 0, vy: 0 }
        this.burst = 0
        this.burstPos = [0.5, 0.5]
        this.time = 0
        this.idle = 0
        this.hover = false
        this.loop = this.loop.bind(this)
        if (this.gl) {
            try {
                this.quad = ssfxGL.quad(this.gl)
            } catch (e) {
                this.gl = null
            }
            this.canvas.addEventListener("webglcontextlost", (e) => {
                e.preventDefault()
                this.lost = true
                this.showFallback()
            })
        }
        this.bind()
        this.ro = new ResizeObserver(() => this.layout())
        this.ro.observe(el)
        this.io = new IntersectionObserver((e) => {
            this.visible = e[0].isIntersecting
            if (this.visible) this.wake()
        })
        this.io.observe(el)
        this.load()
        if (document.fonts && !this.o.image)
            document.fonts.addEventListener?.("loadingdone", (this.onFonts = () => this.load()))
    }

    label() {
        const t = this.o.alt || (this.o.image ? "" : String(this.o.text || "").replace(/\n/g, " "))
        if (t) this.el.setAttribute("aria-label", t)
        else this.el.removeAttribute("aria-label")
    }

    bind() {
        const el = this.el
        const pos = (e) => {
            const r = el.getBoundingClientRect()
            return { x: e.clientX - r.left, y: e.clientY - r.top }
        }
        this.onMove = (e) => {
            const p = pos(e)
            const now = performance.now()
            const dt = Math.max(1, now - (this.lastT || now - 16)) / 1000
            const vx = this.lastP ? (p.x - this.lastP.x) / dt : 0
            const vy = this.lastP ? (p.y - this.lastP.y) / dt : 0
            this.lastP = p
            this.lastT = now
            this.hover = true
            this.ptr = { u: p.x / this.cw, v: 1 - p.y / this.ch, vx: (vx / this.cw) * 1.6, vy: (-vy / this.ch) * 1.6 }
            this.idle = 0
            this.wake()
        }
        this.onLeave = () => {
            this.hover = false
            this.lastP = null
            this.ptr.vx = this.ptr.vy = 0
        }
        this.onDown = (e) => {
            if (!this.o.clickBurst) return
            const p = pos(e)
            this.burst = 1
            this.burstPos = [p.x / this.cw, 1 - p.y / this.ch]
            this.idle = 0
            this.wake()
        }
        el.addEventListener("pointermove", this.onMove)
        el.addEventListener("pointerleave", this.onLeave)
        el.addEventListener("pointerdown", this.onDown)
    }

    // the source picture: text drawn to a canvas, or the image
    async source() {
        const o = this.o
        const W = Math.max(1, this.el.clientWidth)
        const d = Math.min(devicePixelRatio || 1, o.maxDpr)
        const width = Math.min(2600, Math.max(900, W * d * 1.35))
        if (o.image) {
            let src = o.image
            if (typeof src === "object" && src.src) src = src.src
            const img = await ssfxLoadImage(src)
            const aspect = await ssfxAspect(src, img)
            return { canvas: ssfxRaster(img, aspect, width), aspect, src }
        }
        if (document.fonts && document.fonts.load) {
            try {
                await document.fonts.load(`${o.fontStyle} ${o.fontWeight} 100px ${o.fontFamily}`, o.text)
            } catch (e) {}
        }
        const c = flTextCanvas(o, width)
        return { canvas: c, aspect: c.width / c.height }
    }

    async load() {
        const token = (this.token = (this.token || 0) + 1)
        let s
        try {
            s = await this.source()
        } catch (e) {
            console.warn("[Fluid Logo]", e.message || e)
            return
        }
        if (token !== this.token || this.dead) return
        this.src = s
        this.aspect = s.aspect
        this.ready = false
        if (this.gl && !this.lost) {
            try {
                const gl = this.gl
                const t = ssfxGL.image(gl, s.canvas)
                if (this.tex) gl.deleteTexture(this.tex)
                this.tex = t
                this.ready = true
                this.hideFallback()
            } catch (e) {
                // a picture from another site without CORS can't be used by WebGL
                console.warn("[Fluid Logo] showing the plain picture:", e.message || e)
                this.showFallback()
            }
        } else this.showFallback()
        this.layout()
    }

    showFallback() {
        if (!this.src) return
        if (!this.fb) {
            this.fb = document.createElement("img")
            this.fb.alt = ""
            this.fb.setAttribute("aria-hidden", "true")
            Object.assign(this.fb.style, { position: "absolute", display: "block", pointerEvents: "none" })
            this.el.appendChild(this.fb)
        }
        this.fb.src = this.src.src || this.src.canvas.toDataURL()
        this.canvas.style.display = "none"
        this.fallback = true
        this.place()
    }

    hideFallback() {
        if (this.fb) this.fb.remove()
        this.fb = null
        this.fallback = false
        this.canvas.style.display = "block"
    }

    // where the logo sits inside the element (px)
    place() {
        const o = this.o
        const W = this.el.clientWidth, H = this.el.clientHeight
        const pad = Math.min(W, H) * (o.padding ?? 0.08)
        const aw = Math.max(1, W - pad * 2), ah = Math.max(1, H - pad * 2)
        const a = this.aspect || 4
        let bw = aw, bh = aw / a
        if (bh > ah) {
            bh = ah
            bw = ah * a
        }
        const bx = o.align === "left" ? pad : o.align === "right" ? W - pad - bw : (W - bw) / 2
        const by = o.valign === "top" ? pad : o.valign === "bottom" ? H - pad - bh : (H - bh) / 2
        this.box = { x: bx, y: by, w: bw, h: bh }
        if (this.fb) Object.assign(this.fb.style, { left: bx + "px", top: by + "px", width: bw + "px", height: bh + "px" })
        return this.box
    }

    layout() {
        const W = this.el.clientWidth, H = this.el.clientHeight
        if (!W || !H) return
        // re-draw the source when the element grows a lot (sharp type)
        if (this.srcW && W > this.srcW * 1.3) {
            this.srcW = W
            this.load()
            return
        }
        this.srcW = this.srcW || W
        this.place()
        if (!this.gl || this.fallback) return
        const d = Math.min(devicePixelRatio || 1, this.o.maxDpr)
        this.cw = W
        this.ch = H
        this.canvas.width = Math.round(W * d)
        this.canvas.height = Math.round(H * d)
        const sw = 192, sh = Math.max(16, Math.round((sw * H) / W))
        if (!this.pp || this.pp.w !== sw || this.pp.h !== sh) {
            if (this.pp) this.pp.dispose()
            this.pp = ssfxGL.pingpong(this.gl, sw, sh)
            const f = this.pp.fmt.float
            if (this.simF !== f) {
                this.simF = f
                this.sim = ssfxGL.program(this.gl, SSFX_QUAD_VS, SSFX_FLUID_SIM(f))
                this.show = ssfxGL.program(this.gl, SSFX_QUAD_VS, SSFX_FLUID_SHOW(f))
            }
        }
        this.render(0)
        this.wake()
    }

    wake() {
        if (!this.raf && !this.dead && this.supported && this.ready) {
            this.last = performance.now()
            this.raf = requestAnimationFrame(this.loop)
        }
    }

    loop(now) {
        this.raf = 0
        if (this.dead || this.visible === false) return
        const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000))
        this.last = now
        this.time += dt
        this.idle += dt
        this.render(dt)
        this.ptr.vx *= 0.6
        this.ptr.vy *= 0.6
        this.burst *= 0.5
        if (this.burst < 0.01) this.burst = 0
        if (this.hover || this.idle < 5) this.raf = requestAnimationFrame(this.loop)
    }

    render(dt) {
        if (!this.ready || !this.pp || this.fallback || this.lost) return
        const gl = this.gl
        const o = this.o
        const st = o.strength ?? 1
        gl.bindVertexArray(this.quad)
        gl.disable(gl.BLEND)
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
            gl.uniform1f(u.uRadius, o.brush)
            gl.uniform1f(u.uSplat, this.hover ? 0.55 * st : 0)
            gl.uniform1f(u.uBurst, this.burst * st)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
            this.pp.swap()
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
        const b = this.box
        gl.uniform2f(u.uFit, 1, 1)
        gl.uniform2f(u.uScale, this.cw / b.w, this.ch / b.h)
        gl.uniform2f(u.uOff, (b.x + b.w / 2) / this.cw - 0.5, 0.5 - (b.y + b.h / 2) / this.ch)
        gl.uniform1f(u.uDistort, o.distortion * st)
        gl.uniform1f(u.uTime, this.time)
        gl.uniform1f(u.uCycle, o.cycle)
        gl.uniform1f(u.uHalo, o.halo)
        gl.uniform1f(u.uTint, Math.min(1.5, Math.max(0, Number(o.tint ?? 1))))
        const cs = (o.colors || []).filter(Boolean)
        if (!cs.length) cs.push(...FLUID_LOGO_DEFAULTS.colors)
        while (cs.length < 4) cs.push(cs[cs.length - 1])
        ;["uC0", "uC1", "uC2", "uC3"].forEach((k, i) => gl.uniform3fv(u[k], ssfxRgb(cs[i])))
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    set(options) {
        const before = JSON.stringify([this.o.text, this.o.image, this.o.fontFamily, this.o.fontWeight, this.o.fontStyle, this.o.letterSpacing, this.o.lineHeight, this.o.textAlign, this.o.color])
        Object.assign(this.o, options)
        this.label()
        const after = JSON.stringify([this.o.text, this.o.image, this.o.fontFamily, this.o.fontWeight, this.o.fontStyle, this.o.letterSpacing, this.o.lineHeight, this.o.textAlign, this.o.color])
        if (before !== after) this.load()
        else this.layout()
        return this
    }

    destroy() {
        this.dead = true
        cancelAnimationFrame(this.raf)
        this.ro.disconnect()
        this.io.disconnect()
        if (this.onFonts) document.fonts.removeEventListener?.("loadingdone", this.onFonts)
        this.el.removeEventListener("pointermove", this.onMove)
        this.el.removeEventListener("pointerleave", this.onLeave)
        this.el.removeEventListener("pointerdown", this.onDown)
        if (this.pp) this.pp.dispose()
        if (this.gl) {
            const ext = this.gl.getExtension("WEBGL_lose_context")
            if (ext) ext.loseContext()
        }
        this.canvas.remove()
        if (this.fb) this.fb.remove()
    }
}

export default FluidLogo
