/*!
 * Shader Media · Shapeshifters (shapeshifters.supply)
 * Prism, Pixel and Halftone effects for an image or video, triggered by hover, scroll or always on.
 * Plain JS port of the Framer component, WebGL1, no dependencies.
 */
const VERT = `attribute vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `precision highp float;
uniform vec2 u_res;
uniform float u_time, u_dpr;
uniform sampler2D u_tex;
uniform float u_hasTex, u_ca, u_ia, u_fit;
uniform vec3 u_bg;
uniform float u_mode, u_amount;
uniform vec2 u_ptr;
uniform float u_ptrInf, u_radius;
uniform vec2 u_vel;
uniform float u_split, u_noise, u_speed, u_grain;
uniform float u_grid, u_ab;
uniform float u_dot, u_angle, u_useColor, u_ptrFx;
uniform vec3 u_ink, u_paper;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec3 placeholder(vec2 uv){
  float t = clamp(uv.x * 0.8 + 0.3 * sin(uv.y * 5.0 + 1.0), 0.0, 1.0);
  return mix(vec3(0.16, 0.2, 0.85), vec3(1.0, 0.45, 0.55), t) * (0.55 + 0.45 * uv.y);
}

vec3 samp(vec2 uv){
  if (u_hasTex < 0.5) return placeholder(uv);
  float r = u_ca / u_ia;
  vec2 s;
  if (u_fit < 0.5) s = r > 1.0 ? vec2(1.0, 1.0 / r) : vec2(r, 1.0);
  else s = r > 1.0 ? vec2(r, 1.0) : vec2(1.0, 1.0 / r);
  vec2 t = (uv - 0.5) * s + 0.5;
  if (u_fit < 0.5) t = clamp(t, 0.0, 1.0);
  else if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return u_bg;
  return texture2D(u_tex, t).rgb;
}

vec3 prism(vec2 uv){
  vec2 center = mix(vec2(0.5), u_ptr, u_ptrInf);
  float dist = distance(uv, center);
  float t = u_time * u_speed;
  float n = noise(uv * u_noise + t);
  float wave = sin((uv.y + t * 0.5) * (u_noise + 2.0) + n * 3.0);
  vec2 d = uv + vec2(wave * 0.02, n * 0.02) * u_amount * (1.0 - dist * 0.4);
  float s = u_split * 0.012 * u_amount;
  vec2 dir = normalize(uv - center + 0.0001);
  return vec3(samp(d + dir * s).r, samp(d).g, samp(d - dir * s).b);
}

vec3 pixel(vec2 uv){
  vec2 asp = vec2(u_ca, 1.0);
  vec2 gn = vec2(u_grid, max(1.0, floor(u_grid / u_ca + 0.5)));
  vec2 c = (floor(uv * gn) + 0.5) / gn;
  float strength = smoothstep(u_radius, 0.0, length((c - u_ptr) * asp)) * u_amount;
  vec2 uv2 = uv + strength * u_vel * 0.2;
  float s = strength * u_ab * 0.01;
  return vec3(samp(uv2 + vec2(s, 0.0)).r, samp(uv2).g, samp(uv2 - vec2(s, 0.0)).b);
}

vec3 halftone(vec2 uv){
  vec2 asp = vec2(u_ca, 1.0);
  float near = smoothstep(u_radius, 0.0, length((uv - u_ptr) * asp)) * u_ptrInf;
  vec2 luv = uv;
  if (u_ptrFx > 0.5 && u_ptrFx < 1.5) luv = uv - (uv - u_ptr) * near * 0.4;
  vec2 px = luv * u_res;
  float s = sin(u_angle), c = cos(u_angle);
  vec2 rp = vec2(c * px.x - s * px.y, s * px.x + c * px.y);
  float cell = max(2.0, u_dot * u_dpr);
  vec2 cc = (floor(rp / cell) + 0.5) * cell;
  vec2 local = rp - cc;
  vec2 cpx = vec2(c * cc.x + s * cc.y, -s * cc.x + c * cc.y);
  vec3 col = samp(cpx / u_res);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float r = sqrt(clamp(1.0 - lum, 0.0, 1.0)) * cell * 0.7071;
  float m = 1.0 - smoothstep(r - 0.75, r + 0.75, length(local));
  vec3 inkCol = mix(u_ink, col, u_useColor);
  vec3 ht = mix(u_paper, inkCol, m);
  float a = u_amount;
  if (u_ptrFx > 1.5) a *= 1.0 - near;
  return mix(samp(uv), ht, a);
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.y = 1.0 - uv.y;
  vec3 col;
  if (u_mode < 0.5) col = prism(uv);
  else if (u_mode < 1.5) col = pixel(uv);
  else col = halftone(uv);
  col += (hash(uv * u_res + u_time) - 0.5) * u_grain;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

export const SHADER_MEDIA_DEFAULTS = {
  image: '', video: '', fit: 'cover', background: '#0B0B0D',
  mode: 'prism', trigger: 'hover', scrollStyle: 'resolve',
  intensity: 1, restIntensity: 0.2, radius: 0.3, grain: 0.05,
  rgbSplit: 3, noiseScale: 4, speed: 0.25,
  gridSize: 20, aberration: 1, followEase: 0.02, decay: 0.05,
  dotSize: 8, angle: 45, halftoneColor: 'ink', ink: '#111111', paper: '#F2EFE8', pointerFx: 'magnify',
  grayscaleUntilHover: false,
}

const MODE_INDEX = { prism: 0, pixel: 1, halftone: 2 }
const FX_INDEX = { none: 0, magnify: 1, reveal: 2 }
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const smooth = (x) => x * x * (3 - 2 * x)
const toRGB = (hex) => {
  let h = String(hex || '#000').replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16) || 0
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export class ShaderMedia {
  constructor(el, options = {}) {
    this.el = el
    this.o = { ...SHADER_MEDIA_DEFAULTS, ...options }
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    el.style.overflow = 'hidden'
    el.style.touchAction = 'pan-y'
    el.style.background = this.o.background
    const c = (this.canvas = document.createElement('canvas'))
    Object.assign(c.style, { width: '100%', height: '100%', display: 'block', transition: 'filter .4s ease' })
    el.appendChild(c)
    const gl = (this.gl = c.getContext('webgl', { antialias: false, premultipliedAlpha: false }))
    this.supported = !!gl
    if (!gl) return
    const compile = (type, s) => { const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh); return sh }
    const prog = (this.prog = gl.createProgram())
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const tex = (this.tex = gl.createTexture())
    gl.bindTexture(gl.TEXTURE_2D, tex)
    for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    this.U = {}
    this.m = { ready: false, aspect: 1, video: null }
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const now = performance.now()
    this.s = { target: { x: .5, y: .5 }, prev: { x: .5, y: .5 }, cur: { x: .5, y: .5 }, soft: { x: .5, y: .5 }, ease: .02, hovered: false, ptrInf: 0, ab: 0, amount: this.o.restIntensity, prevTop: null, scrollVel: 0, visible: true, t0: now, last: now }
    const rel = (e) => { const r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } }
    const s = this.s
    this.onEnter = (e) => { const p = rel(e); s.target = { ...p }; s.prev = { ...p }; s.cur = { ...p }; s.soft = { ...p }; s.hovered = true; s.ease = this.o.followEase; this.gray() }
    this.onMove = (e) => { const p = rel(e); if (!s.hovered) this.onEnter(e); s.prev = { ...s.target }; s.target = p; s.ab = this.o.aberration; s.ease = this.o.followEase }
    this.onLeave = () => { s.hovered = false; s.ease = .05; s.target = { ...s.prev }; this.gray() }
    el.addEventListener('pointerenter', this.onEnter)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerleave', this.onLeave)
    this.io = new IntersectionObserver(([en]) => { s.visible = en.isIntersecting; s.prevTop = null; const v = this.m.video; if (v) s.visible ? v.play().catch(() => {}) : v.pause() })
    this.io.observe(el)
    this.load()
    this.gray()
    this.frame = this.frame.bind(this)
    this.raf = requestAnimationFrame(this.frame)
  }
  gray() { this.canvas.style.filter = this.o.grayscaleUntilHover && !this.s.hovered ? 'saturate(0)' : 'none' }
  set(opts) { const src = this.o.image + '|' + this.o.video; Object.assign(this.o, opts); this.el.style.background = this.o.background; if (src !== this.o.image + '|' + this.o.video) this.load(); this.gray() }
  load() {
    const { gl, tex, m } = this
    m.ready = false
    if (m.video) { m.video.pause(); m.video = null }
    if (this.o.video) {
      const v = Object.assign(document.createElement('video'), { crossOrigin: 'anonymous', muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto', src: this.o.video })
      v.play().catch(() => {}); m.video = v; return
    }
    if (!this.o.image) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); m.aspect = img.naturalWidth / Math.max(1, img.naturalHeight); m.ready = true }
    img.src = this.o.image
  }
  u(n) { return n in this.U ? this.U[n] : (this.U[n] = this.gl.getUniformLocation(this.prog, n)) }
  frame(now) {
    this.raf = requestAnimationFrame(this.frame)
    const { gl, canvas, s, m, o: P } = this
    const dt = Math.min(.05, (now - s.last) / 1000); s.last = now
    if (!s.visible) return
    const k = (e) => 1 - Math.pow(1 - e, dt * 60)
    const f1 = (n, a) => gl.uniform1f(this.u(n), a), f2 = (n, a, b) => gl.uniform2f(this.u(n), a, b), f3 = (n, c) => gl.uniform3f(this.u(n), c[0], c[1], c[2])
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h) }
    const rect = this.el.getBoundingClientRect(), vh = innerHeight || 1
    const progress = clamp01((vh - rect.top) / (vh + rect.height))
    const rawVel = s.prevTop === null ? 0 : (s.prevTop - rect.top) / vh
    s.prevTop = rect.top
    s.scrollVel += (rawVel - s.scrollVel) * k(.2)
    let active = 0
    if (P.trigger === 'always') active = 1
    else if (P.trigger === 'hover') active = s.hovered ? 1 : 0
    else if (P.scrollStyle === 'resolve') active = smooth(clamp01(Math.abs(progress - .5) * 2))
    else if (P.scrollStyle === 'build') active = smooth(progress)
    else active = clamp01(Math.abs(s.scrollVel) * 40)
    const target = P.restIntensity + (P.intensity - P.restIntensity) * active
    s.amount += (target - s.amount) * k(P.trigger === 'scroll' && P.scrollStyle !== 'velocity' ? .25 : .08)
    s.cur.x += (s.target.x - s.cur.x) * k(s.ease); s.cur.y += (s.target.y - s.cur.y) * k(s.ease)
    s.soft.x += (s.target.x - s.soft.x) * k(.2); s.soft.y += (s.target.y - s.soft.y) * k(.2)
    s.ptrInf += ((s.hovered ? 1 : 0) - s.ptrInf) * k(.08)
    s.ab = Math.max(0, s.ab - P.decay * dt * 60)
    if (m.video && m.video.readyState >= 2) { gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m.video); m.aspect = m.video.videoWidth / Math.max(1, m.video.videoHeight); m.ready = true }
    f2('u_res', w, h); f1('u_time', this.reduce ? 0 : (now - s.t0) / 1000); f1('u_dpr', dpr)
    f1('u_hasTex', m.ready ? 1 : 0); f1('u_ca', w / h); f1('u_ia', m.aspect || 1); f1('u_fit', P.fit === 'contain' ? 1 : 0); f3('u_bg', toRGB(P.background))
    f1('u_mode', MODE_INDEX[P.mode] ?? 0); f1('u_amount', s.amount); f1('u_ptrInf', s.ptrInf); f1('u_radius', P.radius); f1('u_grain', P.grain)
    f1('u_split', P.rgbSplit); f1('u_noise', P.noiseScale); f1('u_speed', P.speed); f1('u_grid', P.gridSize)
    f1('u_dot', P.dotSize); f1('u_angle', P.angle * Math.PI / 180); f1('u_useColor', P.halftoneColor === 'image' ? 1 : 0); f1('u_ptrFx', FX_INDEX[P.pointerFx] ?? 1)
    f3('u_ink', toRGB(P.ink)); f3('u_paper', toRGB(P.paper))
    if (P.mode === 'pixel' && P.trigger === 'scroll' && !s.hovered) { f2('u_ptr', .5, .5); f1('u_radius', .9); f2('u_vel', 0, s.scrollVel * 8); f1('u_ab', clamp01(Math.abs(s.scrollVel) * 40) * P.aberration * 2); f1('u_amount', Math.max(s.amount, P.intensity)) }
    else if (P.mode === 'pixel') { f2('u_ptr', s.cur.x, s.cur.y); f2('u_vel', s.cur.x - s.prev.x, s.cur.y - s.prev.y); f1('u_ab', s.ab) }
    else { f2('u_ptr', s.soft.x, s.soft.y); f2('u_vel', 0, 0); f1('u_ab', 0) }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(this.u('u_tex'), 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  destroy() {
    cancelAnimationFrame(this.raf); this.io.disconnect()
    this.el.removeEventListener('pointerenter', this.onEnter); this.el.removeEventListener('pointermove', this.onMove); this.el.removeEventListener('pointerleave', this.onLeave)
    if (this.m.video) this.m.video.pause()
    const ext = this.gl && this.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext()
    this.canvas.remove()
  }
}
export default ShaderMedia
