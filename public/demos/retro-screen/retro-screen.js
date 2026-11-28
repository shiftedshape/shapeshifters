/**
 * RetroScreen — CRT / arcade monitor effect in plain WebGL2. No dependencies.
 *
 * Pipeline (per frame):
 *   1. pointer trail  → small float texture holding a decaying velocity field
 *   2. scene          → rendered at low resolution (pixelScale): neon grid
 *                       or an image/video/canvas, plus optional text
 *   3. bloom          → two blurred mip levels of the bright parts
 *   4. composite      → scene + bloom, tonemapped
 *   5. CRT            → curvature, NTSC-style colour bleed, scanlines,
 *                       aperture mask, line jitter, roll bar, noise, vignette
 *
 * Optional frame: put the screen inside a photo of a TV/monitor. The photo needs a
 * transparent hole where the glass is; `frameScreen` says where that hole sits.
 *
 * Usage:
 *   import { RetroScreen } from './retro-screen.js'
 *   const screen = new RetroScreen(document.querySelector('#hero'), { text: 'GAME OVER' })
 *   screen.set({ curvature: 0.5 })   // update any option live
 *   screen.pulse()                   // trigger a glitch burst
 *   screen.destroy()
 *
 * Visual reference: "Arcade" by Robert Leitl (MIT). Shader code here is written from scratch.
 */

export const RETRO_SCREEN_DEFAULTS = {
    // content
    scene: 'grid',            // 'grid' | 'media' | 'none' (text only)
    media: null,              // image/video URL, or an <img>, <video> or <canvas> element
    mediaFit: 'cover',        // 'cover' | 'contain'
    text: 'GAME OVER',
    textBlink: true,
    textSize: 0.075,          // share of the screen height
    textY: 0.86,              // 0 = top, 1 = bottom
    fontFamily: '"VT323", "IBM Plex Mono", ui-monospace, Menlo, monospace',
    letterSpacing: 0.08,      // in em

    // colours (any CSS hex)
    background: '#17143f',
    gridColor: '#a493ff',
    colorA: '#23e6ff',        // cyan
    colorB: '#ff2bd6',        // magenta
    textColor: '#e8e4ff',
    outside: 'transparent',   // colour outside the curved screen, or 'transparent'

    // grid
    gridRows: 8,
    gridLine: 0.8,            // line width in screen pixels (at pixelScale)

    // the "monitor"
    pixelScale: 0.3,          // render resolution vs. CSS size. Lower = chunkier
    minRows: 150,             // keeps small screens from turning to mush
    curvature: 1,
    scanlines: 0.75,
    mask: 0.18,               // RGB aperture grille
    bleed: 1,                 // NTSC colour bleed + ringing
    saturation: 1.1,
    brightness: 1.05,
    bloom: 1,
    noise: 0.5,
    jitter: 0.5,              // per-line horizontal wobble
    rollBar: 0.5,             // slow interference band
    vignette: 1,
    glare: 0.35,              // soft reflection on the glass

    // frame (optional): a picture of a TV/monitor with the glass cut out
    frame: null,              // image URL; null = screen fills the container
    frameScreen: [0.1004, 0.0875, 0.7992, 0.7525], // hole as [x, y, w, h] fractions of the image (bundled monitor)
    frameFit: 'contain',      // 'contain' | 'cover'
    frameGlow: 0.3,           // screen light spilling onto the bezel

    // motion + interaction
    speed: 1,
    interactive: true,
    warp: 1,                  // how far the pointer trail bends the picture
    glitchOnClick: true,
    respectReducedMotion: true,
    pauseWhenHidden: true,
    maxDpr: 2,
};

/* ------------------------------------------------------------------ shaders */

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
`;

// Pointer trail: xy = velocity (uv/frame), z = ink. Self-advects and decays.
const PAINT = HEAD + `
uniform sampler2D uPrev;
uniform vec2 uAspect;
uniform vec2 uP0;
uniform vec2 uP1;
uniform vec2 uVel;
uniform float uDt;
uniform float uActive;
uniform vec2 uTexel;

float sdSeg(vec2 p, vec2 a, vec2 b){
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

void main(){
    vec4 here = texture(uPrev, vUv);
    vec2 src = vUv - here.xy * 0.02 * uDt;
    vec4 prev = texture(uPrev, src) * 0.5
        + (texture(uPrev, src + vec2(uTexel.x, 0.0)) + texture(uPrev, src - vec2(uTexel.x, 0.0))
         + texture(uPrev, src + vec2(0.0, uTexel.y)) + texture(uPrev, src - vec2(0.0, uTexel.y))) * 0.125;
    vec2 vel = prev.xy;
    float ink = prev.z;

    vec2 p = (vUv - 0.5) * uAspect;
    vec2 a = (uP0 - 0.5) * uAspect;
    vec2 b = (uP1 - 0.5) * uAspect;
    float speed = length(uVel * uAspect);
    float r = mix(0.035, 0.1, clamp(speed * 25.0, 0.0, 1.0));
    float brush = (1.0 - smoothstep(r * 0.25, r, sdSeg(p, a, b))) * uActive;

    vel += uVel * 40.0 * brush;
    ink = max(ink, brush * clamp(speed * 50.0, 0.0, 1.0));

    float l = length(vel);
    if (l > 1.0) vel /= l;
    vel *= pow(0.984, uDt);
    ink *= pow(0.985, uDt);
    outColor = vec4(vel, ink, 1.0);
}`;

const SCENE = HEAD + `
uniform sampler2D uPaint;
uniform sampler2D uMedia;
uniform sampler2D uText;
uniform vec2 uRes;
uniform float uTime;
uniform float uMode;          // 0 none, 1 grid, 3 media
uniform float uHasMedia;
uniform vec2 uMediaScale;
uniform vec3 uBg;
uniform vec3 uGrid;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uTextCol;
uniform float uTextAlpha;
uniform float uRows;
uniform float uLineW;
uniform float uWarp;
uniform float uPulse;

vec3 background(vec2 uv, float ink){
    float aspect = uRes.x / uRes.y;
    vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
    vec3 col = uBg;
    col += uColB * 0.05 * exp(-dot(c - vec2(0.0, 0.12), c - vec2(0.0, 0.12)) * 5.0);
    col += uColA * 0.03 * exp(-dot(c + vec2(0.0, 0.25), c + vec2(0.0, 0.25)) * 7.0);

    if (uMode > 0.5 && uMode < 1.5) {
        vec2 g = c * uRows + 0.5;
        vec2 dist = (0.5 - abs(fract(g) - 0.5)) / max(fwidth(g), vec2(1e-4));
        float line = 1.0 - smoothstep(uLineW * 0.5, uLineW * 0.5 + 1.0, min(dist.x, dist.y));
        vec3 lc = mix(uGrid, vec3(1.0), clamp(ink * 0.7, 0.0, 1.0)) * (0.85 + ink * 1.6);
        col = mix(col, lc, line);
    }
    return col;
}

vec3 mediaColor(vec2 uv){
    vec2 m = (uv - 0.5) * uMediaScale + 0.5;
    if (m.x < 0.0 || m.x > 1.0 || m.y < 0.0 || m.y > 1.0) return uBg;
    vec3 c = texture(uMedia, m).rgb;
    return pow(c, vec3(2.2)) * 1.15;
}

void main(){
    vec2 uv = vUv;
    vec4 paint = texture(uPaint, uv);
    uv -= paint.xy * 0.3 * uWarp;
    float ink = paint.z * uWarp;

    vec3 col = uMode > 2.5 && uHasMedia > 0.5 ? mediaColor(uv) : background(uv, ink);

    col *= 1.0 + uPulse * 0.6;

    float txt = texture(uText, vUv).a * uTextAlpha;
    col = mix(col, uTextCol * 1.35, txt);

    outColor = vec4(col, 1.0);
}`;

// 4-tap downsample with soft threshold
const DOWN = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold;
void main(){
    vec3 c = texture(uSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb
           + texture(uSrc, vUv + uTexel * vec2( 0.5, -0.5)).rgb
           + texture(uSrc, vUv + uTexel * vec2(-0.5,  0.5)).rgb
           + texture(uSrc, vUv + uTexel * vec2( 0.5,  0.5)).rgb;
    c *= 0.25;
    if (uThreshold > 0.0) {
        float l = max(c.r, max(c.g, c.b));
        c *= smoothstep(uThreshold * 0.8, uThreshold * 1.8, l);
    }
    outColor = vec4(c, 1.0);
}`;

// 9-tap gaussian using 5 linear fetches
const BLUR = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uDir;
void main(){
    vec3 c = texture(uSrc, vUv).rgb * 0.2270270270;
    c += texture(uSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
    c += texture(uSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
    c += texture(uSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
    c += texture(uSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
    outColor = vec4(c, 1.0);
}`;

const COMPOSITE = HEAD + `
uniform sampler2D uScene;
uniform sampler2D uB1;
uniform sampler2D uB2;
uniform float uBloom;
void main(){
    vec3 c = texture(uScene, vUv).rgb;
    c += (texture(uB1, vUv).rgb * 0.45 + texture(uB2, vUv).rgb * 0.6) * uBloom;
    c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
    outColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

const CRT = HEAD + `
uniform sampler2D uColor;
uniform vec2 uSrcRes;
uniform vec2 uRes;
uniform float uTime;
uniform float uFrame;
uniform float uCurv;
uniform float uScan;
uniform float uMask;
uniform float uBleed;
uniform float uSat;
uniform float uBright;
uniform float uNoise;
uniform float uJitter;
uniform float uRoll;
uniform float uVig;
uniform float uPulse;
uniform float uDpr;
uniform vec4 uOutside;
uniform float uClip;
uniform float uGlare;

const mat3 RGB2YIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
const mat3 YIQ2RGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);

// "hash without sine", Dave Hoskins (MIT)
float hash(vec2 p){
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float sdRoundBox(vec2 p, vec2 b, float r){
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main(){
    // barrel curvature
    vec2 uv = vUv * 2.0 - 1.0;
    uv *= vec2(1.0 + uv.y * uv.y * 0.035 * uCurv, 1.0 + uv.x * uv.x * 0.075 * uCurv);
    uv *= 1.0 + 0.015 * uCurv;

    vec2 hres = uRes * 0.5;
    float radius = (0.025 + 0.03 * uCurv) * min(uRes.x, uRes.y);
    float sd = sdRoundBox(uv * hres, hres * (1.0 - 0.006 * uCurv), radius);
    float inside = mix(1.0, 1.0 - smoothstep(-1.0 * uDpr, 0.5 * uDpr, sd), uClip);

    vec2 tuv = uv * 0.5 + 0.5;
    float row = floor(tuv.y * uSrcRes.y);
    float tf = floor(uTime * 24.0);

    // per-line wobble + occasional tearing bands
    float r = hash(vec2(row, tf)) - 0.5;
    float band = step(0.988 - uPulse * 0.25, hash(vec2(floor(row / 3.0), tf + 17.0)));
    tuv.x += (r * 0.35 + band * r * 4.0 + r * uPulse * 6.0) * uJitter / uSrcRes.x;

    // slow rolling interference band
    float rp = fract(tuv.y * 0.75 - uTime * 0.06);
    float bar = smoothstep(0.0, 0.06, rp) * smoothstep(0.22, 0.06, rp);
    tuv.x += bar * uRoll * sin(tuv.y * uSrcRes.y * 0.9 + uTime * 30.0) * 0.6 / uSrcRes.x;

    float sy = (row + 0.5) / uSrcRes.y;
    float fy = fract(tuv.y * uSrcRes.y);
    float px = 1.0 / uSrcRes.x;

    // NTSC-ish decode: sharp luma, wide and offset chroma
    float yN = 0.0, wN = 0.0, wW = 0.0;
    vec3 wide = vec3(0.0);
    for (int i = -4; i <= 4; i++) {
        float fi = float(i);
        float w1 = exp(-fi * fi / 5.0);
        yN += dot(texture(uColor, vec2(tuv.x + fi * px * 0.35, sy)).rgb, vec3(0.299, 0.587, 0.114)) * w1;
        wN += w1;
        float w2 = exp(-fi * fi / 14.0);
        wide += (RGB2YIQ * texture(uColor, vec2(tuv.x + (fi * 1.15 + 0.9) * px * uBleed, sy)).rgb) * w2;
        wW += w2;
    }
    yN /= wN;
    wide /= wW;

    float Y = yN + (yN - wide.x) * 0.3 * uBleed;
    vec2 IQ = wide.yz * uSat;
    float phase = (tuv.x * uSrcRes.x * 1.6 + row * 0.5 + uFrame * 0.5) * 3.14159265;
    float chroma = length(IQ);
    Y += chroma * cos(phase) * 0.05 * uBleed;
    IQ *= 1.0 + 0.1 * uBleed * sin(phase);
    vec3 col = YIQ2RGB * vec3(Y, IQ);

    // scanlines: brighter lines bloom wider
    float lum = clamp(Y, 0.0, 1.0);
    float w = mix(0.24, 0.48, lum);
    float beam = exp(-pow((fy - 0.5) / w, 2.0) * 1.3);
    float rowsPx = uRes.y / uSrcRes.y;
    float scan = uScan * smoothstep(1.4, 2.8, rowsPx);
    col *= mix(1.0, beam * 1.55, scan);

    // aperture grille
    float mx = mod(floor(gl_FragCoord.x), 3.0);
    vec3 m = vec3(step(mx, 0.5), step(0.5, mx) * step(mx, 1.5), step(1.5, mx));
    col *= mix(vec3(1.0), vec3(0.5) + m * 1.0, uMask);

    // noise, flicker, roll-bar brightness
    float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 911.0);
    col += (n - 0.5) * 0.09 * uNoise;
    col *= 1.0 + (hash(vec2(tf, 3.0)) - 0.5) * 0.04 * uNoise;
    col *= 1.0 + bar * uRoll * 0.1;
    col *= uBright * (1.0 + uPulse * 0.25);

    // vignette towards the glass edge
    float edge = clamp(-sd / (0.16 * min(uRes.x, uRes.y)), 0.0, 1.0);
    float vig = mix(1.0, smoothstep(0.0, 1.0, edge) * (1.0 - 0.18 * dot(uv, uv) * 0.5), uVig);
    col *= vig;

    col = max(col, 0.0) + (hash(gl_FragCoord.yx + uFrame) - 0.5) / 255.0;
    // reflection on the glass: a soft window highlight top-left and a faint lower sheen
    vec2 g1 = (vUv - vec2(0.24, 0.8)) * vec2(1.0, 1.7);
    vec2 g2 = (vUv - vec2(0.7, 0.12)) * vec2(0.8, 2.6);
    col += vec3(0.92, 0.95, 1.0) * uGlare * (exp(-dot(g1, g1) * 9.0) * 0.16 + exp(-dot(g2, g2) * 7.0) * 0.05);

    vec3 rgb = col * inside;
    outColor = vec4(rgb + uOutside.rgb * (1.0 - inside), inside + uOutside.a * (1.0 - inside));
}`;

/* ------------------------------------------------------------------ helpers */

// Accepts #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() and Framer tokens like var(--token, rgb(...)).
// Returns [r, g, b] with an extra `.a`, or null for fully transparent colours.
function parseColor(input, linear = true) {
    if (!input || input === 'transparent') return null;
    let s = String(input).trim();
    if (s.startsWith('var(')) {
        const m = s.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i);
        return m ? parseColor(m[1], linear) : null;
    }
    let rgb, a = 1;
    if (s.startsWith('rgb')) {
        const v = s.match(/[\d.]+/g).map(Number);
        rgb = [v[0] / 255, v[1] / 255, v[2] / 255];
        if (v.length > 3) a = v[3];
    } else {
        let h = s.replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const n = parseInt(h.slice(0, 6), 16);
        rgb = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
        if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
    }
    if (a === 0) return null;
    const out = linear ? rgb.map(c => Math.pow(c, 2.2)) : rgb;
    out.a = a;
    return out;
}

const MODES = { none: 0, grid: 1, arcade: 1, media: 3 };

/* ------------------------------------------------------------------ class */

export class RetroScreen {
    constructor(target, options = {}) {
        this.o = { ...RETRO_SCREEN_DEFAULTS, ...options };
        this._ownCanvas = !(target instanceof HTMLCanvasElement);
        this.canvas = this._ownCanvas ? document.createElement('canvas') : target;
        this.container = this._ownCanvas ? target : target.parentElement || target;
        if (this._ownCanvas) {
            Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'pan-y' });
            this.container.appendChild(this.canvas);
        }

        this._time = 0;
        this._frame = 0;
        this._last = performance.now();
        this._pulse = 0;
        this._visible = true;
        this._pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, dx: 0, dy: 0, inside: false, moved: false };
        this._textCanvas = document.createElement('canvas');
        this._mediaEl = null;
        this._mediaReady = false;
        this._mediaSize = [1, 1];

        this._reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

        this.supported = this._initGL();
        if (!this.supported) return;

        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onLost = e => { e.preventDefault(); this._lost = true; };
        this._onRestored = () => { this._lost = false; this._initGL(); this._resize(); };
        window.addEventListener('pointermove', this._onPointerMove, { passive: true });
        window.addEventListener('pointerdown', this._onPointerDown, { passive: true });
        this.canvas.addEventListener('webglcontextlost', this._onLost);
        this.canvas.addEventListener('webglcontextrestored', this._onRestored);

        this._ro = new ResizeObserver(() => { this._layoutFrame(); this._resize(); });
        this._ro.observe(this.container);
        if ('IntersectionObserver' in window) {
            this._io = new IntersectionObserver(([e]) => { this._visible = e.isIntersecting; });
            this._io.observe(this.container);
        }

        this._applyColors();
        this._loadMedia();
        this._setupFrame();
        this._resize();
        if (document.fonts && document.fonts.load) {
            document.fonts.load(`40px ${this.o.fontFamily}`).then(() => this._drawText()).catch(() => {});
        }
        this._loop = this._loop.bind(this);
        this._raf = requestAnimationFrame(this._loop);
    }

    /** Update any option at runtime. */
    set(options = {}) {
        const prev = this.o;
        this.o = { ...this.o, ...options };
        if (!this.supported) return;
        if (options.media !== undefined && options.media !== prev.media) this._loadMedia();
        const frameChanged = ['frame', 'frameScreen', 'frameFit'].some(k => k in options && JSON.stringify(options[k]) !== JSON.stringify(prev[k]));
        if (frameChanged) this._setupFrame();
        if (frameChanged || options.pixelScale !== undefined || options.maxDpr !== undefined || options.minRows !== undefined) this._resize();
        if (['text', 'textSize', 'textY', 'fontFamily', 'letterSpacing'].some(k => k in options)) {
            this._drawText();
            if (options.fontFamily && document.fonts && document.fonts.load) {
                document.fonts.load(`40px ${this.o.fontFamily}`).then(() => this._drawText()).catch(() => {});
            }
        }
        this._applyColors();
        this._styleGlow();
    }

    /** Trigger a short glitch burst (e.g. on a beat or a click). */
    pulse(amount = 1) { this._pulse = Math.max(this._pulse, amount); }

    destroy() {
        cancelAnimationFrame(this._raf);
        if (!this.supported) return;
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerdown', this._onPointerDown);
        this.canvas.removeEventListener('webglcontextlost', this._onLost);
        this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
        this._ro && this._ro.disconnect();
        this._io && this._io.disconnect();
        if (this._mediaEl && this._mediaEl.tagName === 'VIDEO' && this._ownMedia) this._mediaEl.pause();
        const lose = this.gl.getExtension('WEBGL_lose_context');
        lose && lose.loseContext();
        this._removeFrame();
        if (this._ownCanvas) this.canvas.remove();
    }

    /* ---------------------------------------------------------- frame */

    _removeFrame() {
        if (this._frameImg) this._frameImg.remove();
        if (this._glowEl) this._glowEl.remove();
        this._frameImg = this._glowEl = null;
        this._frameAspect = 0;
    }

    _setupFrame() {
        const src = this.o.frame && (typeof this.o.frame === 'string' ? this.o.frame : this.o.frame.src);
        if (src === this._frameSrc && this._frameImg) { this._layoutFrame(); return; }
        this._removeFrame();
        this._frameSrc = src;
        const cs = this.canvas.style;
        if (!src || !this._ownCanvas) {
            Object.assign(cs, { position: '', left: '', top: '', width: '100%', height: '100%' });
            return;
        }
        if (getComputedStyle(this.container).position === 'static') this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';

        const glow = document.createElement('div');
        Object.assign(glow.style, { position: 'absolute', pointerEvents: 'none', mixBlendMode: 'screen' });
        const img = new Image();
        img.alt = '';
        img.draggable = false;
        img.decoding = 'async';
        Object.assign(img.style, { position: 'absolute', pointerEvents: 'none', userSelect: 'none', display: 'block', maxWidth: 'none' });
        img.onload = () => {
            this._frameAspect = img.naturalWidth / img.naturalHeight;
            this._layoutFrame();
            this._resize();
        };
        img.src = src;
        this.container.appendChild(img);
        this.container.appendChild(glow);
        this._frameImg = img;
        this._glowEl = glow;
        this._styleGlow();
        // until the image has loaded, keep the canvas where the screen will be
        this._frameAspect = 0;
    }

    _layoutFrame() {
        const img = this._frameImg;
        if (!img || !this._frameAspect) return;
        const cw = this.container.clientWidth, ch = this.container.clientHeight;
        const a = this._frameAspect;
        let w = cw, h = cw / a;
        if ((h > ch) === (this.o.frameFit !== 'cover')) { h = ch; w = ch * a; }
        const left = (cw - w) / 2, top = (ch - h) / 2;
        const box = { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' };
        Object.assign(img.style, box);
        Object.assign(this._glowEl.style, box);
        const [sx, sy, sw, sh] = this.o.frameScreen;
        Object.assign(this.canvas.style, {
            position: 'absolute', left: left + sx * w + 'px', top: top + sy * h + 'px',
            width: sw * w + 'px', height: sh * h + 'px',
        });
        this._styleGlow();
    }

    // Screen light on the bezel: a blurred colour pool, masked by the frame's own alpha so it
    // only lands on the plastic, never on the picture.
    _styleGlow() {
        const g = this._glowEl;
        if (!g) return;
        const a = parseColor(this.o.colorA, false) || [0, 1, 1];
        const b = parseColor(this.o.colorB, false) || [1, 0, 1];
        const bg = parseColor(this.o.background, false) || [0, 0, 0];
        const c = [0, 1, 2].map(i => Math.round(255 * Math.min(1, a[i] * 0.35 + b[i] * 0.35 + bg[i] * 0.6)));
        const [sx, sy, sw, sh] = this.o.frameScreen;
        const cx = (sx + sw / 2) * 100, cy = (sy + sh / 2) * 100;
        g.style.background = `radial-gradient(${sw * 78}% ${sh * 78}% at ${cx}% ${cy}%, rgba(${c}, 0.9), rgba(${c}, 0.35) 55%, rgba(${c}, 0) 100%)`;
        const mask = `url("${this._frameSrc}")`;
        g.style.webkitMaskImage = g.style.maskImage = mask;
        g.style.webkitMaskSize = g.style.maskSize = '100% 100%';
        g.style.opacity = String(Math.max(0, this.o.frameGlow));
    }

    /* ---------------------------------------------------------- GL setup */

    _initGL() {
        const gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'high-performance' });
        if (!gl) return false;
        this.gl = gl;
        this._float = !!gl.getExtension('EXT_color_buffer_float');
        gl.getExtension('OES_texture_float_linear');

        const compile = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('RetroScreen shader: ' + gl.getShaderInfoLog(s));
            return s;
        };
        const vs = compile(gl.VERTEX_SHADER, VERT);
        const program = fs => {
            const p = gl.createProgram();
            gl.attachShader(p, vs);
            gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
            gl.bindAttribLocation(p, 0, 'aPos');
            gl.linkProgram(p);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('RetroScreen link: ' + gl.getProgramInfoLog(p));
            return { p, loc: {} };
        };
        this._progs = {
            paint: program(PAINT), scene: program(SCENE), down: program(DOWN),
            blur: program(BLUR), composite: program(COMPOSITE), crt: program(CRT),
        };

        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        this._textTex = this._tex(1, 1, false, gl.LINEAR);
        this._mediaTex = this._tex(1, 1, false, gl.LINEAR);
        this._rts = null;
        this._mediaReady = false;
        if (this._mediaEl) this._mediaDirty = true;
        return true;
    }

    _tex(w, h, float, filter) {
        const gl = this.gl;
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
    }

    _rt(w, h, float, filter = this.gl.LINEAR) {
        const gl = this.gl;
        const tex = this._tex(w, h, float && this._float, filter);
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { fb, tex, w, h };
    }

    _freeRts() {
        if (!this._rts) return;
        const gl = this.gl;
        Object.values(this._rts).forEach(r => { gl.deleteFramebuffer(r.fb); gl.deleteTexture(r.tex); });
        this._rts = null;
    }

    _resize() {
        if (!this.gl || this._lost) return;
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
        const dpr = Math.min(window.devicePixelRatio || 1, this.o.maxDpr);
        this._dpr = dpr;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);

        const scale = Math.min(1, Math.max(this.o.pixelScale, this.o.minRows / h));
        const sw = Math.max(32, Math.round(w * scale));
        const sh = Math.max(24, Math.round(h * scale));
        const pw = Math.max(48, Math.round(sw / 2)), ph = Math.max(36, Math.round(sh / 2));
        const b1w = Math.max(8, sw >> 1), b1h = Math.max(8, sh >> 1);
        const b2w = Math.max(4, sw >> 2), b2h = Math.max(4, sh >> 2);

        this._freeRts();
        this._rts = {
            paintA: this._rt(pw, ph, true), paintB: this._rt(pw, ph, true),
            scene: this._rt(sw, sh, true),
            b1a: this._rt(b1w, b1h, true), b1b: this._rt(b1w, b1h, true),
            b2a: this._rt(b2w, b2h, true), b2b: this._rt(b2w, b2h, true),
            color: this._rt(sw, sh, false),
        };
        this._aspect = w / h;
        this._drawText();
    }

    /* ---------------------------------------------------------- content */

    _applyColors() {
        const o = this.o;
        this._c = {
            bg: parseColor(o.background) || [0, 0, 0],
            grid: parseColor(o.gridColor) || [1, 1, 1],
            a: parseColor(o.colorA) || [0, 1, 1],
            b: parseColor(o.colorB) || [1, 0, 1],
            text: parseColor(o.textColor) || [1, 1, 1],
        };
        const out = parseColor(o.outside, false);
        this._outside = out ? [out[0] * out.a, out[1] * out.a, out[2] * out.a, out.a] : [0, 0, 0, 0];
    }

    _drawText() {
        if (!this._rts || !this.gl) return;
        const { w, h } = this._rts.scene;
        const c = this._textCanvas;
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        const text = (this.o.text || '').toString();
        if (text) {
            const size = Math.max(6, Math.round(h * this.o.textSize));
            ctx.font = `${size}px ${this.o.fontFamily}`;
            if ('letterSpacing' in ctx) ctx.letterSpacing = `${(this.o.letterSpacing * size).toFixed(1)}px`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            const lines = text.split('\n');
            const lh = size * 1.1;
            const y0 = h * this.o.textY - (lines.length - 1) * lh / 2;
            lines.forEach((line, i) => ctx.fillText(line, w / 2, y0 + i * lh));
        }
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this._textTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    _loadMedia() {
        const m = this.o.media;
        if (this._mediaEl && this._ownMedia && this._mediaEl.tagName === 'VIDEO') this._mediaEl.pause();
        this._mediaEl = null;
        this._mediaReady = false;
        this._ownMedia = false;
        if (!m) return;
        if (typeof m === 'string') {
            this._ownMedia = true;
            const isVideo = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(m);
            if (isVideo) {
                const v = document.createElement('video');
                Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, crossOrigin: 'anonymous', src: m });
                v.play && v.play().catch(() => {});
                this._mediaEl = v;
            } else {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => { this._mediaDirty = true; };
                img.src = m;
                this._mediaEl = img;
            }
        } else {
            this._mediaEl = m;
            this._mediaDirty = true;
        }
    }

    _uploadMedia() {
        const el = this._mediaEl;
        if (!el) return;
        const tag = el.tagName;
        let w, h;
        if (tag === 'VIDEO') {
            if (el.readyState < 2) return;
            w = el.videoWidth; h = el.videoHeight;
        } else if (tag === 'IMG') {
            if (!el.complete || !el.naturalWidth) return;
            if (!this._mediaDirty && this._mediaReady) return;
            w = el.naturalWidth; h = el.naturalHeight;
        } else {
            w = el.width; h = el.height;
        }
        if (!w || !h) return;
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this._mediaTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, el);
            this._mediaReady = true;
        } catch (e) {
            this._mediaReady = false; // usually a CORS-blocked source
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        this._mediaSize = [w, h];
        this._mediaDirty = false;
    }

    /* ---------------------------------------------------------- input */

    _onPointerMove(e) {
        const r = this.canvas.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = 1 - (e.clientY - r.top) / r.height;
        const p = this._pointer;
        p.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
        if (!p.inside) return;
        if (!p.moved) { p.px = x; p.py = y; }
        p.x = x; p.y = y; p.moved = true;
    }

    _onPointerDown(e) {
        if (!this.o.glitchOnClick) return;
        const r = this.canvas.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) this.pulse(1);
    }

    /* ---------------------------------------------------------- frame */

    _loop(now) {
        this._raf = requestAnimationFrame(this._loop);
        const dtMs = Math.min(50, now - this._last);
        this._last = now;
        if (this._lost || !this._rts) return;
        if (this.o.pauseWhenHidden && (!this._visible || document.hidden)) return;
        if (this.o.paused) return;

        const reduced = this.o.respectReducedMotion && this._reducedMotion && this._reducedMotion.matches;
        const motion = reduced ? 0.25 : 1;
        const dt = dtMs / 16.667;
        this._time += (dtMs / 1000) * this.o.speed * motion;
        this._frame += dt;
        this._pulse *= Math.pow(0.9, dt);
        if (this._pulse < 0.002) this._pulse = 0;

        const p = this._pointer;
        const vx = (p.x - p.px), vy = (p.y - p.py);

        this._render(dt, [p.px, p.py], [p.x, p.y], [vx / Math.max(dt, 0.25), vy / Math.max(dt, 0.25)], motion);
        p.px = p.x; p.py = p.y;
    }

    _draw(prog, target, uniforms) {
        const gl = this.gl;
        gl.useProgram(prog.p);
        let unit = 0;
        for (const k in uniforms) {
            let loc = prog.loc[k];
            if (loc === undefined) loc = prog.loc[k] = gl.getUniformLocation(prog.p, k);
            if (loc === null) continue;
            const v = uniforms[k];
            if (v && v.tex) {
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, v.tex);
                gl.uniform1i(loc, unit++);
            } else if (typeof v === 'number') gl.uniform1f(loc, v);
            else if (v.length === 2) gl.uniform2fv(loc, v);
            else if (v.length === 3) gl.uniform3fv(loc, v);
            else if (v.length === 4) gl.uniform4fv(loc, v);
        }
        if (target) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
            gl.viewport(0, 0, target.w, target.h);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    _render(dt, p0, p1, vel, motion) {
        const gl = this.gl, o = this.o, R = this._rts, P = this._progs, c = this._c;
        gl.bindVertexArray(this._vao);
        gl.disable(gl.BLEND);

        // 1. pointer trail
        const interactive = o.interactive && this._float;
        this._draw(P.paint, R.paintB, {
            uPrev: R.paintA, uAspect: [this._aspect, 1], uP0: p0, uP1: p1, uVel: vel,
            uDt: dt, uActive: interactive && this._pointer.inside ? 1 : 0, uTexel: [1 / R.paintA.w, 1 / R.paintA.h],
        });
        [R.paintA, R.paintB] = [R.paintB, R.paintA];

        // 2. scene
        const mode = MODES[o.scene] ?? 1;
        if (mode === 3) this._uploadMedia();
        const sceneAspect = R.scene.w / R.scene.h;
        const mediaAspect = this._mediaSize[0] / this._mediaSize[1];
        let ms = [1, 1];
        const cover = o.mediaFit !== 'contain';
        if ((mediaAspect > sceneAspect) === cover) ms = [sceneAspect / mediaAspect, 1];
        else ms = [1, mediaAspect / sceneAspect];

        const blinkOn = !o.textBlink || (this._time % 1.2) < 0.8;
        this._draw(P.scene, R.scene, {
            uPaint: R.paintA, uMedia: { tex: this._mediaTex }, uText: { tex: this._textTex },
            uRes: [R.scene.w, R.scene.h], uTime: this._time, uMode: mode,
            uHasMedia: this._mediaReady ? 1 : 0, uMediaScale: ms,
            uBg: c.bg, uGrid: c.grid, uColA: c.a, uColB: c.b, uTextCol: c.text,
            uTextAlpha: blinkOn ? 1 : 0, uRows: o.gridRows, uLineW: o.gridLine,
            uWarp: interactive ? o.warp : 0, uPulse: this._pulse,
        });

        // 3. bloom
        if (o.bloom > 0) {
            this._draw(P.down, R.b1a, { uSrc: R.scene, uTexel: [1 / R.scene.w, 1 / R.scene.h], uThreshold: 0.9 });
            this._draw(P.blur, R.b1b, { uSrc: R.b1a, uDir: [1 / R.b1a.w, 0] });
            this._draw(P.blur, R.b1a, { uSrc: R.b1b, uDir: [0, 1 / R.b1a.h] });
            this._draw(P.down, R.b2a, { uSrc: R.b1a, uTexel: [1 / R.b1a.w, 1 / R.b1a.h], uThreshold: 0 });
            this._draw(P.blur, R.b2b, { uSrc: R.b2a, uDir: [1.5 / R.b2a.w, 0] });
            this._draw(P.blur, R.b2a, { uSrc: R.b2b, uDir: [0, 1.5 / R.b2a.h] });
        }

        // 4. composite
        this._draw(P.composite, R.color, { uScene: R.scene, uB1: R.b1a, uB2: R.b2a, uBloom: o.bloom });

        // 5. CRT
        this._draw(P.crt, null, {
            uColor: R.color, uSrcRes: [R.color.w, R.color.h], uRes: [this.canvas.width, this.canvas.height],
            uTime: this._time, uFrame: Math.floor(this._frame), uCurv: o.curvature, uScan: o.scanlines,
            uMask: o.mask, uBleed: o.bleed, uSat: o.saturation, uBright: o.brightness, uNoise: o.noise,
            uJitter: o.jitter * motion, uRoll: o.rollBar * motion, uVig: o.vignette, uPulse: this._pulse,
            uDpr: this._dpr, uOutside: this._outside, uClip: this._frameAspect ? 0 : 1, uGlare: o.glare,
        });
    }
}

export default RetroScreen;
