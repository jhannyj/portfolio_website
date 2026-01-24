import {useEffect, useRef} from 'react';
import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

// DONE: fix left and right camera movement - I think it's currently not dependent on the CAMERA_LOOK_AT / its hard coded
// DONE: disable camera movement unless user is holding down middle click
// DONE: fix camera choppiness whn wave is spawning
// TODO: allow user to spawn balls by holding down left lick
// TODO: add terrain distortion on mouse hover over terrain
// TODO: clean up visual configs - some configs aren't actually used
// DONE: dont' render things behind the camera / don't make the terrain behind the camera
// TODO: make reticule larger with distance from camera
// TODO: make reticule brighter / stand out more
// TODO: make transition between "wave waiting state" to "running state" smoother
// DONE: add bias to points far away from camera
// TODO: add loss function in background
// TODO: add ability to load terrain data from drive since first seed will be manual / terrain will be the same everytime
// TODO: add cinematic load in

// ==========================================
// 🎛️ GLOBAL VISUAL CONFIGURATION (TUNED DOWN)
// ==========================================
const VISUAL_CONFIG = {
    DEBUG: {
        SHOW_BOUNDARIES: false, // Toggle this to false to hide them
        SHOW_FPS: true,
        BOUNDARY_COLOR: 0xff0000,
        BOUNDARY_OPACITY: 1.0,
        WALL_HEIGHT: 10000,
    },

    // 1. TERRAIN & MOUNTAIN RANGES
    TERRAIN: {
        WIDTH: 2000,              // The horizontal span (X-axis) of the terrain plane
        DEPTH: 2000,             // The vertical span (Z-axis) of the terrain plane
        RESOLUTION: 350,        // Mesh density: Higher = smoother detail, Lower = jagged "low-poly" look
        GLOBAL_SCALE: 0.008,     // ⬅️ THIS WAS MISSING
        HEIGHT_MULTIPLIER: 3.0,

        VARIETY: {
            MASK_SCALE: 10.0,    // 🆕 Controls how large the "different" areas are
            SHARP_INFLUENCE: 1.8, // 🆕 High power for craggy areas
            SMOOTH_INFLUENCE: 1.7 // 🆕 Low power for soft areas
        },

        // Initializing with a random value ensures every refresh is unique
        // SEED: Math.random() * 10000,
        SEED: 5520.35550386228,

        // 🏔️ AMPLITUDE CONTRAST (Octaves of Noise)
        // Frequency (FREQ): How many peaks in an area | Amplitude (AMP): How tall those peaks are
        LAYER_1: { FREQ_X: 0.41, FREQ_Z: 0.37, AMP: 26 }, // Major structural basins and massive mountain ranges
        LAYER_2: { FREQ_X: 1.23, FREQ_Z: 1.11, AMP: 6 },  // Crossed ridges that break up the primary mountain flow
        LAYER_3: { FREQ_X: 2.71, FREQ_Z: 2.43, AMP: 3 },  // Local minima "traps" (small pits that catch particles)
        LAYER_4: { FREQ_X: 4.33, FREQ_Z: 4.19, AMP: 1.5 },// High-frequency digital ripples across the surface
        DETAIL:  { FREQ: 9.17, AMP: 0.5 },                // Fine-grain surface "grit" or microscopic noise

        // 🎨 COLOR DEPTH & MATERIAL
        BASE_COLOR_RGB: { r: 0.0, g: 0.01, b: 0.03 },    // Color of the deepest valleys (Low Loss areas)
        PEAK_COLOR_OFFSET: { r: 0.6, g: 1.0, b: 0.8 },    // Color added to the peaks (High Loss areas)

        WIREFRAME_COLOR: 0x00ccaa,                        // Color of the glowing cyber-grid lines
        WIREFRAME_OPACITY: 0.07,                          // Transparency of the grid (0.0 to 1.0)
        ROUGHNESS: 0.7,                                  // Surface texture: 0.0 is shiny/glossy, 1.0 is matte
        METALNESS: 0.5,                                   // Reflectivity: Higher makes the surface look more metallic
        EMISSIVE_INTENSITY: 0.1,
        HEIGHT_INTENSITY: 8.0,
        HEIGHT_BLOOM:  10.0,
        EDGE_FADE_MARGIN: 600.0, // Increase this for a softer, more gradual disappear
    },

    WAVES: {
        FIRST_WAVE_DELAY: 1.0,    // Seconds to wait after page load before first "Inhale"
        PARTICLES_PER_WAVE: 1000,    // How many "seekers" spawn at once
        BATCH_SIZE: 20,              // Higher = faster wave, Lower = smoother FPS
        MAX_WAVE_INTERVAL: 15.0,        // seconds between waves
        SWELL_TIME: 2.0,          // Seconds BEFORE spawn the glow starts building
        MAX_SWELL_OPACITY: 0.22,   // Peak brightness at the moment of spawn
        FLASH_DECAY: 0.15,        // Speed of the fade-out after spawn
        VELOCITY_THRESHOLD: 0.001,  // Speed below which a particle is "done"
        FADE_OUT_SPEED: 0.02,       // How fast they disappear
        MIN_LIFETIME: 1.0,           // Minimum seconds to exist before they can die
        BUFFER_TIME: 1.0,          // Delay AFTER particles stop before "Swell" starts
        DISTANCE_BIAS: 4.0,  // 1.0 is neutral, 3.0 is very heavy background bias
        HORIZONTAL_CENTRAL_BIAS: 1.2, // 🆕 1.0 is uniform, > 1.0 clusters toward center
        MIN_SPAWN_HEIGHT: 0.0, // 🆕 Particles will only spawn if terrain Y > this value
    },

    // 2. CAMERA & CONTROLS
    CAMERA: {
        FOV: 55,                          // Wide angle for the terrain
        INITIAL_POS: { x: 0, y: 160, z: 300 }, // Fixed starting position
        INITIAL_YAW: 0.0,
        INITIAL_PITCH: -0.3,

        // 🆕 Intuitive Control Settings
        MOUSE_SMOOTHING: 0.05,      // Higher = snappier, Lower = more "weight"
        // 🔍 ZOOM SETTINGS
        ZOOM_STEER_STRENGTH: 0.0,

        // Sensitivity of the "Turn"
        RELATIVE_SENSITIVITY_X: 0.001,      // Turning head left/right
        RELATIVE_SENSITIVITY_Y: 0.002,      // Tilting head up/down

        LIMITS: {
            LEFT: 80,    // Max degrees to the left
            RIGHT: 80,   // Max degrees to the right
            UP: 10,      // Max degrees looking up
            DOWN: 60,     // Max degrees looking down
        }
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
        GRADIENT_MAP_RESOLUTION: 512, // Pre-computed gradient map grid size (higher = more accurate, slower build)
    },

    // 4. PARTICLES (The Optimizers)
    PARTICLES: {
        SIZE: 1.3,           // The physical radius of the descending spheres
        COLOR: 0xffffff,      // The core color of the particle (White = bright light)
        GLOW_COLOR: 0x00ffff, // The color of the outer aura and the trailing path
        STAGING_COLOR: 0x00ffcc, // Bright neon cyan/green from your screenshot
        EMISSIVE_INTENSITY: 0.2,
        TRAIL_LENGTH: 150,    // Number of points in the tail; longer = more visible history
        AMBIENT_COUNT: 0,   // Number of decorative "dust" motes floating in the air
        HEIGHT_OFFSET: 5.0, // 🆕 Keeps them floating slightly above the mesh
        SPAWN_HEIGHT_OFFSET: 2.0, // Consistent distance above the peak

        COLOR_SPEED_THRESHOLD: 0.1,            // Speed at which color is 100% "Fast"
        COLOR_INTERPOLATION_SPEED: 0.2,        // How quickly the color shifts (smoothing)

        LOSS_SCALE_SENSITIVITY: 3.0,
        MIN_LOSS_SCALE: 1.0,          // Minimum possible size multiplier
        MAX_LOSS_SCALE: 20.0,          // Maximum possible size multiplier
        REVERSE_SCALING: false,        // Set true if you want BIG loss = BIG particle
        SCALE_DISTRIBUTION_POWER: 2.5,

        REACTION: {
            MIN_GLOW: 0.0,      // Minimum brightness when stationary
            MAX_GLOW: 15.0,      // Maximum brightness at full speed
            MIN_OPACITY: 0.05,   // Minimum core visibility
            MAX_OPACITY: 1.0,   // Maximum core visibility
            SENSITIVITY: 15.0,  // How much speed affects visibility
        },

        AMBIENT_DUST: {
            COUNT: 1500,
            SIZE: 1.5,
            COLOR: 0x44aaff,
            DRIFT_SPEED: 0.2,
            MIN_HEIGHT: 150,      // 🆕 New floor for the dust
            HEIGHT_RANGE: 300,
        },
    },

    // 5. SCENE & LIGHTING
    SCENE: {
        BACKGROUND: 0x001a12,           // The color of the empty "void" and distant horizon
        LIGHT_SUN_COLOR: 0xffffff,      // Color of the primary directional light source
        LIGHT_SUN_INTENSITY: 2.5,       // Brightness of the "sun"; creates strong highlights
        LIGHT_AMBIENT_INTENSITY: 0.05,   // Base light level; prevents the shadows from being pitch black

        // Visibility Toggles
        SHADOWS_ENABLED: true,          // Toggle for dynamic shadows on the terrain slopes
        // REMOVE
        SHOW_EXTENDED_RINGS: false,      // Toggle for decorative distant terrain rings

        // Shadow Tuning
        SHADOW_BIAS: -0.0002,           // Prevents "shadow acne" (jagged lines on the mesh)
        SHADOW_NORMAL_BIAS: 0.03,       // Fine-tunes shadow positioning along the terrain curves
        FOG_DENSITY: 0.0015, // Adjust this: 0.001 is thick, 0.0005 is subtle
    },

    INTERACTION: {

    },

    BLOOM: {
        STRENGTH: 0.8,    // How intense the glow is
        RADIUS: 0.4,      // How far the light bleeds
        THRESHOLD: 0.2    // 0.0 = everything glows, 1.0 = only very bright spots glow
    },

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
    const waveStateRef = useRef('WAITING'); // 'ACTIVE', 'WAITING', 'SWELLING'
    const stateStartTimeRef = useRef(0);
    const lastWaveTimeRef = useRef(0);
    const spawnQueueRef = useRef(0); // Tracks remaining particles to spawn for current wave
    const raycasterRef = useRef(new THREE.Raycaster());
    const internalMouseRef = useRef(new THREE.Vector2());
    const gradientMapRef = useRef(null); // Pre-computed gradient map for ~90% CPU reduction
    const isMiddleClickDown = useRef(false);
    const cameraRotation = useRef({ yaw: VISUAL_CONFIG.CAMERA.INITIAL_YAW, pitch: VISUAL_CONFIG.CAMERA.INITIAL_PITCH });
    const lastMousePos = useRef({ x: 0, y: 0 });
    const fpsRef = useRef(null); // Ref for the DOM element
    const frameCountRef = useRef(0);
    const lastFrameTimeRef = useRef(0);
    const lastFpsUpdateTimeRef = useRef(0);

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

    // ==========================================
    // 🚀 GRADIENT MAP SAMPLING (Optimized)
    // Instead of calling lossFunction 5x per particle per frame,
    // we sample from a pre-computed gradient texture.
    // ==========================================
    const GRADIENT_MAP_CONFIG = {
        RESOLUTION: VISUAL_CONFIG.PHYSICS.GRADIENT_MAP_RESOLUTION, // Adjustable in VISUAL_CONFIG
        // Terrain bounds (matching VISUAL_CONFIG.TERRAIN)
        MIN_X: -VISUAL_CONFIG.TERRAIN.WIDTH / 2,
        MAX_X: VISUAL_CONFIG.TERRAIN.WIDTH / 2,
        MIN_Z: -VISUAL_CONFIG.TERRAIN.DEPTH / 2,
        MAX_Z: VISUAL_CONFIG.TERRAIN.DEPTH / 2,
    };

    // Pre-compute the gradient map (called once during initialization)
    const buildGradientMap = () => {
        const { RESOLUTION, MIN_X, MAX_X, MIN_Z, MAX_Z } = GRADIENT_MAP_CONFIG;
        const h = 0.05; // Same step size as original gradient function

        const stepX = (MAX_X - MIN_X) / (RESOLUTION - 1);
        const stepZ = (MAX_Z - MIN_Z) / (RESOLUTION - 1);

        // Create 2D arrays for dx and dz gradients
        const dxMap = new Float32Array(RESOLUTION * RESOLUTION);
        const dzMap = new Float32Array(RESOLUTION * RESOLUTION);

        for (let iz = 0; iz < RESOLUTION; iz++) {
            const z = MIN_Z + iz * stepZ;
            for (let ix = 0; ix < RESOLUTION; ix++) {
                const x = MIN_X + ix * stepX;
                const idx = iz * RESOLUTION + ix;

                // Central difference formula (same as original)
                const dx = (lossFunction(x + h, z) - lossFunction(x - h, z)) / (2 * h);
                const dz = (lossFunction(x, z + h) - lossFunction(x, z - h)) / (2 * h);

                dxMap[idx] = isFinite(dx) ? dx : 0;
                dzMap[idx] = isFinite(dz) ? dz : 0;
            }
        }

        return { dxMap, dzMap, stepX, stepZ };
    };

    // Sample gradient from pre-computed map with nearest-neighbor lookup
    const gradient = (x, z) => {
        const map = gradientMapRef.current;
        if (!map) return { dx: 0, dz: 0 };

        const { RESOLUTION, MIN_X, MAX_X, MIN_Z, MAX_Z } = GRADIENT_MAP_CONFIG;
        const { dxMap, dzMap } = map;

        // Convert world to grid space
        const gx = ((x - MIN_X) / (MAX_X - MIN_X)) * (RESOLUTION - 1);
        const gz = ((z - MIN_Z) / (MAX_Z - MIN_Z)) * (RESOLUTION - 1);

        // Get the integer coordinates of the 4 surrounding points
        const x0 = Math.floor(THREE.MathUtils.clamp(gx, 0, RESOLUTION - 2));
        const x1 = x0 + 1;
        const z0 = Math.floor(THREE.MathUtils.clamp(gz, 0, RESOLUTION - 2));
        const z1 = z0 + 1;

        // Get the fractional distance between those points
        const tx = gx - x0;
        const tz = gz - z0;

        const sample = (array) => {
            const v00 = array[z0 * RESOLUTION + x0];
            const v10 = array[z0 * RESOLUTION + x1];
            const v01 = array[z1 * RESOLUTION + x0];
            const v11 = array[z1 * RESOLUTION + x1];
            // Bilinear interpolation formula
            return (1 - tx) * (1 - tz) * v00 + tx * (1 - tz) * v10 + (1 - tx) * tz * v01 + tx * tz * v11;
        };

        return { dx: sample(dxMap), dz: sample(dzMap) };
    };

    useEffect(() => {
        if (!containerRef.current) return;

        lastFrameTimeRef.current = performance.now();
        lastFpsUpdateTimeRef.current = performance.now();

        console.log("🏔️ Terrain Seed:", VISUAL_CONFIG.TERRAIN.SEED);

        // 🚀 BUILD GRADIENT MAP (One-time precomputation for ~90% CPU reduction)
        // This replaces ~2500 lossFunction calls per frame with fast array lookups
        console.time('Gradient Map Build');
        gradientMapRef.current = buildGradientMap();
        console.timeEnd('Gradient Map Build');

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(VISUAL_CONFIG.SCENE.BACKGROUND);
        sceneRef.current = scene;

        scene.fog = new THREE.FogExp2(
            VISUAL_CONFIG.SCENE.BACKGROUND,
            VISUAL_CONFIG.SCENE.FOG_DENSITY
        );

        // 3. CAMERA & RENDERER
        const camera = new THREE.PerspectiveCamera(
            VISUAL_CONFIG.CAMERA.FOV,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            10000
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

        // 1. Setup Composer
        const renderScene = new RenderPass(scene, camera);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(containerRef.current.clientWidth, containerRef.current.clientHeight),
            VISUAL_CONFIG.BLOOM.STRENGTH,
            VISUAL_CONFIG.BLOOM.RADIUS,
            VISUAL_CONFIG.BLOOM.THRESHOLD
        );

        const composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass()); // Ensures correct colors after bloom

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
            const intensity = Math.pow(normalizedHeight, VISUAL_CONFIG.TERRAIN.HEIGHT_INTENSITY);
            const bloom = Math.pow(normalizedHeight, VISUAL_CONFIG.TERRAIN.HEIGHT_BLOOM);

            const r = Math.min(1.0, BASE_COLOR_RGB.r + (intensity * PEAK_COLOR_OFFSET.r) + bloom);
            const g = Math.min(1.0, BASE_COLOR_RGB.g + (intensity * PEAK_COLOR_OFFSET.g) + bloom);
            const b = Math.min(1.0, BASE_COLOR_RGB.b + (intensity * PEAK_COLOR_OFFSET.b) + (bloom * 0.7));

            colors.push(r, g, b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.rotateX(-Math.PI / 2);

        const applyEdgeFade = (shader) => {
            // 1. Pass the uniforms
            shader.uniforms.uTerrainWidth = { value: VISUAL_CONFIG.TERRAIN.WIDTH };
            shader.uniforms.uTerrainDepth = { value: VISUAL_CONFIG.TERRAIN.DEPTH };
            shader.uniforms.uFadeMargin = { value: VISUAL_CONFIG.TERRAIN.EDGE_FADE_MARGIN };
            shader.uniforms.uBackgroundColor = { value: new THREE.Color(VISUAL_CONFIG.SCENE.BACKGROUND) };

            // 2. Vertex Shader: Inject world position calculation
            shader.vertexShader = `varying vec3 vWorldPosition; \n` + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                 vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
            );

            // 3. Fragment Shader: Inject the mix logic
            shader.fragmentShader = `
                uniform float uTerrainWidth;
                uniform float uTerrainDepth;
                uniform float uFadeMargin;
                uniform vec3 uBackgroundColor;
                varying vec3 vWorldPosition;
            \n` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>
                float halfW = uTerrainWidth * 0.5;
                float halfD = uTerrainDepth * 0.5;
                float distX = halfW - abs(vWorldPosition.x);
                float distZ = halfD - abs(vWorldPosition.z);
                float edgeMask = smoothstep(0.0, uFadeMargin, distX) * smoothstep(0.0, uFadeMargin, distZ);
                
                // This line makes the edges blend into the background
                gl_FragColor.rgb = mix(uBackgroundColor, gl_FragColor.rgb, edgeMask);`
            );
        };

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: VISUAL_CONFIG.TERRAIN.ROUGHNESS,
            metalness: VISUAL_CONFIG.TERRAIN.METALNESS,
            emissive: 0x00ff88,
            emissiveIntensity: VISUAL_CONFIG.TERRAIN.EMISSIVE_INTENSITY,  // Reduced from 0.25 but not zero
            // No emissive here - it's baked into vertex colors now
        });

        material.onBeforeCompile = (shader) => {
            // Keep your ripple vertex logic
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `vec3 transformed = vec3(position);`
            );

            applyEdgeFade(shader);

            shader.fragmentShader = shader.fragmentShader.replace(
                'gl_FragColor.rgb = mix(uBackgroundColor, gl_FragColor.rgb, edgeMask);',
                `gl_FragColor.rgb = mix(uBackgroundColor, gl_FragColor.rgb, edgeMask);
    
                float valleyFloor = -25.0; 
                float valleyTop = 30.0; 
                if (vWorldPosition.y < valleyTop) {
                    float factor = 1.0 - smoothstep(valleyFloor, valleyTop, vWorldPosition.y);
                    vec3 valleyTint = vec3(0.0, 0.4, 0.5); 
                    gl_FragColor.rgb = mix(gl_FragColor.rgb, valleyTint, factor * 0.4);
                    gl_FragColor.rgb += valleyTint * factor * 0.05;
                }`
            );
        };

        const terrain = new THREE.Mesh(geometry, material);
        terrain.receiveShadow = VISUAL_CONFIG.SCENE.SHADOWS_ENABLED;
        scene.add(terrain);
        terrainRef.current = terrain;

        if (VISUAL_CONFIG.DEBUG.SHOW_BOUNDARIES) {
            const { WIDTH, DEPTH } = VISUAL_CONFIG.TERRAIN;
            const { BOUNDARY_COLOR, BOUNDARY_OPACITY, WALL_HEIGHT } = VISUAL_CONFIG.DEBUG;

            const wallMat = new THREE.MeshBasicMaterial({
                color: BOUNDARY_COLOR,
                transparent: true,
                opacity: BOUNDARY_OPACITY,
                side: THREE.DoubleSide,
                fog: false,
            });

            const createWall = (w, h, x, y, z, ry = 0) => {
                const geo = new THREE.PlaneGeometry(w, h);
                const mesh = new THREE.Mesh(geo, wallMat);
                mesh.position.set(x, y, z);
                mesh.rotation.y = ry;
                scene.add(mesh);
                return mesh;
            };

            const halfW = WIDTH / 2;
            const halfD = DEPTH / 2;
            const yPos = WALL_HEIGHT / 2; // Center the wall vertically

            // North, South, East, West Walls
            createWall(WIDTH, WALL_HEIGHT, 0, yPos, -halfD);          // North
            createWall(WIDTH, WALL_HEIGHT, 0, yPos, halfD);           // South
            createWall(DEPTH, WALL_HEIGHT, -halfW, yPos, 0, Math.PI/2); // West
            createWall(DEPTH, WALL_HEIGHT, halfW, yPos, 0, Math.PI/2);  // East
        }

        // --- AMBIENT DUST SYSTEM ---
        const dustCount = VISUAL_CONFIG.PARTICLES.AMBIENT_DUST.COUNT;
        const dustGeo = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(dustCount * 3);
        const dustVelocities = [];

        for (let i = 0; i < dustCount; i++) {
            // Random position across the terrain
            dustPositions[i * 3] = (Math.random() - 0.5) * VISUAL_CONFIG.TERRAIN.WIDTH;
            dustPositions[i * 3 + 1] = VISUAL_CONFIG.PARTICLES.AMBIENT_DUST.MIN_HEIGHT + (Math.random() * VISUAL_CONFIG.PARTICLES.AMBIENT_DUST.HEIGHT_RANGE);
            dustPositions[i * 3 + 2] = (Math.random() - 0.5) * VISUAL_CONFIG.TERRAIN.DEPTH;

            dustVelocities.push({
                x: (Math.random() - 0.5) * 0.1,
                y: Math.random() * 0.05,
                z: (Math.random() - 0.5) * 0.1
            });
        }

        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        const dustMat = new THREE.PointsMaterial({
            color: VISUAL_CONFIG.PARTICLES.AMBIENT_DUST.COLOR,
            size: VISUAL_CONFIG.PARTICLES.AMBIENT_DUST.SIZE,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: true,
            sizeAttenuation: true
        });

        const dustPoints = new THREE.Points(dustGeo, dustMat);
        scene.add(dustPoints);

        // WIREFRAME
        const wireframeMat = new THREE.MeshBasicMaterial({
            color: VISUAL_CONFIG.TERRAIN.WIREFRAME_COLOR,
            wireframe: true,
            transparent: true,
            opacity: VISUAL_CONFIG.TERRAIN.WIREFRAME_OPACITY,
            blending: THREE.AdditiveBlending
        });

        wireframeMat.onBeforeCompile = (shader) => {
            applyEdgeFade(shader);
        };

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

        // Outside of spawnParticle (near the top of useEffect)
        const globalParticleGeo = new THREE.SphereGeometry(VISUAL_CONFIG.PARTICLES.SIZE, 12, 12);
        const globalTrailGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(VISUAL_CONFIG.PARTICLES.TRAIL_LENGTH * 3), 3));


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
            // 3. Initialize the Trail by cloning the template
            const tGeo = globalTrailGeo.clone();
            const posAttr = tGeo.attributes.position;

            // Set all points in the trail to the initial spawn position
            for (let i = 0; i < posAttr.count; i++) {
                posAttr.setXYZ(i, x, spawnY, -z);
            }

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
            // Keep this for your Raycaster/Reticle logic
            mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            // Only update rotation if middle click is held
            if (isMiddleClickDown.current) {
                const deltaX = e.clientX - lastMousePos.current.x;
                const deltaY = e.clientY - lastMousePos.current.y;

                const { LIMITS, RELATIVE_SENSITIVITY_X, RELATIVE_SENSITIVITY_Y } = VISUAL_CONFIG.CAMERA;

                // 1. Calculate New Yaw with Limits
                const newYaw = cameraRotation.current.yaw - (deltaX * RELATIVE_SENSITIVITY_X);
                const maxLeft = -LIMITS.LEFT * (Math.PI / 180);
                const maxRight = LIMITS.RIGHT * (Math.PI / 180);
                cameraRotation.current.yaw = Math.max(maxLeft, Math.min(maxRight, newYaw));

                // 2. Calculate New Pitch with Limits
                const newPitch = cameraRotation.current.pitch - (deltaY * RELATIVE_SENSITIVITY_Y);
                const maxUp = LIMITS.UP * (Math.PI / 180);
                const maxDown = -LIMITS.DOWN * (Math.PI / 180);
                // Note: Inverted logic here because looking "Down" is usually negative pitch
                cameraRotation.current.pitch = Math.max(maxDown, Math.min(maxUp, newPitch));

                lastMousePos.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleClick = () => {
            if (reticle.visible) {
                spawnParticle(reticle.position.x, -reticle.position.z, reticle.position.y);
            }
        };

        const handleMouseDown = (e) => {
            if (e.button === 1) {
                isMiddleClickDown.current = true;
                // Record where the drag started
                lastMousePos.current = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        };

        const handleMouseUp = (e) => {
            if (e.button === 1) {
                isMiddleClickDown.current = false;
            }
        };

        containerRef.current.addEventListener('mousemove', handleMouseMove);
        containerRef.current.addEventListener('click', handleClick);
        containerRef.current.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        // 9. ANIMATION LOOP (RESTORED ZOOM & STEERING)
        let smoothMouseX = 0;
        let smoothMouseY = 0;

        // This ensures the first wave doesn't start until FIRST_WAVE_DELAY is reached
        stateStartTimeRef.current = VISUAL_CONFIG.WAVES.FIRST_WAVE_DELAY - VISUAL_CONFIG.WAVES.BUFFER_TIME;

        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const targetSpawnPoint = new THREE.Vector3(); // Reusable vector to avoid GC

        const animate = () => {
            frameIdRef.current = requestAnimationFrame(animate);

            // 1. Calculate REAL elapsed time
            const now = performance.now();
            const deltaTimeMS = now - lastFrameTimeRef.current; // Real ms elapsed
            const deltaTimeSec = deltaTimeMS / 1000;           // Real seconds elapsed
            lastFrameTimeRef.current = now;

            // 2. Update timeRef using REAL seconds (for shaders/ripples)
            timeRef.current += deltaTimeSec;
            const currentTime = timeRef.current;

            // ... (FPS counting logic) ...
            if (VISUAL_CONFIG.DEBUG.SHOW_FPS) {
                frameCountRef.current++;
                // Use the ACTUAL clock to decide when 1 second has passed
                if (now - lastFpsUpdateTimeRef.current >= 1000) {
                    if (fpsRef.current) {
                        fpsRef.current.innerText = `FPS: ${frameCountRef.current}`;
                    }
                    frameCountRef.current = 0;
                    lastFpsUpdateTimeRef.current = now;
                }
            }

            // 3. SCALE MOVEMENT
            // Instead of fixed numbers, multiply your movement constants by a scaler.
            // At 60fps, deltaTimeSec is ~0.016.
            const frameScale = deltaTimeSec / 0.0166; // 1.0 at 60fps, 2.0 at 30fps

            const { CAMERA, PHYSICS, PARTICLES, CURSOR, WAVES , TERRAIN} = VISUAL_CONFIG;

            if (spawnQueueRef.current > 0) {
                const { WIDTH, DEPTH } = VISUAL_CONFIG.TERRAIN;
                const toSpawn = Math.min(spawnQueueRef.current, WAVES.BATCH_SIZE);

                for (let i = 0; i < toSpawn; i++) {
                    let rawX = Math.random() * 2 - 1; // Start with -1 to 1

                    // Apply power bias while preserving the sign (left/right)
                    // We use Math.abs to calculate the "pull" and then restore the negative sign if needed
                    const screenX = Math.pow(Math.abs(rawX), VISUAL_CONFIG.WAVES.HORIZONTAL_CENTRAL_BIAS) * Math.sign(rawX);

                    // 2. BIASED vertical random
                    // Bias constant: > 1.0 pushes points further away (toward the horizon)
                    // Try 1.5 to 2.5 for a noticeable "epic" distance effect
                    const bias = VISUAL_CONFIG.WAVES.DISTANCE_BIAS;
                    let rawY = Math.random();

                    // This math shifts the distribution toward the top of the screen (the horizon)
                    // while maintaining the -1 to 1 range required for the raycaster
                    const biasedY = Math.pow(rawY, 1 / bias);
                    const screenY = (biasedY * 2 - 1);

                    internalMouseRef.current.set(screenX, screenY);
                    raycasterRef.current.setFromCamera(internalMouseRef.current, cameraRef.current);

                    // ... existing raycast and visibility logic ...
                    const hit = raycasterRef.current.ray.intersectPlane(groundPlane, targetSpawnPoint);

                    if (hit && Math.abs(hit.x) <= WIDTH / 2 && Math.abs(hit.z) <= DEPTH / 2) {
                        const realHeight = lossFunction(hit.x, hit.z);

                        if (realHeight < VISUAL_CONFIG.WAVES.MIN_SPAWN_HEIGHT) {
                            i--; // Decrement the loop counter to "retry" this particle at a different spot
                            continue;
                        }

                        // Optional: Visibility Check from previous solution
                        let isVisible = true;
                        const camPos = cameraRef.current.position;
                        for (let t = 0.3; t < 1.0; t += 0.3) {
                            const checkX = THREE.MathUtils.lerp(camPos.x, hit.x, t);
                            const checkZ = THREE.MathUtils.lerp(camPos.z, hit.z, t);
                            const lineOfSightHeight = THREE.MathUtils.lerp(camPos.y, realHeight, t);
                            if (lossFunction(checkX, checkZ) > lineOfSightHeight + 2.0) {
                                isVisible = false;
                                break;
                            }
                        }

                        if (isVisible) {
                            spawnParticle(hit.x, -hit.z, realHeight);

                            spawnQueueRef.current--;

                            if (spawnQueueRef.current === 0) {
                                // The very last particle has just been placed.
                                // The 30-second countdown starts NOW.
                                lastWaveTimeRef.current = performance.now() / 1000;
                            }
                        } else {
                            i--; // Retry this particle if it was hidden
                        }
                    }
                }
            }

            // DUST ANIMATION
            const dustPositionsAttr = dustPoints.geometry.attributes.position;
            for (let i = 0; i < dustCount; i++) {
                let x = dustPositionsAttr.getX(i);
                let y = dustPositionsAttr.getY(i);
                let z = dustPositionsAttr.getZ(i);

                // Apply slow drift
                y += Math.sin(timeRef.current + i) * 0.05;
                x += Math.cos(timeRef.current * 0.5 + i) * 0.02;

                // Reset if they float too high or far
                if (y > VISUAL_CONFIG.PARTICLES.AMBIENT_DUST.HEIGHT_RANGE) y = 0;

                dustPositionsAttr.setXYZ(i, x, y, z);
            }
            dustPositionsAttr.needsUpdate = true;

            // 1. ANALYZE CURRENT STATE
            const activeParticles = particlesRef.current.filter(p => !p.isFading);
            const isSpawning = spawnQueueRef.current > 0;

            const allParticlesStopped =
                !isSpawning && // 1. Must finish the queue first
                activeParticles.length > 0 && // 2. Must have particles
                activeParticles.every(p => {
                    const speed = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
                    // 3. Only count as stopped if they've had time to move (age > 100 frames)
                    return (speed < VISUAL_CONFIG.WAVES.VELOCITY_THRESHOLD && p.age > 100);
                });

            // 2. STATE MACHINE TRANSITIONS
            if (waveStateRef.current === 'ACTIVE') {
                const currentTime = performance.now() / 1000;

                // This now measures time since the LAST particle was spawned
                const waveTimedOut = (currentTime - lastWaveTimeRef.current > VISUAL_CONFIG.WAVES.MAX_WAVE_INTERVAL);

                // We only transition if we aren't spawning AND (all stopped OR timed out)
                if (spawnQueueRef.current === 0 && (allParticlesStopped || waveTimedOut)) {
                    waveStateRef.current = 'WAITING';
                    stateStartTimeRef.current = currentTime;
                    particlesRef.current.forEach(p => p.isFading = true);
                }
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

                // 🆕 This starts the "Active Timer" the moment particles are allowed to spawn
                //lastWaveTimeRef.current = currentTime;

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

            // 2. CAMERA
            // 1. Position the camera at its base
            // 1. Smooth the mouse inputs (Remove zoomRef smoothing)
            if (isMiddleClickDown.current) {
                smoothMouseX += (mouseRef.current.x - smoothMouseX) * CAMERA.MOUSE_SMOOTHING * frameScale;
                smoothMouseY += (mouseRef.current.y - smoothMouseY) * CAMERA.MOUSE_SMOOTHING * frameScale;
            }

            // 2. Camera Position (Fixed Z-axis)
            // We use the INITIAL_POS.z as the fixed distance
        const fixedZ = (TERRAIN.DEPTH / 2.0) - CAMERA.INITIAL_POS.z;

            // This provides the "slight camera movement" (leaning) you requested
            const leanX = smoothMouseX * (fixedZ * CAMERA.ZOOM_STEER_STRENGTH);
            const leanY = smoothMouseY * (fixedZ * CAMERA.ZOOM_STEER_STRENGTH);

            cameraRef.current.position.set(
                CAMERA.INITIAL_POS.x + leanX,
                CAMERA.INITIAL_POS.y + leanY,
                fixedZ
            );

// 3. Rotation Logic
// The camera body leans (Step 2) while looking at a shifting target (Step 3)
            const distance = 100;
            const targetX = cameraRef.current.position.x + distance * Math.sin(cameraRotation.current.yaw) * Math.cos(cameraRotation.current.pitch);
            const targetY = cameraRef.current.position.y + distance * Math.sin(cameraRotation.current.pitch);
            const targetZ = cameraRef.current.position.z - distance * Math.cos(cameraRotation.current.yaw) * Math.cos(cameraRotation.current.pitch);

            cameraRef.current.lookAt(targetX, targetY, targetZ);

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

                    // 1. APPLY MOMENTUM (Friction)
                    // We do NOT multiply this by frameScale. Doing so causes velocity explosion.
                    // (Optional: For perfect accuracy at low FPS, use Math.pow(MOMENTUM, frameScale))
                    p.vx *= VISUAL_CONFIG.PHYSICS.MOMENTUM;
                    p.vz *= VISUAL_CONFIG.PHYSICS.MOMENTUM;

                    // 2. APPLY GRADIENT FORCE (Acceleration)
                    // Acceleration * Time = Change in Velocity
                    p.vx -= grad.dx * VISUAL_CONFIG.PHYSICS.LEARNING_RATE * frameScale;
                    p.vz -= grad.dz * VISUAL_CONFIG.PHYSICS.LEARNING_RATE * frameScale;

                    // 3. LIMIT VELOCITY (Safety Cap)
                    // Prevents particles from tunneling through terrain if they get too fast
                    // You might not need this if the explosion is fixed, but it's good safety.
                    /* const maxSpeed = 2.0;
                    p.vx = THREE.MathUtils.clamp(p.vx, -maxSpeed, maxSpeed);
                    p.vz = THREE.MathUtils.clamp(p.vz, -maxSpeed, maxSpeed);
                    */

                    // 4. UPDATE POSITION
                    // Velocity * Time = Change in Position
                    p.x += p.vx * frameScale;
                    p.z += p.vz * frameScale;
                }

                const newY = lossFunction(p.x, p.z) + VISUAL_CONFIG.PARTICLES.HEIGHT_OFFSET;
                p.mesh.position.set(p.x, newY, -p.z);

                // 3. COLOR & SHADER UPDATES
                const speed = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
                let speedFactor = Math.min(speed / 0.15, 1.0);
                speedFactor = Math.pow(speedFactor, 1.2);

                const cActive = new THREE.Color(0x00ff88);
                const cFlash = new THREE.Color(0xffffff);

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
                const lerpSpeed = speed < 0.01 ? 0.02 : 0.1;
                    p.mesh.scale.set(
                        THREE.MathUtils.lerp(p.mesh.scale.x, finalScale, lerpSpeed),
                        THREE.MathUtils.lerp(p.mesh.scale.y, finalScale, lerpSpeed),
                        THREE.MathUtils.lerp(p.mesh.scale.z, finalScale, lerpSpeed)
                    );
                }
            }

            // 4. RETICLE
            raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
            const hits = raycasterRef.current.intersectObject(terrainRef.current);
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

            // rendererRef.current.render(sceneRef.current, cameraRef.current);
            composer.render();
        };
        animate();

        return () => {
            containerRef.current?.removeEventListener('mousemove', handleMouseMove);
            containerRef.current?.removeEventListener('click', handleClick);
            cancelAnimationFrame(frameIdRef.current);
            containerRef.current?.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            globalParticleGeo.dispose();
            globalTrailGeo.dispose();
            renderer.dispose();
        };
    }, []);

    // return <div ref={containerRef} className="loss-landscape-container" />;
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {VISUAL_CONFIG.DEBUG.SHOW_FPS && (
                <div
                    ref={fpsRef}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        color: '#00ff99', // Matches your cursor color
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        background: 'rgba(0, 0, 0, 0.5)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        pointerEvents: 'none',
                        zIndex: 100,
                        border: '1px solid #00ff9933'
                    }}
                >
                    FPS: --
                </div>
            )}
            <div ref={containerRef} className="loss-landscape-container" style={{ width: '100%', height: '100%' }} />
        </div>
    );
}

export default LossLandscape;