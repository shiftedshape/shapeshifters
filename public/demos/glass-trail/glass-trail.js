/**
 * GlassTrail — an image that turns into fluted (reeded) glass where the pointer moves.
 * Plain WebGL2, no dependencies.
 *
 *   import { GlassTrail } from './glass-trail.js'
 *   const fx = new GlassTrail(el, { image: '/project.jpg' })
 *   fx.set({ flutes: 32 })
 *   fx.destroy()
 *
 * The container keeps a normal <img> underneath (alt text, SEO, no-WebGL fallback);
 * the canvas draws over it once the image has loaded.
 */

export const GLASS_TRAIL_DEFAULTS = {
    image: null,            // URL or <img>/<video>/<canvas>
    alt: '',
    fit: 'cover',           // 'cover' | 'contain'
    position: [0.5, 0.5],   // focal point for cover, 0–1

    flutes: 28,             // number of vertical glass strips across the width
    strength: 1,            // overall refraction
    shift: 1,               // vertical slice offset
    lines: 0.5,             // brightness of the flute edges
    shading: 0.35,          // light/dark gradient across each flute
    chroma: 0.35,           // colour fringing

    size: 0.3,              // trail width, share of the image height
    decay: 0.955,           // 0.8 short trail … 0.98 long trail
    hoverAmount: 0.25,      // effect while hovering without moving (0 = only when moving)
    zoom: 1.04,             // image scale on hover (1 = none)
    radius: 0,              // corner radius in px (when used without a wrapper)

    respectReducedMotion: true,
    maxDpr: 2,
    static: false,          // true = plain image only (e.g. inside an editor canvas)
};

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// r = intensity, g = vertical velocity (signed), b = horizontal velocity
const TRAIL = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uAspect;
uniform vec2 uP0;
uniform vec2 uP1;
uniform vec2 uVel;
uniform float uSize;
uniform float uDecay;
uniform float uHover;
uniform float uActive;

float seg(vec2 p, vec2 a, vec2 b){
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

void main(){
    vec4 c = texture(uPrev, vUv) * 0.6
        + (texture(uPrev, vUv + vec2(uTexel.x, 0.0)) + texture(uPrev, vUv - vec2(uTexel.x, 0.0))
         + texture(uPrev, vUv + vec2(0.0, uTexel.y)) + texture(uPrev, vUv - vec2(0.0, uTexel.y))) * 0.1;
    c *= uDecay;

    vec2 p = vUv * uAspect;
    float d = seg(p, uP0 * uAspect, uP1 * uAspect);
    float speed = clamp(length(uVel * uAspect) * 40.0, 0.0, 1.0);
    float brush = (1.0 - smoothstep(uSize * 0.35, uSize, d)) * uActive;
    float amount = brush * max(speed, uHover);

    c.r = max(c.r, amount);
    c.gb = mix(c.gb, uVel.yx * 30.0, brush * speed * 0.5);
    o = vec4(clamp(c.r, 0.0, 1.0), clamp(c.g, -1.0, 1.0), clamp(c.b, -1.0, 1.0), 1.0);
}`;

const DRAW = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uImg;
uniform sampler2D uTrail;
uniform vec2 uScale;
uniform vec2 uFocus;
uniform float uZoom;
uniform float uFlutes;
uniform float uStrength;
uniform float uShift;
uniform float uLines;
uniform float uShading;
uniform float uChroma;
uniform float uReady;

float hash(float n){ return fract(sin(n * 91.3458) * 47453.5453); }

vec2 imgUv(vec2 uv){
    uv = (uv - 0.5) / uZoom + 0.5;
    return (uv - uFocus) * uScale + uFocus;
}

void main(){
    vec4 tr = texture(uTrail, vUv);
    float ink = smoothstep(0.0, 0.6, tr.r) * uStrength;

    float x = vUv.x * uFlutes;
    float col = floor(x);
    float f = fract(x);

    // each flute is a small cylinder lens: compress towards its centre and
    // slide the slice up/down depending on column and pointer motion
    vec2 uv = vUv;
    float lens = (f - 0.5) / uFlutes;
    uv.x -= lens * 2.2 * ink;
    uv.y += ((hash(col) - 0.5) * 0.09 * uShift + tr.g * 0.1) * ink;
    uv.x += tr.b * 0.02 * ink;

    float ca = uChroma * 0.012 * ink * (f - 0.5) * 2.0;
    vec2 base = imgUv(uv);
    vec3 c;
    c.r = texture(uImg, base + vec2(ca, 0.0)).r;
    c.g = texture(uImg, base).g;
    c.b = texture(uImg, base - vec2(ca, 0.0)).b;

    // glass shading: darker on one side, bright line on the edge
    c *= 1.0 - uShading * ink * (0.5 - abs(f - 0.5)) * 0.6 * sign(f - 0.5) - uShading * 0.08 * ink;
    float edge = exp(-f * 38.0) + exp(-(1.0 - f) * 60.0) * 0.4;
    c += edge * uLines * 0.5 * ink;

    o = vec4(c * uReady, uReady);
}`;

export class GlassTrail {
    constructor(target, options = {}) {
        this.o = { ...GLASS_TRAIL_DEFAULTS, ...options };
        this.el = target;
        if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
        target.style.overflow = 'hidden';
        if (this.o.radius) target.style.borderRadius = this.o.radius + 'px';

        this.img = document.createElement('img');
        Object.assign(this.img.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: this.o.fit, display: 'block', transition: 'transform .6s cubic-bezier(.2,.7,.2,1)' });
        this.img.decoding = 'async';
        this.img.draggable = false;
        this.canvas = document.createElement('canvas');
        Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', pointerEvents: 'none' });
        target.append(this.img, this.canvas);

        this._p = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, inside: false };
        this._zoom = 1;
        this._ready = 0;
        this._last = performance.now();
        this._rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

        this.supported = !this.o.static && this._init();
        this._loadImage();
        if (!this.supported) return;

        this._move = e => this._onMove(e);
        this._leave = () => { this._p.inside = false; };
        target.addEventListener('pointermove', this._move, { passive: true });
        target.addEventListener('pointerenter', this._move, { passive: true });
        target.addEventListener('pointerleave', this._leave, { passive: true });
        this._ro = new ResizeObserver(() => this._resize());
        this._ro.observe(target);
        this._visible = true;
        if ('IntersectionObserver' in window) {
            this._io = new IntersectionObserver(([e]) => { this._visible = e.isIntersecting; });
            this._io.observe(target);
        }
        this._resize();
        this._loop = this._loop.bind(this);
        this._raf = requestAnimationFrame(this._loop);
    }

    set(options = {}) {
        const prev = this.o;
        this.o = { ...this.o, ...options };
        if ('image' in options && options.image !== prev.image) this._loadImage();
        if ('alt' in options) this.img.alt = this.o.alt || '';
        if ('fit' in options) this.img.style.objectFit = this.o.fit;
        if ('radius' in options) this.el.style.borderRadius = (this.o.radius || 0) + 'px';
    }

    destroy() {
        cancelAnimationFrame(this._raf);
        if (this.supported) {
            this.el.removeEventListener('pointermove', this._move);
            this.el.removeEventListener('pointerenter', this._move);
            this.el.removeEventListener('pointerleave', this._leave);
            this._ro.disconnect();
            this._io && this._io.disconnect();
            const lose = this.gl.getExtension('WEBGL_lose_context');
            lose && lose.loseContext();
        }
        this.img.remove();
        this.canvas.remove();
    }

    _init() {
        const gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
        if (!gl) return false;
        this.gl = gl;
        this._float = !!gl.getExtension('EXT_color_buffer_float');
        if (!this._float) return false;
        gl.getExtension('OES_texture_float_linear');
        const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error('GlassTrail: ' + gl.getShaderInfoLog(x)); return x; };
        const vs = sh(gl.VERTEX_SHADER, VERT);
        const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p); return { p, loc: {} }; };
        this._trailP = prog(TRAIL);
        this._drawP = prog(DRAW);
        this._vao = gl.createVertexArray();
        gl.bindVertexArray(this._vao);
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        this._imgTex = this._tex(1, 1, false);
        return true;
    }

    _tex(w, h, float) {
        const gl = this.gl, t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
        return t;
    }

    _rt(w, h) {
        const gl = this.gl, tex = this._tex(w, h, true), fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { fb, tex, w, h };
    }

    _loadImage() {
        const src = this.o.image;
        this._imgEl = null;
        this._ready = 0;
        if (!src) { this.img.removeAttribute('src'); return; }
        if (typeof src === 'string') {
            // the visible image never asks for CORS, so it always shows;
            // the effect reads a separate CORS copy and stays off if that is refused
            this.img.alt = this.o.alt || '';
            this.img.src = src;
            if (!this.supported) return;
            const tex = new Image();
            tex.crossOrigin = 'anonymous';
            tex.decoding = 'async';
            tex.onload = () => { if (this.o.image === src) { this._imgEl = tex; this._upload(); } };
            tex.src = src;
        } else {
            this._imgEl = src;
            if (src.tagName === 'IMG') this.img.src = src.currentSrc || src.src;
            this._upload();
        }
    }

    _upload() {
        if (!this.supported || !this._imgEl) return;
        const el = this._imgEl, gl = this.gl;
        const w = el.naturalWidth || el.videoWidth || el.width, h = el.naturalHeight || el.videoHeight || el.height;
        if (!w || !h) return;
        gl.bindTexture(gl.TEXTURE_2D, this._imgTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, el);
            this._imgAspect = w / h;
            this._ready = 1;
        } catch (e) { this._ready = 0; } // CORS-blocked: the plain <img> stays visible
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    _resize() {
        const r = this.el.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, this.o.maxDpr);
        this.canvas.width = Math.max(1, Math.round(r.width * dpr));
        this.canvas.height = Math.max(1, Math.round(r.height * dpr));
        this._aspect = r.width / Math.max(1, r.height);
        const tw = 160, th = Math.max(16, Math.round(160 / Math.max(this._aspect, 0.2)));
        if (!this._A || this._A.w !== tw || this._A.h !== th) { this._A = this._rt(tw, th); this._B = this._rt(tw, th); }
    }

    _onMove(e) {
        const r = this.el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
        const p = this._p;
        if (!p.inside) { p.px = x; p.py = y; }
        p.x = x; p.y = y; p.inside = true;
    }

    _u(prog, k) { let l = prog.loc[k]; if (l === undefined) l = prog.loc[k] = this.gl.getUniformLocation(prog.p, k); return l; }

    _loop(now) {
        this._raf = requestAnimationFrame(this._loop);
        const dt = Math.min(3, (now - this._last) / 16.667);
        this._last = now;
        if (!this._visible || document.hidden || !this._A) return;
        const gl = this.gl, o = this.o, p = this._p;
        if (this._imgEl && this._imgEl.tagName === 'VIDEO') this._upload();

        const reduced = o.respectReducedMotion && this._rm && this._rm.matches;
        const vx = p.x - p.px, vy = p.y - p.py;
        const targetZoom = p.inside && !reduced ? o.zoom : 1;
        this._zoom += (targetZoom - this._zoom) * 0.08 * dt;

        gl.bindVertexArray(this._vao);
        gl.disable(gl.BLEND);

        // trail
        let P = this._trailP;
        gl.useProgram(P.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._A.tex);
        gl.uniform1i(this._u(P, 'uPrev'), 0);
        gl.uniform2f(this._u(P, 'uTexel'), 1 / this._A.w, 1 / this._A.h);
        gl.uniform2f(this._u(P, 'uAspect'), this._aspect, 1);
        gl.uniform2f(this._u(P, 'uP0'), p.px, p.py);
        gl.uniform2f(this._u(P, 'uP1'), p.x, p.y);
        gl.uniform2f(this._u(P, 'uVel'), vx / dt, vy / dt);
        gl.uniform1f(this._u(P, 'uSize'), o.size);
        gl.uniform1f(this._u(P, 'uDecay'), Math.pow(o.decay, dt));
        gl.uniform1f(this._u(P, 'uHover'), o.hoverAmount);
        gl.uniform1f(this._u(P, 'uActive'), p.inside && !reduced ? 1 : 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._B.fb);
        gl.viewport(0, 0, this._B.w, this._B.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        [this._A, this._B] = [this._B, this._A];
        p.px = p.x; p.py = p.y;

        // image
        const ca = this._aspect, ia = this._imgAspect || ca;
        const cover = o.fit !== 'contain';
        const s = (ia > ca) === cover ? [ca / ia, 1] : [1, ia / ca];
        P = this._drawP;
        gl.useProgram(P.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._imgTex);
        gl.uniform1i(this._u(P, 'uImg'), 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this._A.tex);
        gl.uniform1i(this._u(P, 'uTrail'), 1);
        gl.uniform2f(this._u(P, 'uScale'), s[0], s[1]);
        gl.uniform2f(this._u(P, 'uFocus'), o.position[0], 1 - o.position[1]);
        gl.uniform1f(this._u(P, 'uZoom'), this._zoom);
        gl.uniform1f(this._u(P, 'uFlutes'), o.flutes);
        gl.uniform1f(this._u(P, 'uStrength'), o.strength);
        gl.uniform1f(this._u(P, 'uShift'), o.shift);
        gl.uniform1f(this._u(P, 'uLines'), o.lines);
        gl.uniform1f(this._u(P, 'uShading'), o.shading);
        gl.uniform1f(this._u(P, 'uChroma'), o.chroma);
        gl.uniform1f(this._u(P, 'uReady'), this._ready);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
}

export default GlassTrail;
