/** Small, self-contained plasma renderer. The caller owns size and animation policy. */
export type StellarRenderer = {
  draw(time: number, progress: number | null): void;
  dispose(): void;
};

const vertexSource = `
attribute vec2 a_position;
varying vec2 v_position;
void main() {
  v_position = a_position;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_position;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_progress;
uniform float u_boundary;
uniform float u_flare_seed;

float hash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 3.33);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.54;
  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec3(5.2, 1.3, 7.1);
    amplitude *= 0.48;
  }
  return value;
}
vec3 plasmaColor(vec2 disc, float texture) {
  if (u_progress < 0.0) return vec3(0.43, 0.54, 0.63);
  vec3 red = vec3(0.92, 0.036, 0.014);
  vec3 orange = vec3(1.0, 0.285, 0.026);
  vec3 green = vec3(0.12, 0.86, 0.235);
  float coverage = u_progress <= 60.0 ? u_progress / 60.0 : (u_progress - 60.0) / 20.0;
  vec3 first = u_progress <= 60.0 ? red : orange;
  vec3 second = u_progress <= 60.0 ? orange : green;
  if (coverage <= 0.001) return first;
  if (coverage >= 0.999) return second;
  float projected = dot(disc, vec2(0.927, 0.375));
  float boundary = u_boundary + (texture - 0.5) * 0.20;
  float mask = 1.0 - smoothstep(boundary - 0.045, boundary + 0.045, projected);
  return mix(first, second, mask);
}
void main() {
  vec2 p = v_position;
  p.x *= u_resolution.x / max(1.0, u_resolution.y);
  float radius = length(p);
  if (radius > 0.98) { gl_FragColor = vec4(0.0); return; }
  const float sphereRadius = 0.60;
  vec2 disc = p / sphereRadius;
  vec2 direction = p / max(radius, 0.0001);
  float time = u_time * 0.16;
  float outside = max(0.0, radius - sphereRadius);

  // Direction-domain noise has no angular seam; outward drift carries the wisps.
  vec3 plumePoint = vec3(direction * (5.0 + outside * 3.0), outside * 13.0 - time);
  float plume = fbm(plumePoint + vec3(time * 0.10, -time * 0.07, 0.0));
  float threads = noise(vec3(direction * 24.0 + plume * 3.0, outside * 29.0 - time * 1.8));
  float reach = 0.026 + pow(plume, 3.0) * 0.60;
  float corona = exp(-outside / reach) * (0.08 + plume * plume * 1.20 + pow(threads, 5.0) * 0.50);
  corona *= 1.0 - smoothstep(0.86, 0.98, radius);
  vec3 coronaHue = plasmaColor(direction, plume);
  // Staggered magnetic arches grow from two feet on the limb. Their flowing
  // filaments inherit the local surface hue instead of becoming white sparks.
  vec3 flareLight = vec3(0.0);
  float flareAlpha = 0.0;
  if (radius > sphereRadius - 0.025) {
    for (int index = 0; index < 4; index++) {
      float seed = float(index);
      // Two recurring arches plus up to two randomly enabled ones. Decide at
      // birth and keep the choice for the entire lifetime to avoid popping.
      float offset = index == 1 ? 0.5 : index == 2 ? 0.25 : index == 3 ? 0.75 : 0.0;
      float cycle = u_time * 0.075 + offset;
      float count = 2.0 + floor(hash(vec3(floor(cycle), u_flare_seed, 7.3)) * 3.0);
      if (seed >= count) continue;
      float phase = fract(cycle);
      float life = sin(phase * 3.141593);
      float strength = smoothstep(0.0, 0.18, phase) * (1.0 - smoothstep(0.68, 1.0, phase));
      // Each birth advances around the limb by the golden angle. Relocate only
      // between lifetimes, when strength is zero, so an active flare never jumps.
      float birth = floor(cycle) * 4.0 - seed;
      float angle = birth * 2.399963 + 0.35 + sin(u_time * 0.08 + seed) * 0.10;
      vec2 axis = vec2(cos(angle), sin(angle));
      vec2 tangent = vec2(-axis.y, axis.x);
      float height = 0.065 + 0.265 * pow(max(life, 0.0), 0.8);
      float width = 0.125 + 0.035 * sin(seed * 1.7 + 1.0);
      float altitude = dot(p, axis) - 0.578;
      float sideways = dot(p, tangent) - altitude * sin(seed + u_time * 0.23) * 0.20;
      vec2 arch = vec2(sideways / width, altitude / height);
      float distanceToLoop = abs(length(arch) - 1.0) * min(width, height);
      float turbulence = sin(altitude * 44.0 - u_time * 2.4 + seed) * 0.005;
      distanceToLoop = max(0.0, distanceToLoop + turbulence);
      float filament = exp(-distanceToLoop * distanceToLoop / 0.00010);
      float glow = exp(-distanceToLoop * distanceToLoop / 0.0011);
      float plasma = noise(vec3(p * 48.0, u_time * 0.7 + seed));
      float flow = 0.64 + 0.36 * sin(atan(arch.y, arch.x) * 7.0 - u_time * 2.8 + seed);
      float rooted = smoothstep(-0.015, 0.025, altitude);
      float energy = (filament * flow * (0.55 + plasma) + glow * 0.40) * strength * rooted;
      energy *= u_progress < 0.0 ? 0.30 : 1.0;
      vec3 hue = plasmaColor(axis, plume);
      flareLight += hue * energy * 1.8;
      flareAlpha += energy * 0.8;
    }
  }
  float pixel = 2.0 / max(1.0, u_resolution.y);
  float body = 1.0 - smoothstep(sphereRadius - pixel, sphereRadius + pixel, radius);
  vec3 surface = vec3(0.0);

  if (body > 0.0) {
    float z = sqrt(max(0.0, 1.0 - dot(disc, disc)));
    vec3 normal = vec3(disc, z);
    float rotation = time * 0.14;
    mat2 turn = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
    normal.xz = turn * normal.xz;
    float warp = fbm(normal * 3.6 + vec3(0.0, time * 0.07, time * 0.035));
    vec3 flowing = normal * 11.0 + vec3(warp * 2.3, warp, time * 0.20);
    float cells = fbm(flowing);
    float grains = noise(normal * 79.0 + cells * 4.0 + time * 0.14);
    float ridges = pow(1.0 - abs(cells * 2.0 - 1.0), 10.0);
    float spots = smoothstep(0.57, 0.77, warp) * smoothstep(0.40, 0.68, cells);
    float limb = 0.44 + 0.56 * pow(z, 0.45);
    float radiance = (0.32 + cells * 0.74 + grains * 0.29 + ridges * 0.37) * limb;
    radiance *= 1.0 - spots * 0.53;
    vec3 hue = plasmaColor(disc, warp);
    surface = hue * radiance * 1.65;
    // Hot granular filaments remain tinted, avoiding a flat white centre.
    surface += mix(hue, vec3(1.0, 0.91, 0.73), 0.22) * pow(grains, 7.0) * ridges * 0.37;
    float hotLimb = pow(1.0 - z, 9.0) * (0.10 + pow(threads, 4.0) * 0.40);
    surface += hue * hotLimb;
    surface *= 1.0 + max(0.0, u_progress - 80.0) * 0.0035;
  }
  float edgeFade = 1.0 - smoothstep(0.91, 0.98, radius);
  flareLight *= edgeFade;
  flareAlpha *= edgeFade;
  float auraAlpha = clamp(corona * 0.65 + flareAlpha, 0.0, 0.94);
  float alpha = body + auraAlpha * (1.0 - body);
  vec3 aura = coronaHue * (0.84 + threads * 0.35) + flareLight;
  vec3 color = mix(aura, surface, body);
  color = 1.0 - exp(-color * 1.65);
  gl_FragColor = vec4(color * alpha, alpha);
}`;

export function createStellarRenderer(canvas: HTMLCanvasElement): StellarRenderer | null {
  let gl: WebGLRenderingContext | null;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
  } catch { return null; }
  if (!gl) return null;
  const context = gl;
  let disposed = false;
  let lost = false;
  let vertex: WebGLShader | null = null;
  let fragment: WebGLShader | null = null;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  function release() {
    if (buffer) context.deleteBuffer(buffer);
    if (program) context.deleteProgram(program);
    if (vertex) context.deleteShader(vertex);
    if (fragment) context.deleteShader(fragment);
    buffer = null; program = null; vertex = null; fragment = null;
  }
  const onLost = () => { lost = true; };
  try {
    vertex = context.createShader(context.VERTEX_SHADER);
    fragment = context.createShader(context.FRAGMENT_SHADER);
    program = context.createProgram(); buffer = context.createBuffer();
    if (!vertex || !fragment || !program || !buffer) { release(); return null; }
    context.shaderSource(vertex, vertexSource); context.compileShader(vertex);
    context.shaderSource(fragment, fragmentSource); context.compileShader(fragment);
    if (!context.getShaderParameter(vertex, context.COMPILE_STATUS) || !context.getShaderParameter(fragment, context.COMPILE_STATUS)) { release(); return null; }
    context.attachShader(program, vertex); context.attachShader(program, fragment); context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) { release(); return null; }
    const position = context.getAttribLocation(program, 'a_position');
    const resolution = context.getUniformLocation(program, 'u_resolution');
    const timeUniform = context.getUniformLocation(program, 'u_time');
    const progressUniform = context.getUniformLocation(program, 'u_progress');
    const boundaryUniform = context.getUniformLocation(program, 'u_boundary');
    const flareSeedUniform = context.getUniformLocation(program, 'u_flare_seed');
    if (position < 0 || resolution === null || timeUniform === null || progressUniform === null || boundaryUniform === null || flareSeedUniform === null) { release(); return null; }
    const flareSeed = Math.random() * 31;
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), context.STATIC_DRAW);
    canvas.addEventListener('webglcontextlost', onLost);
    return {
      draw(time, progress) {
        if (disposed || lost || context.isContextLost() || !canvas.width || !canvas.height) return;
        context.viewport(0, 0, canvas.width, canvas.height);
        context.useProgram(program); context.bindBuffer(context.ARRAY_BUFFER, buffer);
        context.enableVertexAttribArray(position); context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
        context.disable(context.DEPTH_TEST); context.disable(context.BLEND);
        context.uniform2f(resolution, canvas.width, canvas.height);
        context.uniform1f(timeUniform, Number.isFinite(time) ? Math.max(0, time) % 4096 : 0);
        context.uniform1f(flareSeedUniform, flareSeed);
        const boundedProgress = progress !== null && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : -1;
        context.uniform1f(progressUniform, boundedProgress);
        const coverage = Math.max(0, Math.min(1, boundedProgress <= 60 ? boundedProgress / 60 : (boundedProgress - 60) / 20));
        // Invert projected-disc area once per frame, keeping division spatial.
        // At 75% progress the green region covers about 75% of the disc.
        let boundary = Math.max(-0.999, Math.min(0.999, coverage * 2 - 1));
        for (let step = 0; step < 4; step++) {
          const height = Math.sqrt(Math.max(0.001, 1 - boundary * boundary));
          const area = 0.5 + (Math.asin(boundary) + boundary * height) / Math.PI;
          boundary = Math.max(-0.999, Math.min(0.999, boundary - (area - coverage) / Math.max(0.03, 2 * height / Math.PI)));
        }
        context.uniform1f(boundaryUniform, boundary);
        context.drawArrays(context.TRIANGLES, 0, 6);
      },
      dispose() {
        if (disposed) return;
        disposed = true; canvas.removeEventListener('webglcontextlost', onLost); release();
      },
    };
  } catch { release(); return null; }
}
