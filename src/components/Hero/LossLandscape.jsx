import {useEffect, useRef} from 'react';
import * as THREE from 'three';

// ==========================================
// 🎛️ GLOBAL VISUAL CONFIGURATION (TUNED DOWN)
// ==========================================
const VISUAL_CONFIG = {
    // 1. TERRAIN & MOUNTAIN RANGES
    TERRAIN: {
        WIDTH: 1600,              // The horizontal span (X-axis) of the terrain plane
        DEPTH: 1600,             // The vertical span (Z-axis) of the terrain plane
        RESOLUTION: 250,        // Mesh density: Higher = smoother detail, Lower = jagged "low-poly" look
        GLOBAL_SCALE: 0.008,     // ⬅️ THIS WAS MISSING
        HEIGHT_MULTIPLIER: 3.0,

        VARIETY: {
            MASK_SCALE: 10.0,    // 🆕 Controls how large the "different" areas are
            SHARP_INFLUENCE: 1.8, // 🆕 High power for craggy areas
            SMOOTH_INFLUENCE: 1.7 // 🆕 Low power for soft areas
        },

        // Initializing with a random value ensures every refresh is unique
        SEED: Math.random() * 10000,

        // 🏔️ AMPLITUDE CONTRAST (Octaves of Noise)
        // Frequency (FREQ): How many peaks in an area | Amplitude (AMP): How tall those peaks are
        LAYER_1: { FREQ_X: 0.41, FREQ_Z: 0.37, AMP: 26 }, // Major structural basins and massive mountain ranges
        LAYER_2: { FREQ_X: 1.23, FREQ_Z: 1.11, AMP: 6 },  // Crossed ridges that break up the primary mountain flow
        LAYER_3: { FREQ_X: 2.71, FREQ_Z: 2.43, AMP: 3 },  // Local minima "traps" (small pits that catch particles)
        LAYER_4: { FREQ_X: 4.33, FREQ_Z: 4.19, AMP: 1.5 },// High-frequency digital ripples across the surface
        DETAIL:  { FREQ: 9.17, AMP: 0.5 },                // Fine-grain surface "grit" or microscopic noise

        // 🎨 COLOR DEPTH & MATERIAL
        BASE_COLOR_RGB: { r: 0.0, g: 0.05, b: 0.03 },    // Color of the deepest valleys (Low Loss areas)
        PEAK_COLOR_OFFSET: { r: 0.1, g: 1.0, b: 0.6 },    // Color added to the peaks (High Loss areas)

        WIREFRAME_COLOR: 0x00ff88,                        // Color of the glowing cyber-grid lines
        WIREFRAME_OPACITY: 0.1,                          // Transparency of the grid (0.0 to 1.0)
        ROUGHNESS: 0.7,                                  // Surface texture: 0.0 is shiny/glossy, 1.0 is matte
        METALNESS: 0.5,                                   // Reflectivity: Higher makes the surface look more metallic
        EMISSIVE_INTENSITY: 0.1,
    },

    EXTREMA: {
        GRADIENT_THRESHOLD: 100000000000.0,     // Lower = more points detected as minima, try 200-2000
        DETECTION_SHARPNESS: 2.0,      // Higher = sharper transitions, try 1.5-3.0
        ADDITIVE_STRENGTH: 0.0,        // How bright the minima glow is (0.0-2.0)

        MINIMA_COLOR: { r: 1.0, g: 0.0, b: 0.0 },  // Bright cyan for minimas
    },

    WAVES: {
        FIRST_WAVE_DELAY: 2.0,    // Seconds to wait after page load before first "Inhale"
        PARTICLES_PER_WAVE: 500,    // How many "seekers" spawn at once
        BATCH_SIZE: 5,              // Higher = faster wave, Lower = smoother FPS
        MAX_WAVE_INTERVAL: 30.0,        // Seconds between waves
        SWELL_TIME: 3.0,          // Seconds BEFORE spawn the glow starts building
        MAX_SWELL_OPACITY: 0.4,   // Peak brightness at the moment of spawn
        FLASH_DECAY: 0.01,        // Speed of the fade-out after spawn
        VELOCITY_THRESHOLD: 0.001,  // Speed below which a particle is "done"
        FADE_OUT_SPEED: 0.02,       // How fast they disappear
        MIN_LIFETIME: 1.0,           // Minimum seconds to exist before they can die
        BUFFER_TIME: 1.5,          // Delay AFTER particles stop before "Swell" starts
    },

    // 2. CAMERA & CONTROLS
    CAMERA: {
        FOV: 55,                          // Wide angle for the terrain
        INITIAL_POS: { x: 40, y: 100, z: 50 }, // Fixed starting position
        LOOK_AT_TARGET: { x: 0, y: 20, z: 0 }, // The default point the camera looks at

        // 🆕 Intuitive Control Settings
        MOUSE_SMOOTHING: 0.06,      // Higher = snappier, Lower = more "weight"

        // 🔍 ZOOM SETTINGS
        ZOOM_SENSITIVITY: 0.05,     // How much each scroll notch moves the camera
        ZOOM_SMOOTHING: 0.1,        // Velocity of the zoom glide (0.1 = smooth)
        ZOOM_STEER_STRENGTH: 1.0,
        ZOOM_LIMITS: { MIN: 20, MAX: 150 }, // Min = closest zoom, Max = furthest zoom

        LIMITS: {
            YAW: 3.14 * 2,       // Allowed to turn 0.6 radians left and 0.6 right from target
            PITCH_UP: 3.14,  // Allowed to look 0.3 up from target
            PITCH_DOWN: 3.14 // Allowed to look 0.3 down from target
        },

        // Sensitivity of the "Turn"
        LOOK_SENSITIVITY_X: 1.2 * 2.0,      // Turning head left/right
        LOOK_SENSITIVITY_Y: 0.8 * 4.0,      // Tilting head up/down
    },

    CURSOR: {
        SIZE: 1.5,                // Diameter of the reticle
        COLOR: 0x00ff99,          // Cyan glow to match the theme
        OPACITY: 0.8,             // Transparency
        PULSE_SPEED: 2.0,         // How fast the ring breathes
        GLOW_INTENSITY: 2.0,       // Brightness of the cursor
        ALIGN_SPEED: 0.5,          // How quickly the reticle tilts to match the slope
        SURFACE_OFFSET: 0.25,      // 🆕 Increase this if you still see clipping

        // 🆕 ADAPTIVE SCALING
        DISTANCE_SCALING: 0.02,   // How much it grows with distance
        MIN_SCALE: 0.5,           // Minimum size when very close
        MAX_SCALE: 4.0            // Maximum size when very far
    },

    // 3. PHYSICS (Gradient Descent Simulation)
    PHYSICS: {
        LEARNING_RATE: 0.002, // Velocity: How fast the "optimizer" balls roll down the slopes
        MOMENTUM: 0.92,       // Inertia: Higher makes balls "slide" further and escape small pits
        MAX_AGE: 1200,        // Lifespan: Number of frames a particle exists before disappearing
    },

    // 4. PARTICLES (The Optimizers)
    PARTICLES: {
        SIZE: 1.3,           // The physical radius of the descending spheres
        COLOR: 0xffffff,      // The core color of the particle (White = bright light)
        GLOW_COLOR: 0x00ffff, // The color of the outer aura and the trailing path
        STAGING_COLOR: 0x00ffcc, // Bright neon cyan/green from your screenshot
        EMISSIVE_INTENSITY: 0.2,
        TRAIL_LENGTH: 400,    // Number of points in the tail; longer = more visible history
        AMBIENT_COUNT: 0,   // Number of decorative "dust" motes floating in the air
        HEIGHT_OFFSET: 1.5, // 🆕 Keeps them floating slightly above the mesh
        SPAWN_HEIGHT_OFFSET: 2.0, // Consistent distance above the peak

        COLOR_SPEED_THRESHOLD: 0.1,            // Speed at which color is 100% "Fast"
        COLOR_INTERPOLATION_SPEED: 0.2,        // How quickly the color shifts (smoothing)

        LOSS_SCALE_SENSITIVITY: 3.0,
        MIN_LOSS_SCALE: 0.5,          // Minimum possible size multiplier
        MAX_LOSS_SCALE: 10.0,          // Maximum possible size multiplier
        REVERSE_SCALING: false,        // Set true if you want BIG loss = BIG particle
        SCALE_DISTRIBUTION_POWER: 2.5,

        REACTION: {
            MIN_GLOW: 0.0,      // Minimum brightness when stationary
            MAX_GLOW: 15.0,      // Maximum brightness at full speed
            MIN_OPACITY: 0.05,   // Minimum core visibility
            MAX_OPACITY: 1.0,   // Maximum core visibility
            SENSITIVITY: 15.0,  // How much speed affects visibility
        }
    },

    // 5. SCENE & LIGHTING
    SCENE: {
        BACKGROUND: 0x001a12,           // The color of the empty "void" and distant horizon
        FOG_DENSITY: 0.0044,             // Atmospheric thickness: Higher makes distant peaks fade into black
        LIGHT_SUN_COLOR: 0xffffff,      // Color of the primary directional light source
        LIGHT_SUN_INTENSITY: 2.5,       // Brightness of the "sun"; creates strong highlights
        LIGHT_AMBIENT_INTENSITY: 0.3,   // Base light level; prevents the shadows from being pitch black

        // Visibility Toggles
        SHADOWS_ENABLED: true,          // Toggle for dynamic shadows on the terrain slopes
        // REMOVE
        SHOW_EXTENDED_RINGS: false,      // Toggle for decorative distant terrain rings

        // Shadow Tuning
        SHADOW_BIAS: -0.0002,           // Prevents "shadow acne" (jagged lines on the mesh)
        SHADOW_NORMAL_BIAS: 0.03,       // Fine-tunes shadow positioning along the terrain curves
    },

    INTERACTION: {
        RIPPLE_STRENGTH: 0.1,    // ⬅️ Vertical height of the wave (was ~8.0)
        RIPPLE_SPEED: 5.0,      // How fast the ring expands
        RIPPLE_FREQUENCY: 0.12,  // How many "rings" appear (Lower = fewer/wider)
        RIPPLE_DURATION: 3.0,    // How many seconds the ripple lasts
        RIPPLE_SMOOTHNESS: 100.0,
    }
};

const ParticleShader = {
    uniforms: {
        uColor: { value: new THREE.Color(0x00ff88) },
        uOpacity: { value: 1.0 },
        uGlowIntensity: { value: 1.5 }
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
            // Get normal in View Space to prevent distortion during rotation
            vNormal = normalize(normalMatrix * normal);
            
            // Calculate view direction in View Space
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-mvPosition.xyz);
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uGlowIntensity;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
            float dotProduct = dot(vNormal, vViewDir);
            
            // 1. SHARP BLACK OUTLINE
            // We use a very tight threshold. If the dot product is low, it's the edge.
            float outlineThreshold = 0.25; 
            float outline = smoothstep(outlineThreshold, outlineThreshold + 0.05, dotProduct);
            
            // 2. INNER GLOW (The "Core")
            // This creates the energy inside the black ring
            float rim = pow(1.0 - dotProduct, 2.0) * uGlowIntensity;
            
            // 3. COLOR MIX
            // Base color + rim intensity, then "multiplied" by the outline to cut the edges black
            vec3 coreColor = uColor * (0.6 + rim);
            vec3 finalColor = coreColor * outline;

            gl_FragColor = vec4(finalColor, uOpacity);
        }
    `
};

function LossLandscape() {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const terrainRef = useRef(null);
    const particlesRef = useRef([]);
    const mouseRef = useRef({ x: 0, y: 0 });
    const frameIdRef = useRef(null);
    const timeRef = useRef(0);
    const zoomRef = useRef(VISUAL_CONFIG.CAMERA.INITIAL_POS.z);
    const targetZoomRef = useRef(VISUAL_CONFIG.CAMERA.INITIAL_POS.z);
    const cameraPosRef = useRef({
        x: VISUAL_CONFIG.CAMERA.INITIAL_POS.x,
        y: VISUAL_CONFIG.CAMERA.INITIAL_POS.y
    });
    const waveStateRef = useRef('WAITING'); // 'ACTIVE', 'WAITING', 'SWELLING'
    const stateStartTimeRef = useRef(0);
    const lastWaveTimeRef = useRef(0);
    const spawnQueueRef = useRef(0); // Tracks remaining particles to spawn for current wave

    const lossFunction = (x, z) => {
        const { GLOBAL_SCALE, HEIGHT_MULTIPLIER, SEED } = VISUAL_CONFIG.TERRAIN;

        // 1. PSEUDO-RANDOM HASH
        // This replaces Sin/Cos with a deterministic "random" value
        const hash = (px, pz) => {
            let x = Math.sin((px + SEED) * 12.9898 + (pz + SEED) * 78.233) * 43758.5453123;
            return x - Math.floor(x);
        };

        // 2. INTERPOLATED NOISE
        const noise = (tx, tz) => {
            const ix = Math.floor(tx);
            const iz = Math.floor(tz);
            const fx = tx - ix;
            const fz = tz - iz;

            // Get random values for the 4 corners of the current grid cell
            const a = hash(ix, iz);
            const b = hash(ix + 1, iz);
            const c = hash(ix, iz + 1);
            const d = hash(ix + 1, iz + 1);

            // Smooth interpolation (cubic hermite)
            const ux = fx * fx * (3 - 2 * fx);
            const uz = fz * fz * (3 - 2 * fz);

            return THREE.MathUtils.lerp(a, b, ux) +
                (c - a) * uz * (1 - ux) +
                (d - b) * ux * uz;
        };

        // 3. FRACTAL BROWNIAN MOTION (fBm)
        // We stack 4-5 layers of noise at different scales
        let h = 0;
        let amp = 28.0;
        let freq = GLOBAL_SCALE * 0.5;

        for (let i = 0; i < 5; i++) {
            let n = noise(x * freq, z * freq);

            // Ridged noise math (Inverted absolute value)
            n = 1.0 - Math.abs(n * 2.0 - 1.0);

            // 🆕 UNIFORM SHARPNESS: Apply the same high power to all octaves
            // This keeps small details very jagged/pointed
            n = Math.pow(n, 3.0);

            h += n * amp;

            // 🆕 HIGH PERSISTENCE (0.55):
            // This makes the smaller details "louder" so they stand out more
            amp *= 0.55;
            freq *= 2.1;
        }

        return (h - 12) * HEIGHT_MULTIPLIER; // Offset -15 to center the height
    };

    const gradient = (x, z) => {
        const h = 0.05; // The "step" size for sampling the slope

        // 1. Check if the current point is valid
        const f0 = lossFunction(x, z);
        if (!isFinite(f0)) return { dx: 0, dz: 0 };

        // 2. Central Difference Formula: (f(x+h) - f(x-h)) / 2h
        // This is more accurate than forward difference because it balances the error
        const dx = (lossFunction(x + h, z) - lossFunction(x - h, z)) / (2 * h);
        const dz = (lossFunction(x, z + h) - lossFunction(x, z - h)) / (2 * h);

        // 3. Defensive return to prevent "Glow Bugs" or NaN crashes
        return {
            dx: isFinite(dx) ? dx : 0,
            dz: isFinite(dz) ? dz : 0
        };
    };

    useEffect(() => {
        if (!containerRef.current) return;

        // 1. INITIALIZE RIPPLE UNIFORMS FIRST (Prevents Shader Freeze)
        const rippleUniforms = {
            uRippleCenter: { value: new THREE.Vector3(0, 0, 0) },
            uRippleTime: { value: -1.0 },
        };

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(VISUAL_CONFIG.SCENE.BACKGROUND, VISUAL_CONFIG.SCENE.FOG_DENSITY);
        scene.background = new THREE.Color(VISUAL_CONFIG.SCENE.BACKGROUND);
        sceneRef.current = scene;

        // 3. CAMERA & RENDERER
        const camera = new THREE.PerspectiveCamera(
            VISUAL_CONFIG.CAMERA.FOV,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            5000
        );
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = VISUAL_CONFIG.SCENE.SHADOWS_ENABLED;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // --- SHADER WARMUP BLOCK ---
        const warmupParticle = () => {
            // 1. Mesh Warmup
            const pGeo = new THREE.SphereGeometry(0.1, 4, 4); // Tiny for speed
            const pMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
            const dummyMesh = new THREE.Mesh(pGeo, pMat);
            dummyMesh.position.set(0, -1000, 0);
            scene.add(dummyMesh);

            // 2. Trail (Line) Warmup - This fixes your "unused variable" warning
            const tGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 1, 0)
            ]);
            const tMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true });
            const dummyLine = new THREE.Line(tGeo, tMat);
            dummyLine.position.set(0, -1000, 0);
            scene.add(dummyLine);

            // 3. FORCE a render call for the entire scene
            renderer.compile(scene, camera);

            // 4. Cleanup
            scene.remove(dummyMesh, dummyLine);
            pGeo.dispose();
            tGeo.dispose();
            pMat.dispose();
            tMat.dispose();
        };
        warmupParticle();

        // 4. TERRAIN GEOMETRY & MATERIAL
        const { WIDTH, DEPTH, RESOLUTION, BASE_COLOR_RGB, PEAK_COLOR_OFFSET } = VISUAL_CONFIG.TERRAIN;
        const geometry = new THREE.PlaneGeometry(WIDTH, DEPTH, RESOLUTION - 1, RESOLUTION - 1);
        const positions = geometry.attributes.position;
        const colors = [];

        //pass 1: Discover the range
        let minH = Infinity;
        let maxH = -Infinity;
        for (let i = 0; i < positions.count; i++) {
            const h = lossFunction(positions.getX(i), positions.getY(i));
            positions.setZ(i, h);
            if (h < minH) minH = h;
            if (h > maxH) maxH = h;
        }

        const range = (maxH - minH) || 1.0;

        // Simplified Pass 2: No more minima detection here
        for (let i = 0; i < positions.count; i++) {
            const h = positions.getZ(i);
            const normalizedHeight = (h - minH) / range;

            // Standard height-based coloring
            const intensity = Math.pow(normalizedHeight, 5.0);
            const bloom = Math.pow(normalizedHeight, 15.0);

            const r = Math.min(1.0, BASE_COLOR_RGB.r + (intensity * PEAK_COLOR_OFFSET.r) + bloom);
            const g = Math.min(1.0, BASE_COLOR_RGB.g + (intensity * PEAK_COLOR_OFFSET.g) + bloom);
            const b = Math.min(1.0, BASE_COLOR_RGB.b + (intensity * PEAK_COLOR_OFFSET.b) + (bloom * 0.7));

            colors.push(r, g, b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: VISUAL_CONFIG.TERRAIN.ROUGHNESS,
            metalness: VISUAL_CONFIG.TERRAIN.METALNESS,
            emissive: 0x00ff88,
            emissiveIntensity: VISUAL_CONFIG.TERRAIN.EMISSIVE_INTENSITY,  // Reduced from 0.25 but not zero
            // No emissive here - it's baked into vertex colors now
        });

        material.onBeforeCompile = (shader) => {
            // 1. Setup Uniforms & Varyings
            shader.uniforms.uRippleCenter = rippleUniforms.uRippleCenter;
            shader.uniforms.uRippleTime = rippleUniforms.uRippleTime;
            shader.uniforms.uRippleStrength = { value: VISUAL_CONFIG.INTERACTION.RIPPLE_STRENGTH };
            shader.uniforms.uRippleFreq = { value: VISUAL_CONFIG.INTERACTION.RIPPLE_FREQUENCY };
            shader.uniforms.uRippleSpeed = { value: VISUAL_CONFIG.INTERACTION.RIPPLE_SPEED };

            // 2. Vertex Shader: Inject vWorldPosition to track actual ground height
            shader.vertexShader = `
        varying vec3 vWorldPosition;
        uniform vec3 uRippleCenter;
        uniform float uRippleTime;
        uniform float uRippleStrength;
        uniform float uRippleFreq;
        uniform float uRippleSpeed;
    ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
        #include <worldpos_vertex>
        // Capture the coordinate after the ripple math but before camera transformation
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
        vec3 vPos = position;
        float dist = distance(vPos.xz, uRippleCenter.xz);
        if (uRippleTime > 0.0) {
            float wave = sin(dist * uRippleFreq - uRippleTime * uRippleSpeed);
            float t = uRippleTime / ${VISUAL_CONFIG.INTERACTION.RIPPLE_DURATION.toFixed(1)};
            float life = 1.0 - pow(t, 3.0); 
            float ringProgress = uRippleTime * uRippleSpeed;
            float innerEdge = ringProgress - ${VISUAL_CONFIG.INTERACTION.RIPPLE_SMOOTHNESS.toFixed(1)};
            float outerEdge = ringProgress + ${VISUAL_CONFIG.INTERACTION.RIPPLE_SMOOTHNESS.toFixed(1)};
            float ringMask = smoothstep(innerEdge, ringProgress, dist) * (1.0 - smoothstep(ringProgress, outerEdge, dist));
            float distAttenuation = exp(-dist * 0.004);
            vPos.y += wave * uRippleStrength * ringMask * life * distAttenuation;
        }
        vec3 transformed = vec3(vPos);
        `
            );

            // 3. Fragment Shader: Add the "Valley Mist" based on real height
            shader.fragmentShader = `
        varying vec3 vWorldPosition;
    ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `
    #include <dithering_fragment>
    
    // 1. Setup the height thresholds
    float valleyFloor = -25.0; 
    float valleyTop = 30.0; 
    
    if (vWorldPosition.y < valleyTop) {
        // Calculate factor: 1.0 at deep bottom, 0.0 at top
        float factor = 1.0 - smoothstep(valleyFloor, valleyTop, vWorldPosition.y);
        
        // 2. Define a "Valley Tint" (Deep Electric Blue/Teal)
        vec3 valleyTint = vec3(0.0, 0.8, 0.9); 
        
        // 3. MIX the colors instead of adding them. 
        // This ensures the color change is visible even in direct sunlight.
        gl_FragColor.rgb = mix(gl_FragColor.rgb, valleyTint * 0.4, factor * 0.8);
        
        // 4. Subtle Glow: Add a tiny bit of emissive pulse so it feels "digital"
        gl_FragColor.rgb += valleyTint * factor * 0.15;
    }
    
    // --- NEW: Atmospheric Depth Cue ---
    // Calculate distance from camera to the vertex
    float dist = length(vViewPosition);
    
    // Define where the "Deep Back" starts (e.g., 800 units away)
    float hazeStart = 600.0;
    float hazeEnd = 1200.0;
    float hazeFactor = smoothstep(hazeStart, hazeEnd, dist);
    
    // Mix the current color with the background/fog color
    vec3 hazeColor = vec3(0.0, 0.06, 0.05); // A very dark teal
    gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeColor, hazeFactor * 0.9);
    
    // Safety clamp to prevent color blowout
    gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(1.1));
    `
            );
        };

        const terrain = new THREE.Mesh(geometry, material);
        terrain.receiveShadow = VISUAL_CONFIG.SCENE.SHADOWS_ENABLED;
        scene.add(terrain);
        terrainRef.current = terrain;

        // WIREFRAME
        const wireframeMat = new THREE.MeshBasicMaterial({
            color: VISUAL_CONFIG.TERRAIN.WIREFRAME_COLOR,
            wireframe: true,
            transparent: true,
            opacity: VISUAL_CONFIG.TERRAIN.WIREFRAME_OPACITY,
            blending: THREE.AdditiveBlending
        });
        const wireframe = new THREE.Mesh(geometry.clone(), wireframeMat);
        wireframe.position.y = 0.05;
        scene.add(wireframe);

        // 5. LIGHTING
        const ambientLight = new THREE.AmbientLight(0xffffff, VISUAL_CONFIG.SCENE.LIGHT_AMBIENT_INTENSITY);
        scene.add(ambientLight);
        const keyLight = new THREE.DirectionalLight(VISUAL_CONFIG.SCENE.LIGHT_SUN_COLOR, VISUAL_CONFIG.SCENE.LIGHT_SUN_INTENSITY);
        keyLight.position.set(50, 60, 40);
        keyLight.castShadow = VISUAL_CONFIG.SCENE.SHADOWS_ENABLED;
        if (keyLight.castShadow) {
            keyLight.shadow.bias = VISUAL_CONFIG.SCENE.SHADOW_BIAS;
            keyLight.shadow.normalBias = VISUAL_CONFIG.SCENE.SHADOW_NORMAL_BIAS;
        }
        scene.add(keyLight);

        // BACKLIGHT
        const backLight = new THREE.DirectionalLight(0x00ffcc, 0.5);
        // Position it far behind the terrain, pointing back toward the camera
        backLight.position.set(0, 50, -1000);
        scene.add(backLight);

        // 6. RETICLE (CURSOR)
        const reticleGeo = new THREE.RingGeometry(VISUAL_CONFIG.CURSOR.SIZE * 0.7, VISUAL_CONFIG.CURSOR.SIZE, 32);
        const reticleMat = new THREE.MeshBasicMaterial({
            color: VISUAL_CONFIG.CURSOR.COLOR,
            transparent: true,
            opacity: VISUAL_CONFIG.CURSOR.OPACITY,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const reticle = new THREE.Mesh(reticleGeo, reticleMat);
        reticle.rotation.x = -Math.PI / 2;
        scene.add(reticle);

        const raycaster = new THREE.Raycaster();

        // Outside of spawnParticle (near the top of useEffect)
        const globalParticleGeo = new THREE.SphereGeometry(VISUAL_CONFIG.PARTICLES.SIZE, 12, 12);

        // 7. PARTICLE SPAWNING
        const spawnParticle = (x, z, overrideY = null) => {
            const groundHeight = overrideY !== null ? overrideY : lossFunction(x, z);
            const spawnY = groundHeight + VISUAL_CONFIG.PARTICLES.SPAWN_HEIGHT_OFFSET;

            // Use ShaderMaterial for the "Border/Rim" effect
            const pMat = new THREE.ShaderMaterial({
                uniforms: THREE.UniformsUtils.clone(ParticleShader.uniforms),
                vertexShader: ParticleShader.vertexShader,
                fragmentShader: ParticleShader.fragmentShader,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const mesh = new THREE.Mesh(globalParticleGeo, pMat);
            mesh.position.set(x, spawnY, -z);
            mesh.castShadow = VISUAL_CONFIG.SCENE.SHADOWS_ENABLED;

            // 3. Initialize the Trail
            const trailPositions = new Float32Array(VISUAL_CONFIG.PARTICLES.TRAIL_LENGTH * 3);
            for(let i = 0; i < trailPositions.length; i += 3) {
                trailPositions[i] = x;
                trailPositions[i+1] = spawnY;
                trailPositions[i+2] = -z;
            }

            const tGeo = new THREE.BufferGeometry();
            tGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
            const tMat = new THREE.LineBasicMaterial({
                color: VISUAL_CONFIG.PARTICLES.GLOW_COLOR,
                transparent: true,
                opacity: 0.8,
            });
            const trail = new THREE.Line(tGeo, tMat);

            sceneRef.current.add(mesh, trail);
            particlesRef.current.push({ mesh, trail, x, z, vx: 0, vz: 0, age: 0, isFading: false });
        };

        // 8. EVENT LISTENERS
        const handleMouseMove = (e) => {
            const rect = containerRef.current.getBoundingClientRect();
            mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        };

        const handleClick = () => {
            if (reticle.visible) {
                console.log('Reticle pos:', reticle.position.x, reticle.position.y, reticle.position.z);
                console.log('LossFunc at reticle:', lossFunction(reticle.position.x, -reticle.position.z));
                spawnParticle(reticle.position.x, -reticle.position.z, reticle.position.y);
                rippleUniforms.uRippleCenter.value.copy(reticle.position);
                rippleUniforms.uRippleTime.value = 0.0;
            }
        };

        const handleWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const { ZOOM_SENSITIVITY, ZOOM_LIMITS } = VISUAL_CONFIG.CAMERA;
                targetZoomRef.current = THREE.MathUtils.clamp(
                    targetZoomRef.current + e.deltaY * ZOOM_SENSITIVITY,
                    ZOOM_LIMITS.MIN,
                    ZOOM_LIMITS.MAX
                );
            }
        };

        containerRef.current.addEventListener('mousemove', handleMouseMove);
        containerRef.current.addEventListener('click', handleClick);
        containerRef.current.addEventListener('wheel', handleWheel, { passive: false });

        // WAVE
        // Deprecated: all particles at the same time
        // const spawnWave = () => {
        //     const { PARTICLES_PER_WAVE } = VISUAL_CONFIG.WAVES;
        //     const raycaster = new THREE.Raycaster();
        //
        //     let spawned = 0;
        //     let attempts = 0;
        //
        //     // We keep trying until we hit the exact PARTICLES_PER_WAVE count
        //     while (spawned < PARTICLES_PER_WAVE && attempts < PARTICLES_PER_WAVE * 3) {
        //         attempts++;
        //
        //         // 1. Pick a random 2D coordinate on the screen (-1 to +1)
        //         const screenX = (Math.random() * 2 - 1);
        //         const screenY = (Math.random() * 2 - 1);
        //
        //         // 2. Point the raycaster from the camera through this screen point
        //         raycaster.setFromCamera({ x: screenX, y: screenY }, cameraRef.current);
        //
        //         // 3. Find where it hits the terrain
        //         const intersects = raycaster.intersectObject(terrainRef.current);
        //
        //         if (intersects.length > 0) {
        //             const hit = intersects[0].point;
        //
        //             // 4. Extract coordinates
        //             // Note: terrain is rotated, so hit.z is world space.
        //             // Our spawnParticle expects internal 'z' which we established as -hit.z
        //             spawnParticle(hit.x, -hit.z, hit.y);
        //             spawned++;
        //         }
        //     }
        // };

        // 9. ANIMATION LOOP (RESTORED ZOOM & STEERING)
        let smoothMouseX = 0;
        let smoothMouseY = 0;

        // This ensures the first wave doesn't start until FIRST_WAVE_DELAY is reached
        stateStartTimeRef.current = VISUAL_CONFIG.WAVES.FIRST_WAVE_DELAY - VISUAL_CONFIG.WAVES.BUFFER_TIME;

        const animate = () => {
            frameIdRef.current = requestAnimationFrame(animate);
            timeRef.current += 0.016;
            const currentTime = timeRef.current;

            const { CAMERA, PHYSICS, PARTICLES, CURSOR, WAVES , TERRAIN} = VISUAL_CONFIG;

            if (spawnQueueRef.current > 0) {
                const toSpawn = Math.min(spawnQueueRef.current, WAVES.BATCH_SIZE);
                const raycaster = new THREE.Raycaster();

                for (let i = 0; i < toSpawn; i++) {
                    const screenX = (Math.random() * 2 - 1);
                    const screenY = (Math.random() * 2 - 1);
                    raycaster.setFromCamera({ x: screenX, y: screenY }, cameraRef.current);
                    const intersects = raycaster.intersectObject(terrainRef.current);
                    if (intersects.length > 0) {
                        const hit = intersects[0].point;
                        spawnParticle(hit.x, -hit.z, hit.y);
                    }
                }
                spawnQueueRef.current -= toSpawn;
            }

            // 1. ANALYZE CURRENT STATE
            const activeParticles = particlesRef.current.filter(p => !p.isFading);
            const allParticlesStopped = activeParticles.length > 0 && activeParticles.every(p => {
                const speed = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
                return speed < WAVES.VELOCITY_THRESHOLD && p.age > 120;
            });

            // 2. STATE MACHINE TRANSITIONS
            if (waveStateRef.current === 'ACTIVE' && (allParticlesStopped || currentTime - lastWaveTimeRef.current > WAVES.MAX_WAVE_INTERVAL)) {
                // Particles have settled. Start the Buffer/Cooldown phase.
                waveStateRef.current = 'WAITING';
                stateStartTimeRef.current = currentTime;
                particlesRef.current.forEach(p => p.isFading = true);
            }

            if (waveStateRef.current === 'WAITING' && (currentTime - stateStartTimeRef.current > WAVES.BUFFER_TIME)) {
                // Buffer over. Start the "Inhale" (Swell).
                waveStateRef.current = 'SWELLING';
                stateStartTimeRef.current = currentTime;
            }

            if (waveStateRef.current === 'SWELLING' && (currentTime - stateStartTimeRef.current > WAVES.SWELL_TIME)) {
                // Inhale complete. Release the particles!
                spawnQueueRef.current = VISUAL_CONFIG.WAVES.PARTICLES_PER_WAVE;
                waveStateRef.current = 'ACTIVE';
                lastWaveTimeRef.current = currentTime;
                // Set exactly at peak to ensure the handoff to decay is clean
                wireframe.material.opacity = WAVES.MAX_SWELL_OPACITY;
            }

            // 3. OPACITY SYNC (The "Inhale" and "Exhale")
            if (waveStateRef.current === 'SWELLING') {
                // Building up from base to max
                const progress = (currentTime - stateStartTimeRef.current) / WAVES.SWELL_TIME;
                const eased = Math.pow(progress, 2.0);
                wireframe.material.opacity = THREE.MathUtils.lerp(TERRAIN.WIREFRAME_OPACITY, WAVES.MAX_SWELL_OPACITY, eased);
            } else {
                // Normalizing back to base (The "Exhale")
                if (wireframe.material.opacity > TERRAIN.WIREFRAME_OPACITY) {
                    wireframe.material.opacity -= (wireframe.material.opacity - TERRAIN.WIREFRAME_OPACITY) * WAVES.FLASH_DECAY;
                }
            }



            // 2. CAMERA & ZOOM
            smoothMouseX += (mouseRef.current.x - smoothMouseX) * CAMERA.MOUSE_SMOOTHING;
            smoothMouseY += (mouseRef.current.y - smoothMouseY) * CAMERA.MOUSE_SMOOTHING;
            zoomRef.current += (targetZoomRef.current - zoomRef.current) * CAMERA.ZOOM_SMOOTHING;

            const zoomProgress = (CAMERA.INITIAL_POS.z - zoomRef.current) * CAMERA.ZOOM_STEER_STRENGTH;
            cameraPosRef.current.x += (CAMERA.INITIAL_POS.x + (smoothMouseX * zoomProgress) - cameraPosRef.current.x) * CAMERA.ZOOM_SMOOTHING;
            cameraPosRef.current.y += (CAMERA.INITIAL_POS.y + (smoothMouseY * zoomProgress) - cameraPosRef.current.y) * CAMERA.ZOOM_SMOOTHING;

            cameraRef.current.position.set(cameraPosRef.current.x, cameraPosRef.current.y, zoomRef.current);
            cameraRef.current.lookAt(
                CAMERA.LOOK_AT_TARGET.x + (smoothMouseX * CAMERA.LOOK_SENSITIVITY_X * 50),
                CAMERA.LOOK_AT_TARGET.y + (smoothMouseY * CAMERA.LOOK_SENSITIVITY_Y * 30),
                CAMERA.LOOK_AT_TARGET.z
            );

            // Inside the for-loop in animate():
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];
                p.age++;

                // 1. SHRINK & FADE LOGIC
                if (p.isFading) {
                    // Shrink the particle mesh
                    p.mesh.scale.multiplyScalar(1.0 - VISUAL_CONFIG.WAVES.FADE_OUT_SPEED);

                    // Shrink the trail by pulling the tail toward the head
                    const posAttr = p.trail.geometry.attributes.position;
                    for (let j = posAttr.count - 1; j > 0; j--) {
                        // Lerp each point toward the point ahead of it
                        const currX = posAttr.getX(j);
                        const currY = posAttr.getY(j);
                        const currZ = posAttr.getZ(j);

                        const nextX = posAttr.getX(j - 1);
                        const nextY = posAttr.getY(j - 1);
                        const nextZ = posAttr.getZ(j - 1);

                        // The 0.15 factor determines how "snappy" the trail shrinks
                        posAttr.setXYZ(
                            j,
                            currX + (nextX - currX) * 0.15,
                            currY + (nextY - currY) * 0.15,
                            currZ + (nextZ - currZ) * 0.15
                        );
                    }
                    posAttr.needsUpdate = true;

                    // Fade out the trail opacity
                    p.trail.material.opacity *= (1.0 - VISUAL_CONFIG.WAVES.FADE_OUT_SPEED);

                    // Remove from scene when nearly invisible
                    if (p.mesh.scale.x < 0.01) {
                        sceneRef.current.remove(p.mesh, p.trail);
                        p.mesh.geometry.dispose();
                        p.mesh.material.dispose();
                        p.trail.geometry.dispose();
                        p.trail.material.dispose();
                        particlesRef.current.splice(i, 1);
                        continue;
                    }
                }

                // 2. PHYSICS & MOVEMENT (Only move if not fading or move slightly)
                if (!p.isFading && spawnQueueRef.current === 0) {
                    const grad = gradient(p.x, p.z);
                    p.vx = p.vx * VISUAL_CONFIG.PHYSICS.MOMENTUM - grad.dx * VISUAL_CONFIG.PHYSICS.LEARNING_RATE;
                    p.vz = p.vz * VISUAL_CONFIG.PHYSICS.MOMENTUM - grad.dz * VISUAL_CONFIG.PHYSICS.LEARNING_RATE;
                    p.x += p.vx;
                    p.z += p.vz;
                }

                const newY = lossFunction(p.x, p.z) + VISUAL_CONFIG.PARTICLES.HEIGHT_OFFSET;
                p.mesh.position.set(p.x, newY, -p.z);

                // 3. COLOR & SHADER UPDATES
                const speed = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
                let speedFactor = Math.min(speed / 0.15, 1.0);
                speedFactor = Math.pow(speedFactor, 1.2);

                const cActive = new THREE.Color(0x00ff88);
                const cFlash = new THREE.Color(0xffffff);

                const reactionFactor = Math.min(1.0, speed * PARTICLES.REACTION.SENSITIVITY);

                // --- VISIBILITY LOGIC ---
                if (p.isFading) {
                    p.mesh.material.uniforms.uGlowIntensity.value *= (1.0 - WAVES.FADE_OUT_SPEED);
                    p.mesh.material.uniforms.uOpacity.value *= (1.0 - WAVES.FADE_OUT_SPEED);
                } else if (spawnQueueRef.current > 0) {
                    // STAGING PHASE: Force high visibility and specific color
                    p.mesh.material.uniforms.uGlowIntensity.value = 2.5; // High constant glow
                    p.mesh.material.uniforms.uOpacity.value = 1.0;      // Fully opaque
                    p.mesh.material.uniforms.uColor.value.setHex(PARTICLES.STAGING_COLOR);

                    // Keep trail color synced while waiting
                    p.trail.material.color.setHex(PARTICLES.STAGING_COLOR);
                    p.trail.material.opacity = 0.8;
                } else {
                    // ACTIVE PHASE: Normal speed-based updates
                    const reactionFactor = Math.min(1.0, speed * PARTICLES.REACTION.SENSITIVITY);
                    p.mesh.material.uniforms.uGlowIntensity.value = THREE.MathUtils.lerp(
                        PARTICLES.REACTION.MIN_GLOW,
                        PARTICLES.REACTION.MAX_GLOW,
                        reactionFactor
                    );
                    p.mesh.material.uniforms.uOpacity.value = THREE.MathUtils.lerp(
                        PARTICLES.REACTION.MIN_OPACITY,
                        PARTICLES.REACTION.MAX_OPACITY,
                        reactionFactor
                    );

                    // Normal color lerping
                    p.mesh.material.uniforms.uColor.value.lerpColors(cActive, cFlash, speedFactor);
                    p.trail.material.color.lerpColors(cActive, cFlash, speedFactor);
                }

                // 4. TRAIL BUFFER UPDATE (Normal movement)
                if (!p.isFading && spawnQueueRef.current === 0) {
                    const posAttr = p.trail.geometry.attributes.position;
                    for (let j = posAttr.count - 1; j > 0; j--) {
                        posAttr.setXYZ(j, posAttr.getX(j - 1), posAttr.getY(j - 1), posAttr.getZ(j - 1));
                    }
                    posAttr.setXYZ(0, p.x, newY, -p.z);
                    posAttr.needsUpdate = true;

                    p.trail.material.color.lerpColors(cActive, cFlash, speedFactor);
                    p.mesh.material.uniforms.uColor.value.lerpColors(cActive, cFlash, speedFactor); // ← ADD THIS
                } else if (!p.isFading && spawnQueueRef.current > 0) {
                    // STAGING: Keep trail points locked to current position so it doesn't "stretch" from the origin
                    const posAttr = p.trail.geometry.attributes.position;
                    for (let j = 0; j < posAttr.count; j++) {
                        posAttr.setXYZ(j, p.x, newY, -p.z);
                    }
                    posAttr.needsUpdate = true;
                }

                // 1. Get the height-based scale factor
                // We assume a typical terrain range. You can also track global min/max heights.
                const currentHeight = newY;
                const heightRange = 60; // Approximate height difference between peaks and valleys
                const normalizedLoss = THREE.MathUtils.clamp((currentHeight + 20) / heightRange, 0, 1);

                // 2. Calculate Loss Scale
                // 2. Calculate Loss Scale - true proportional scaling with emphasis
                const emphasisPower = PARTICLES.SCALE_DISTRIBUTION_POWER; // ← Adjust this: higher = more extreme differences (try 2-4)

                let lossScaleFactor;
                if (PARTICLES.REVERSE_SCALING) {
                    // High loss (peaks) = bigger particles
                    lossScaleFactor = 1.0 + Math.pow(normalizedLoss, emphasisPower) * PARTICLES.LOSS_SCALE_SENSITIVITY;
                } else {
                    // Low loss (valleys) = bigger particles
                    lossScaleFactor = 1.0 + Math.pow(1.0 - normalizedLoss, emphasisPower) * PARTICLES.LOSS_SCALE_SENSITIVITY;
                }

// MIN and MAX act as true caps/limits
                lossScaleFactor = THREE.MathUtils.clamp(lossScaleFactor, PARTICLES.MIN_LOSS_SCALE, PARTICLES.MAX_LOSS_SCALE);

                // 3. Combine with Speed and Fading scale
                // speedFactor was calculated earlier for colors
                const baseScale = 1.0 + (speedFactor * 0.5);
                let finalScale = baseScale * lossScaleFactor;

                // Apply fading shrink if necessary
                if (p.isFading) {
                    p.mesh.scale.multiplyScalar(1.0 - VISUAL_CONFIG.WAVES.FADE_OUT_SPEED);
                } else {
                    // Apply the calculated size smoothly
                    const lerpSpeed = 0.1;
                    p.mesh.scale.set(
                        THREE.MathUtils.lerp(p.mesh.scale.x, finalScale, lerpSpeed),
                        THREE.MathUtils.lerp(p.mesh.scale.y, finalScale, lerpSpeed),
                        THREE.MathUtils.lerp(p.mesh.scale.z, finalScale, lerpSpeed)
                    );
                }
            }

            // 4. RIPPLE & RETICLE
            if (rippleUniforms.uRippleTime.value >= 0) {
                rippleUniforms.uRippleTime.value += 0.016;
                if (rippleUniforms.uRippleTime.value > VISUAL_CONFIG.INTERACTION.RIPPLE_DURATION) rippleUniforms.uRippleTime.value = -1;
            }

            raycaster.setFromCamera(mouseRef.current, cameraRef.current);
            const hits = raycaster.intersectObject(terrainRef.current);
            if (hits.length > 0) {
                const hit = hits[0];
                reticle.position.copy(hit.point).add(hit.face.normal.multiplyScalar(CURSOR.SURFACE_OFFSET));
                reticle.visible = true;
                const dummy = new THREE.Object3D();
                dummy.position.copy(reticle.position);
                dummy.lookAt(new THREE.Vector3().addVectors(reticle.position, hit.face.normal));
                reticle.quaternion.slerp(dummy.quaternion, CURSOR.ALIGN_SPEED);
            } else {
                reticle.visible = false;
            }

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        animate();

        return () => {
            containerRef.current?.removeEventListener('mousemove', handleMouseMove);
            containerRef.current?.removeEventListener('click', handleClick);
            containerRef.current?.removeEventListener('wheel', handleWheel);
            cancelAnimationFrame(frameIdRef.current);
            renderer.dispose();
        };
    }, []);

    return <div ref={containerRef} className="loss-landscape-container" />;
}

export default LossLandscape;