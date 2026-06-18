/* ==========================================================================
   STRANDS — Vanilla JS WebGL port (no React, no OGL)
   Drop-in replacement for the React Strands component
   ========================================================================== */

const MAX_STRANDS = 12;
const MAX_COLORS  = 8;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uColors[${MAX_COLORS}];
uniform int   uColorCount;
uniform int   uStrandCount;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uHueShift;
uniform float uIntensity;
uniform float uOpacity;
uniform float uScale;
uniform float uSaturation;

out vec4 fragColor;
const float PI = 3.14159265;

vec3 spectrum(float t){
  return 0.5 + 0.5*cos(2.0*PI*(t+vec3(0.00,0.33,0.67)));
}
vec3 samplePalette(float t){
  t = fract(t);
  float scaled = t*float(uColorCount);
  int idx  = int(floor(scaled));
  float bl = fract(scaled);
  int ni   = idx+1; if(ni>=uColorCount) ni=0;
  return mix(uColors[idx], uColors[ni], bl);
}
vec3 strandColor(float t){
  if(uColorCount>0) return samplePalette(t);
  return spectrum(t);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uResolution) / uResolution.y;
  uv /= max(uScale, 0.0001);

  float e   = 0.06 + uIntensity*0.94;
  float env = pow(max(cos(uv.x*PI*1.3),0.0), uTaper);
  vec3  col = vec3(0.0);

  for(int i=0;i<${MAX_STRANDS};i++){
    if(i>=uStrandCount) break;
    float fi  = float(i);
    float ph  = fi*1.7*uSpread;
    float freq= (2.0+fi*0.35)*uWaviness;
    float spd = 1.4+fi*1.2;
    float tt  = uTime*uSpeed;
    float w   = sin(uv.x*freq+tt*spd+ph)*0.60
              + sin(uv.x*freq*1.1-tt*spd*0.7+ph*1.7)*0.40;
    float amp = (0.1+0.02*e)*env*uAmplitude;
    float y   = w*amp;
    float d   = abs(uv.y-y);
    float thick = (0.001+0.05*e)*(0.35+env)*uThickness;
    float g   = thick/(d+thick*0.45);
    g = g*g;
    float h   = fi/float(uStrandCount)+uv.x*0.30+uTime*0.04+uHueShift;
    col += strandColor(h)*g*env;
  }

  col *= 0.45+0.7*e;
  col  = 1.0-exp(-col*uGlow);
  float gray = dot(col,vec3(0.2126,0.7152,0.0722));
  col = max(mix(vec3(gray),col,uSaturation),0.0);
  float lum  = max(max(col.r,col.g),col.b);
  float alpha= clamp(lum,0.0,1.0)*uOpacity;
  fragColor  = vec4(col*uOpacity, alpha);
}`;

/* ── helpers ── */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return [r,g,b];
}

function buildPalette(colors) {
  const filled = (colors && colors.length) ? colors : ['#ffffff'];
  const out = [];
  for (let i = 0; i < MAX_COLORS; i++) {
    const hex = filled[i] ?? filled[filled.length-1];
    out.push(...hexToRgb(hex));
  }
  return new Float32Array(out);
}

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    console.error('Shader error:', gl.getShaderInfoLog(s));
  return s;
}

function createProgram(gl, vert, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER,   vert));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    console.error('Program error:', gl.getProgramInfoLog(p));
  return p;
}

/* ── main factory ── */
export function createStrands(container, opts = {}) {
  const cfg = {
    colors:     opts.colors     ?? ['#F97316','#7C3AED','#06B6D4'],
    count:      opts.count      ?? 3,
    speed:      opts.speed      ?? 0.5,
    amplitude:  opts.amplitude  ?? 1,
    waviness:   opts.waviness   ?? 1,
    thickness:  opts.thickness  ?? 0.7,
    glow:       opts.glow       ?? 2.6,
    taper:      opts.taper      ?? 3,
    spread:     opts.spread     ?? 1,
    hueShift:   opts.hueShift   ?? 0,
    intensity:  opts.intensity  ?? 0.6,
    saturation: opts.saturation ?? 2,
    opacity:    opts.opacity    ?? 1,
    scale:      opts.scale      ?? 1.5,
  };

  /* canvas */
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  container.appendChild(canvas);

  const gl = canvas.getContext('webgl2', {
    alpha: true, premultipliedAlpha: true, antialias: true
  });
  if (!gl) { console.error('WebGL2 not supported'); return () => {}; }

  gl.clearColor(0,0,0,0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  /* full-screen triangle */
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);

  const prog = createProgram(gl, VERT, FRAG);
  const aPos = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  /* uniform locations */
  const U = {};
  ['uTime','uResolution','uColors','uColorCount','uStrandCount',
   'uSpeed','uAmplitude','uWaviness','uThickness','uGlow','uTaper',
   'uSpread','uHueShift','uIntensity','uOpacity','uScale','uSaturation']
  .forEach(n => U[n] = gl.getUniformLocation(prog, n));

  /* resize */
  function resize() {
    const w = container.offsetWidth  || 1;
    const h = container.offsetHeight || 1;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  /* render loop */
  let rafId;
  function render(t) {
    rafId = requestAnimationFrame(render);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);

    gl.uniform1f(U.uTime,       t * 0.001);
    gl.uniform2f(U.uResolution, canvas.width, canvas.height);
    gl.uniform3fv(U.uColors,    buildPalette(cfg.colors));
    gl.uniform1i(U.uColorCount, Math.min(cfg.colors.length, MAX_COLORS));
    gl.uniform1i(U.uStrandCount,Math.min(Math.max(Math.round(cfg.count),1), MAX_STRANDS));
    gl.uniform1f(U.uSpeed,      cfg.speed);
    gl.uniform1f(U.uAmplitude,  cfg.amplitude);
    gl.uniform1f(U.uWaviness,   cfg.waviness);
    gl.uniform1f(U.uThickness,  cfg.thickness);
    gl.uniform1f(U.uGlow,       cfg.glow);
    gl.uniform1f(U.uTaper,      cfg.taper);
    gl.uniform1f(U.uSpread,     cfg.spread);
    gl.uniform1f(U.uHueShift,   cfg.hueShift);
    gl.uniform1f(U.uIntensity,  cfg.intensity);
    gl.uniform1f(U.uOpacity,    cfg.opacity);
    gl.uniform1f(U.uScale,      cfg.scale);
    gl.uniform1f(U.uSaturation, cfg.saturation);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  rafId = requestAnimationFrame(render);

  /* cleanup */
  return function destroy() {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  };
}
