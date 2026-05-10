import { useEffect, useRef, useCallback, useState } from 'react';

export type Anime4KMode = 'OFF' | 'A' | 'B' | 'C' | 'A_PLUS' | 'B_PLUS' | 'C_PLUS';
export type Anime4KQuality = 'S' | 'M' | 'L'; // Fast, Balanced, High

interface Anime4KState {
  enabled: boolean;
  mode: Anime4KMode;
  quality: Anime4KQuality;
}

const DEFAULT_STATE: Anime4KState = {
  enabled: false,
  mode: 'A_PLUS',
  quality: 'M',
};

// Simple sharpening kernel for S quality
const SHARPEN_KERNEL_S = new Float32Array([
  0, -1, 0,
  -1, 5, -1,
  0, -1, 0
]);

// Enhanced sharpening for M quality
const SHARPEN_KERNEL_M = new Float32Array([
  -1, -1, -1,
  -1, 9, -1,
  -1, -1, -1
]);

// Complex edge enhancement for L quality
const EDGE_ENHANCE_L = new Float32Array([
  -1, -2, -1,
  -2, 12, -2,
  -1, -2, -1
]);

// Vertex shader for basic quad rendering
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// Fragment shader with configurable quality levels
const FRAGMENT_SHADER_TEMPLATE = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  uniform vec2 u_textureSize;
  uniform float u_enable;
  uniform float u_quality; // 0.0 = S, 1.0 = M, 2.0 = L
  uniform float u_mode;    // 0.0 = A, 1.0 = B, 2.0 = C, 3.0 = A+, 4.0 = B+, 5.0 = C+

  // Fast luma calculation
  float luma(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  // Sobel edge detection
  float edgeIntensity(vec2 uv) {
    vec2 texel = 1.0 / u_textureSize;
    
    float tl = luma(texture2D(u_texture, uv + vec2(-texel.x, -texel.y)).rgb);
    float tm = luma(texture2D(u_texture, uv + vec2(0.0, -texel.y)).rgb);
    float tr = luma(texture2D(u_texture, uv + vec2(texel.x, -texel.y)).rgb);
    float ml = luma(texture2D(u_texture, uv + vec2(-texel.x, 0.0)).rgb);
    float mr = luma(texture2D(u_texture, uv + vec2(texel.x, 0.0)).rgb);
    float bl = luma(texture2D(u_texture, uv + vec2(-texel.x, texel.y)).rgb);
    float bm = luma(texture2D(u_texture, uv + vec2(0.0, texel.y)).rgb);
    float br = luma(texture2D(u_texture, uv + vec2(texel.x, texel.y)).rgb);
    
    float gx = -tl - 2.0 * tm - tr + bl + 2.0 * bm + br;
    float gy = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
    
    return sqrt(gx * gx + gy * gy);
  }

  // Lanczos-like sharpening
  vec3 sharpen(vec2 uv, float strength) {
    vec2 texel = 1.0 / u_textureSize;
    vec3 center = texture2D(u_texture, uv).rgb;
    
    vec3 sum = vec3(0.0);
    sum += texture2D(u_texture, uv + vec2(-texel.x, -texel.y)).rgb * -1.0;
    sum += texture2D(u_texture, uv + vec2(0.0, -texel.y)).rgb * -1.0;
    sum += texture2D(u_texture, uv + vec2(texel.x, -texel.y)).rgb * -1.0;
    sum += texture2D(u_texture, uv + vec2(-texel.x, 0.0)).rgb * -1.0;
    sum += center * 9.0;
    sum += texture2D(u_texture, uv + vec2(texel.x, 0.0)).rgb * -1.0;
    sum += texture2D(u_texture, uv + vec2(-texel.x, texel.y)).rgb * -1.0;
    sum += texture2D(u_texture, uv + vec2(0.0, texel.y)).rgb * -1.0;
    sum += texture2D(u_texture, uv + vec2(texel.x, texel.y)).rgb * -1.0;
    
    return mix(center, sum, strength);
  }

  // Bilateral-like edge preservation
  vec3 restore(vec2 uv, float strength) {
    vec2 texel = 1.0 / u_textureSize;
    vec3 center = texture2D(u_texture, uv).rgb;
    float centerLuma = luma(center);
    
    vec3 sum = vec3(0.0);
    float weightSum = 0.0;
    
    for(int x = -2; x <= 2; x++) {
      for(int y = -2; y <= 2; y++) {
        vec2 offset = vec2(float(x), float(y)) * texel;
        vec3 sample = texture2D(u_texture, uv + offset).rgb;
        float sampleLuma = luma(sample);
        
        float weight = 1.0 - abs(sampleLuma - centerLuma) * 2.0;
        weight = max(weight, 0.0);
        
        sum += sample * weight;
        weightSum += weight;
      }
    }
    
    vec3 blurred = sum / max(weightSum, 0.001);
    vec3 sharpened = center + (center - blurred) * strength;
    
    return mix(sharpened, center, 0.3);
  }

  // Mode A: Restore → Upscale
  vec3 modeA(vec2 uv) {
    vec3 restored = restore(uv, 0.5 + u_quality * 0.25);
    return sharpen(uv, 0.3 + u_quality * 0.15);
  }

  // Mode B: Restore Soft → Upscale
  vec3 modeB(vec2 uv) {
    vec3 restored = restore(uv, 0.3 + u_quality * 0.2);
    return sharpen(uv, 0.2 + u_quality * 0.1);
  }

  // Mode C: Denoise + Upscale
  vec3 modeC(vec2 uv) {
    vec3 restored = restore(uv, 0.7 + u_quality * 0.2);
    return mix(restored, sharpen(uv, 0.4), 0.5);
  }

  // Mode A+: Enhanced Restore → Upscale
  vec3 modeAPlus(vec2 uv) {
    vec3 step1 = restore(uv, 0.6);
    vec3 step2 = sharpen(uv, 0.25);
    return restore(uv, 0.4 + u_quality * 0.2) + (step2 - step1) * 0.5;
  }

  // Mode B+: Enhanced Restore Soft → Upscale
  vec3 modeBPlus(vec2 uv) {
    vec3 step1 = restore(uv, 0.35);
    vec3 step2 = sharpen(uv, 0.15);
    return restore(uv, 0.25 + u_quality * 0.15) + (step2 - step1) * 0.3;
  }

  // Mode C+: Hybrid
  vec3 modeCPlus(vec2 uv) {
    vec3 denoised = restore(uv, 0.8);
    vec3 restored = restore(uv, 0.5 + u_quality * 0.2);
    return mix(denoised, sharpen(uv, 0.35), 0.6);
  }

  void main() {
    vec3 color = texture2D(u_texture, v_texCoord).rgb;
    
    if (u_enable < 0.5) {
      gl_FragColor = vec4(color, 1.0);
      return;
    }
    
    vec3 result;
    int modeInt = int(u_mode);
    
    if (modeInt == 0) {
      result = modeA(v_texCoord);
    } else if (modeInt == 1) {
      result = modeB(v_texCoord);
    } else if (modeInt == 2) {
      result = modeC(v_texCoord);
    } else if (modeInt == 3) {
      result = modeAPlus(v_texCoord);
    } else if (modeInt == 4) {
      result = modeBPlus(v_texCoord);
    } else {
      result = modeCPlus(v_texCoord);
    }
    
    // Clamp highlights to prevent ringing
    float edge = edgeIntensity(v_texCoord);
    result = mix(result, color, clamp(edge * 2.0, 0.0, 0.3));
    
    // Ensure we don't overshoot
    result = clamp(result, 0.0, 1.0);
    
    gl_FragColor = vec4(result, 1.0);
  }
`;

export function useAnime4K(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const [state, setState] = useState<Anime4KState>(() => {
    const saved = localStorage.getItem('animira-anime4k');
    if (saved) {
      try {
        return { ...DEFAULT_STATE, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_STATE;
      }
    }
    return DEFAULT_STATE;
  });

  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationRef = useRef<number | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const framebufferRef = useRef<WebGLFramebuffer | null>(null);

  const saveState = useCallback((newState: Anime4KState) => {
    setState(newState);
    localStorage.setItem('animira-anime4k', JSON.stringify(newState));
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    saveState({ ...state, enabled });
  }, [state, saveState]);

  const setMode = useCallback((mode: Anime4KMode) => {
    saveState({ ...state, mode });
  }, [state, saveState]);

  const setQuality = useCallback((quality: Anime4KQuality) => {
    saveState({ ...state, quality });
  }, [state, saveState]);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: false,
    });
    if (!gl) {
      console.warn('WebGL not supported, Anime4K disabled');
      return;
    }

    glRef.current = gl;

    // Create shader program
    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_TEMPLATE);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    programRef.current = program;

    // Setup geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1, 1, 1, 0, 0,
      0, 0, 1, 1, 1, 0
    ]), gl.STATIC_DRAW);

    // Setup attributes
    const a_position = gl.getAttribLocation(program, 'a_position');
    const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');

    if (a_position >= 0) {
      gl.enableVertexAttribArray(a_position);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
    }

    if (a_texCoord >= 0) {
      gl.enableVertexAttribArray(a_texCoord);
      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 0, 0);
    }

    // Create texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    textureRef.current = texture;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(texCoordBuffer);
      gl.deleteTexture(texture);
    };
  }, [videoRef, canvasRef]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const gl = glRef.current;
    const program = programRef.current;
    const texture = textureRef.current;

    if (!canvas || !video || !gl || !program || !texture) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      if (gl.isContextLost()) return;

      // Resize canvas to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      // Update texture with video frame
      if (video.readyState >= 2 && video.videoWidth > 0) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      }

      gl.useProgram(program);

      // Set uniforms
      const u_enable = gl.getUniformLocation(program, 'u_enable');
      const u_quality = gl.getUniformLocation(program, 'u_quality');
      const u_mode = gl.getUniformLocation(program, 'u_mode');
      const u_textureSize = gl.getUniformLocation(program, 'u_textureSize');
      const u_texture = gl.getUniformLocation(program, 'u_texture');

      gl.uniform1f(u_enable, state.enabled ? 1.0 : 0.0);
      gl.uniform1f(u_quality, state.quality === 'S' ? 0.0 : state.quality === 'M' ? 1.0 : 2.0);
      gl.uniform1f(u_mode, ['A', 'B', 'C', 'A_PLUS', 'B_PLUS', 'C_PLUS'].indexOf(state.mode));
      gl.uniform2f(u_textureSize, canvas.width, canvas.height);
      gl.uniform1i(u_texture, 0);

      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [videoRef, canvasRef, state]);

  return {
    ...state,
    setEnabled,
    setMode,
    setQuality,
    isSupported: !!glRef.current,
  };
}
