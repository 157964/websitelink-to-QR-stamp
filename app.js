/**
 * QR Stamp Maker — Main Application
 * Generates QR codes and exports mirrored 3D stamp models (OBJ & STL)
 * Includes interactive 3D preview using Three.js
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(function () {
    'use strict';

    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const generateBtn = document.getElementById('generateBtn');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step3dPreview = document.getElementById('step3dPreview');
    const qrNormalCanvas = document.getElementById('qrNormal');
    const qrMirroredCanvas = document.getElementById('qrMirrored');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadStlBtn = document.getElementById('downloadStlBtn');
    const preview3dCanvas = document.getElementById('preview3d');
    const preview3dHint = document.getElementById('preview3dHint');

    // Settings
    const stampSizeInput = document.getElementById('stampSize');
    const moduleHeightInput = document.getElementById('moduleHeight');
    const baseHeightInput = document.getElementById('baseHeight');
    const borderModulesInput = document.getElementById('borderModules');
    const stampSizeVal = document.getElementById('stampSizeVal');
    const moduleHeightVal = document.getElementById('moduleHeightVal');
    const baseHeightVal = document.getElementById('baseHeightVal');
    const borderModulesVal = document.getElementById('borderModulesVal');
    const stampDimensions = document.getElementById('stampDimensions');

    let currentQR = null;

    // ==========================================
    // Three.js 3D Preview
    // ==========================================

    let renderer, scene, camera, controls, stampGroup;
    let animationId = null;
    let threeInitialized = false;

    function initThree() {
        if (threeInitialized) return;
        threeInitialized = true;

        const wrapper = preview3dCanvas.parentElement;
        const width = wrapper.clientWidth;
        const height = wrapper.clientHeight;

        // Renderer
        renderer = new THREE.WebGLRenderer({
            canvas: preview3dCanvas,
            antialias: true,
            alpha: true
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        // Scene
        scene = new THREE.Scene();

        // Camera
        camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
        camera.position.set(50, 35, 50);

        // Controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.5;
        controls.minDistance = 15;
        controls.maxDistance = 200;
        controls.target.set(0, 0, 0);

        // Hide hint on first interaction
        let hintHidden = false;
        controls.addEventListener('start', () => {
            if (!hintHidden) {
                hintHidden = true;
                preview3dHint.classList.add('hidden');
            }
            controls.autoRotate = false;
        });

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x8888aa, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
        dirLight.position.set(30, 50, 30);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 1;
        dirLight.shadow.camera.far = 200;
        dirLight.shadow.camera.left = -60;
        dirLight.shadow.camera.right = 60;
        dirLight.shadow.camera.top = 60;
        dirLight.shadow.camera.bottom = -60;
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x818cf8, 0.4);
        fillLight.position.set(-20, 10, -20);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xc084fc, 0.3);
        rimLight.position.set(0, -10, 30);
        scene.add(rimLight);

        // Subtle ground plane for shadow
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        scene.add(ground);

        // Stamp group
        stampGroup = new THREE.Group();
        scene.add(stampGroup);

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            const w = wrapper.clientWidth;
            const h = wrapper.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });
        resizeObserver.observe(wrapper);

        // Animate
        function animate() {
            animationId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();
    }

    function build3DStamp() {
        if (!currentQR || !threeInitialized) return;

        // Clear previous stamp
        while (stampGroup.children.length > 0) {
            const child = stampGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            stampGroup.remove(child);
        }

        const qrMatrix = currentQR.matrix;
        const qrSize = currentQR.size;
        const border = parseInt(borderModulesInput.value);
        const totalModules = qrSize + border * 2;
        const stampSizeMM = parseFloat(stampSizeInput.value);
        const moduleHeightMM = parseFloat(moduleHeightInput.value);
        const baseHeightMM = parseFloat(baseHeightInput.value);
        const moduleSizeMM = stampSizeMM / totalModules;

        // Materials
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a3a,
            roughness: 0.35,
            metalness: 0.1,
        });

        const moduleMaterial = new THREE.MeshStandardMaterial({
            color: 0x818cf8,
            roughness: 0.25,
            metalness: 0.15,
        });

        const handleMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3a4a,
            roughness: 0.4,
            metalness: 0.05,
        });

        // Base plate
        const baseGeo = new THREE.BoxGeometry(stampSizeMM, baseHeightMM, stampSizeMM);
        const baseMesh = new THREE.Mesh(baseGeo, baseMaterial);
        baseMesh.position.set(stampSizeMM / 2, baseHeightMM / 2, stampSizeMM / 2);
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        stampGroup.add(baseMesh);

        // Merge all QR modules into a single geometry for performance
        const moduleGeoTemplate = new THREE.BoxGeometry(moduleSizeMM, moduleHeightMM, moduleSizeMM);
        const mergedModules = new THREE.InstancedMesh(
            moduleGeoTemplate,
            moduleMaterial,
            qrMatrix.flat().filter(Boolean).length
        );
        mergedModules.castShadow = true;
        mergedModules.receiveShadow = true;

        const dummy = new THREE.Object3D();
        let instanceIdx = 0;

        for (let r = 0; r < qrSize; r++) {
            for (let c = 0; c < qrSize; c++) {
                if (!qrMatrix[r][c]) continue;

                // Mirror horizontally for stamp
                const mirroredC = qrSize - 1 - c;

                const x = (mirroredC + border) * moduleSizeMM + moduleSizeMM / 2;
                const y = baseHeightMM + moduleHeightMM / 2;
                const z = (r + border) * moduleSizeMM + moduleSizeMM / 2;

                dummy.position.set(x, y, z);
                dummy.updateMatrix();
                mergedModules.setMatrixAt(instanceIdx, dummy.matrix);
                instanceIdx++;
            }
        }
        mergedModules.instanceMatrix.needsUpdate = true;
        stampGroup.add(mergedModules);

        // Handle (cylinder on the bottom / back side)
        const handleRadius = stampSizeMM * 0.15;
        const handleHeight = stampSizeMM * 0.4;
        const handleGeo = new THREE.CylinderGeometry(handleRadius, handleRadius, handleHeight, 24);
        const handleMesh = new THREE.Mesh(handleGeo, handleMaterial);
        handleMesh.position.set(stampSizeMM / 2, -handleHeight / 2, stampSizeMM / 2);
        handleMesh.castShadow = true;
        stampGroup.add(handleMesh);

        // Handle top cap (rounded)
        const capGeo = new THREE.SphereGeometry(handleRadius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const capMesh = new THREE.Mesh(capGeo, handleMaterial);
        capMesh.position.set(stampSizeMM / 2, -handleHeight, stampSizeMM / 2);
        capMesh.rotation.x = Math.PI;
        capMesh.castShadow = true;
        stampGroup.add(capMesh);

        // Center the group
        const box = new THREE.Box3().setFromObject(stampGroup);
        const center = box.getCenter(new THREE.Vector3());
        stampGroup.position.sub(center);
        stampGroup.position.y += (box.max.y - box.min.y) / 2;

        // Adjust camera distance based on stamp size
        const maxDim = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
        const dist = maxDim * 1.8;
        camera.position.set(dist * 0.7, dist * 0.5, dist * 0.7);
        controls.target.set(0, (box.max.y - box.min.y) * 0.15, 0);
        controls.update();
    }

    // ==========================================
    // QR Code Rendering
    // ==========================================

    function drawQR(canvas, qrMatrix, mirrored = false) {
        const ctx = canvas.getContext('2d');
        const size = qrMatrix.length;
        const border = parseInt(borderModulesInput.value);
        const totalSize = size + border * 2;
        const cellSize = canvas.width / totalSize;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#1a1a2e';
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (qrMatrix[r][c]) {
                    const drawCol = mirrored ? (size - 1 - c) : c;
                    const x = (drawCol + border) * cellSize;
                    const y = (r + border) * cellSize;
                    ctx.fillRect(x, y, cellSize + 0.5, cellSize + 0.5);
                }
            }
        }
    }

    function updatePreviews() {
        if (!currentQR) return;
        drawQR(qrNormalCanvas, currentQR.matrix, false);
        drawQR(qrMirroredCanvas, currentQR.matrix, true);
        updateDimensions();
        build3DStamp();
    }

    function updateDimensions() {
        if (!currentQR) return;
        const border = parseInt(borderModulesInput.value);
        const totalModules = currentQR.size + border * 2;
        const stampSize = parseFloat(stampSizeInput.value);
        const moduleSize = (stampSize / totalModules).toFixed(2);
        const totalHeight = (parseFloat(baseHeightInput.value) + parseFloat(moduleHeightInput.value)).toFixed(1);
        stampDimensions.textContent =
            `${stampSize}×${stampSize}×${totalHeight} mm — ${totalModules}×${totalModules} modules — ${moduleSize} mm/module`;
    }

    // ==========================================
    // 3D OBJ Generation
    // ==========================================

    function generateOBJ() {
        if (!currentQR) return null;

        const qrMatrix = currentQR.matrix;
        const qrSize = currentQR.size;
        const border = parseInt(borderModulesInput.value);
        const totalModules = qrSize + border * 2;
        const stampSizeMM = parseFloat(stampSizeInput.value);
        const moduleHeightMM = parseFloat(moduleHeightInput.value);
        const baseHeightMM = parseFloat(baseHeightInput.value);
        const moduleSizeMM = stampSizeMM / totalModules;

        const vertices = [];
        const faces = [];
        let vi = 1; // OBJ indices are 1-based

        function addVertex(x, y, z) {
            vertices.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
            return vi++;
        }

        function addQuad(a, b, c, d) {
            // Two triangles: a-b-c, a-c-d
            faces.push(`f ${a} ${b} ${c}`);
            faces.push(`f ${a} ${c} ${d}`);
        }

        // Create base plate: a flat box from (0,0,0) to (stampSize, stampSize, baseHeight)
        const S = stampSizeMM;
        const BH = baseHeightMM;

        // Base bottom face (z=0)
        const bb1 = addVertex(0, 0, 0);
        const bb2 = addVertex(S, 0, 0);
        const bb3 = addVertex(S, S, 0);
        const bb4 = addVertex(0, S, 0);
        addQuad(bb1, bb4, bb3, bb2); // facing down

        // Base top face (z=baseHeight) — we'll add module boxes on top of this
        const bt1 = addVertex(0, 0, BH);
        const bt2 = addVertex(S, 0, BH);
        const bt3 = addVertex(S, S, BH);
        const bt4 = addVertex(0, S, BH);
        addQuad(bt1, bt2, bt3, bt4); // facing up

        // Base side faces
        addQuad(bb1, bb2, bt2, bt1); // front
        addQuad(bb2, bb3, bt3, bt2); // right
        addQuad(bb3, bb4, bt4, bt3); // back
        addQuad(bb4, bb1, bt1, bt4); // left

        // Add raised modules (mirrored for stamp)
        const topZ = BH + moduleHeightMM;

        for (let r = 0; r < qrSize; r++) {
            for (let c = 0; c < qrSize; c++) {
                if (!qrMatrix[r][c]) continue;

                // Mirror horizontally for stamp
                const mirroredC = qrSize - 1 - c;

                const x0 = (mirroredC + border) * moduleSizeMM;
                const y0 = (r + border) * moduleSizeMM;
                const x1 = x0 + moduleSizeMM;
                const y1 = y0 + moduleSizeMM;

                // Top face
                const mt1 = addVertex(x0, y0, topZ);
                const mt2 = addVertex(x1, y0, topZ);
                const mt3 = addVertex(x1, y1, topZ);
                const mt4 = addVertex(x0, y1, topZ);
                addQuad(mt1, mt2, mt3, mt4);

                // Front face (y = y0)
                const mf1 = addVertex(x0, y0, BH);
                const mf2 = addVertex(x1, y0, BH);
                addQuad(mf1, mf2, mt2, mt1);

                // Back face (y = y1)
                const mb1 = addVertex(x0, y1, BH);
                const mb2 = addVertex(x1, y1, BH);
                addQuad(mb2, mb1, mt4, mt3);

                // Left face (x = x0)
                addQuad(mb1, mf1, mt1, mt4);

                // Right face (x = x1)
                addQuad(mf2, mb2, mt3, mt2);
            }
        }

        // Build handle on back (z=0 side) — a simple raised grip
        // Cylindrical handle approximated as an octagonal prism
        const handleRadius = S * 0.15;
        const handleHeight = S * 0.4;
        const handleCenterX = S / 2;
        const handleCenterY = S / 2;
        const handleSegments = 16;

        // Bottom ring (at z=0)
        const bottomRing = [];
        const topRing = [];
        for (let i = 0; i < handleSegments; i++) {
            const angle = (2 * Math.PI * i) / handleSegments;
            const x = handleCenterX + handleRadius * Math.cos(angle);
            const y = handleCenterY + handleRadius * Math.sin(angle);
            bottomRing.push(addVertex(x, y, 0));
            topRing.push(addVertex(x, y, -handleHeight));
        }

        // Handle side faces
        for (let i = 0; i < handleSegments; i++) {
            const next = (i + 1) % handleSegments;
            addQuad(bottomRing[i], bottomRing[next], topRing[next], topRing[i]);
        }

        // Handle top cap (z = -handleHeight)
        const handleTopCenter = addVertex(handleCenterX, handleCenterY, -handleHeight);
        for (let i = 0; i < handleSegments; i++) {
            const next = (i + 1) % handleSegments;
            faces.push(`f ${handleTopCenter} ${topRing[next]} ${topRing[i]}`);
        }

        // Handle bottom cap (z = 0, already has base, but close the cylinder)
        const handleBottomCenter = addVertex(handleCenterX, handleCenterY, 0);
        for (let i = 0; i < handleSegments; i++) {
            const next = (i + 1) % handleSegments;
            faces.push(`f ${handleBottomCenter} ${bottomRing[i]} ${bottomRing[next]}`);
        }

        const obj = [
            '# QR Stamp Maker — Generated OBJ',
            '# https://qr-stamp-maker.app',
            `# QR Version: ${currentQR.version}, Modules: ${totalModules}×${totalModules}`,
            `# Stamp size: ${S}×${S}×${(BH + moduleHeightMM).toFixed(1)} mm`,
            '',
            'o QR_Stamp',
            '',
            ...vertices,
            '',
            ...faces
        ].join('\n');

        return obj;
    }

    // ==========================================
    // STL Generation (Binary)
    // ==========================================

    function generateSTL() {
        if (!currentQR) return null;

        const qrMatrix = currentQR.matrix;
        const qrSize = currentQR.size;
        const border = parseInt(borderModulesInput.value);
        const totalModules = qrSize + border * 2;
        const stampSizeMM = parseFloat(stampSizeInput.value);
        const moduleHeightMM = parseFloat(moduleHeightInput.value);
        const baseHeightMM = parseFloat(baseHeightInput.value);
        const moduleSizeMM = stampSizeMM / totalModules;

        const triangles = [];

        function addTriangle(v1, v2, v3) {
            // Calculate normal
            const ux = v2[0] - v1[0], uy = v2[1] - v1[1], uz = v2[2] - v1[2];
            const vx = v3[0] - v1[0], vy = v3[1] - v1[1], vz = v3[2] - v1[2];
            const nx = uy * vz - uz * vy;
            const ny = uz * vx - ux * vz;
            const nz = ux * vy - uy * vx;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            triangles.push({
                normal: [nx / len, ny / len, nz / len],
                v1, v2, v3
            });
        }

        function addQuad(a, b, c, d) {
            addTriangle(a, b, c);
            addTriangle(a, c, d);
        }

        const S = stampSizeMM;
        const BH = baseHeightMM;
        const topZ = BH + moduleHeightMM;

        // Base plate
        addQuad([0, 0, 0], [0, S, 0], [S, S, 0], [S, 0, 0]); // bottom
        addQuad([0, 0, BH], [S, 0, BH], [S, S, BH], [0, S, BH]); // top
        addQuad([0, 0, 0], [S, 0, 0], [S, 0, BH], [0, 0, BH]); // front
        addQuad([S, 0, 0], [S, S, 0], [S, S, BH], [S, 0, BH]); // right
        addQuad([S, S, 0], [0, S, 0], [0, S, BH], [S, S, BH]); // back
        addQuad([0, S, 0], [0, 0, 0], [0, 0, BH], [0, S, BH]); // left

        // Raised modules
        for (let r = 0; r < qrSize; r++) {
            for (let c = 0; c < qrSize; c++) {
                if (!qrMatrix[r][c]) continue;
                const mirroredC = qrSize - 1 - c;
                const x0 = (mirroredC + border) * moduleSizeMM;
                const y0 = (r + border) * moduleSizeMM;
                const x1 = x0 + moduleSizeMM;
                const y1 = y0 + moduleSizeMM;

                // Top
                addQuad([x0, y0, topZ], [x1, y0, topZ], [x1, y1, topZ], [x0, y1, topZ]);
                // Front
                addQuad([x0, y0, BH], [x1, y0, BH], [x1, y0, topZ], [x0, y0, topZ]);
                // Back
                addQuad([x1, y1, BH], [x0, y1, BH], [x0, y1, topZ], [x1, y1, topZ]);
                // Left
                addQuad([x0, y1, BH], [x0, y0, BH], [x0, y0, topZ], [x0, y1, topZ]);
                // Right
                addQuad([x1, y0, BH], [x1, y1, BH], [x1, y1, topZ], [x1, y0, topZ]);
            }
        }

        // Handle
        const handleRadius = S * 0.15;
        const handleHeight = S * 0.4;
        const cx = S / 2, cy = S / 2;
        const segs = 16;

        const bottomRing = [], topRing = [];
        for (let i = 0; i < segs; i++) {
            const angle = (2 * Math.PI * i) / segs;
            const x = cx + handleRadius * Math.cos(angle);
            const y = cy + handleRadius * Math.sin(angle);
            bottomRing.push([x, y, 0]);
            topRing.push([x, y, -handleHeight]);
        }

        for (let i = 0; i < segs; i++) {
            const next = (i + 1) % segs;
            addQuad(bottomRing[i], bottomRing[next], topRing[next], topRing[i]);
        }

        // Handle caps
        for (let i = 0; i < segs; i++) {
            const next = (i + 1) % segs;
            addTriangle([cx, cy, -handleHeight], topRing[next], topRing[i]);
            addTriangle([cx, cy, 0], bottomRing[i], bottomRing[next]);
        }

        // Build binary STL
        const numTriangles = triangles.length;
        const buffer = new ArrayBuffer(84 + numTriangles * 50);
        const view = new DataView(buffer);

        // 80-byte header
        const header = 'QR Stamp Maker - Binary STL';
        for (let i = 0; i < 80; i++) {
            view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
        }

        // Number of triangles
        view.setUint32(80, numTriangles, true);

        let offset = 84;
        for (const tri of triangles) {
            // Normal
            view.setFloat32(offset, tri.normal[0], true); offset += 4;
            view.setFloat32(offset, tri.normal[1], true); offset += 4;
            view.setFloat32(offset, tri.normal[2], true); offset += 4;
            // Vertex 1
            view.setFloat32(offset, tri.v1[0], true); offset += 4;
            view.setFloat32(offset, tri.v1[1], true); offset += 4;
            view.setFloat32(offset, tri.v1[2], true); offset += 4;
            // Vertex 2
            view.setFloat32(offset, tri.v2[0], true); offset += 4;
            view.setFloat32(offset, tri.v2[1], true); offset += 4;
            view.setFloat32(offset, tri.v2[2], true); offset += 4;
            // Vertex 3
            view.setFloat32(offset, tri.v3[0], true); offset += 4;
            view.setFloat32(offset, tri.v3[1], true); offset += 4;
            view.setFloat32(offset, tri.v3[2], true); offset += 4;
            // Attribute byte count
            view.setUint16(offset, 0, true); offset += 2;
        }

        return new Blob([buffer], { type: 'application/octet-stream' });
    }

    // ==========================================
    // Download
    // ==========================================

    function downloadFile(content, filename, type) {
        const blob = typeof content === 'string'
            ? new Blob([content], { type })
            : content;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // Event Handlers
    // ==========================================

    generateBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) {
            urlInput.focus();
            urlInput.style.borderColor = '#ef4444';
            setTimeout(() => urlInput.style.borderColor = '', 1500);
            return;
        }

        try {
            // Use qrcode-generator library (loaded from CDN as global `qrcode`)
            // typeNumber 0 = auto-detect best version for the data length
            // Error correction level M for good scan reliability
            const qr = qrcode(0, 'M');
            qr.addData(url);
            qr.make();

            const moduleCount = qr.getModuleCount();

            // Build a boolean matrix compatible with the rest of the app
            const matrix = [];
            for (let r = 0; r < moduleCount; r++) {
                const row = [];
                for (let c = 0; c < moduleCount; c++) {
                    row.push(qr.isDark(r, c));
                }
                matrix.push(row);
            }

            currentQR = {
                matrix: matrix,
                size: moduleCount,
                version: Math.floor((moduleCount - 17) / 4) // derive version from module count
            };
        } catch (e) {
            console.error('QR generation failed:', e);
            alert('Failed to generate QR code. The URL may be too long (max ~100 characters for stamp quality).');
            return;
        }

        step2.classList.remove('hidden');
        step3dPreview.classList.remove('hidden');
        step3.classList.remove('hidden');

        // Initialize Three.js on first use
        initThree();

        updatePreviews();

        // Smooth scroll to preview
        step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Enter key
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') generateBtn.click();
    });

    // Settings change handlers — debounce 3D rebuild for performance
    let rebuildTimeout = null;
    [stampSizeInput, moduleHeightInput, baseHeightInput, borderModulesInput].forEach(input => {
        input.addEventListener('input', () => {
            stampSizeVal.textContent = `${stampSizeInput.value} mm`;
            moduleHeightVal.textContent = `${parseFloat(moduleHeightInput.value).toFixed(1)} mm`;
            baseHeightVal.textContent = `${baseHeightInput.value} mm`;
            borderModulesVal.textContent = `${borderModulesInput.value} modules`;

            // Update 2D previews immediately
            if (currentQR) {
                drawQR(qrNormalCanvas, currentQR.matrix, false);
                drawQR(qrMirroredCanvas, currentQR.matrix, true);
                updateDimensions();
            }

            // Debounce 3D rebuild (heavier operation)
            clearTimeout(rebuildTimeout);
            rebuildTimeout = setTimeout(() => {
                build3DStamp();
            }, 100);
        });
    });

    // Download OBJ
    downloadBtn.addEventListener('click', () => {
        const obj = generateOBJ();
        if (obj) {
            const safeName = urlInput.value.trim()
                .replace(/https?:\/\//, '')
                .replace(/[^a-zA-Z0-9]/g, '_')
                .substring(0, 30);
            downloadFile(obj, `qr_stamp_${safeName}.obj`, 'text/plain');
        }
    });

    // Download STL
    downloadStlBtn.addEventListener('click', () => {
        const stl = generateSTL();
        if (stl) {
            const safeName = urlInput.value.trim()
                .replace(/https?:\/\//, '')
                .replace(/[^a-zA-Z0-9]/g, '_')
                .substring(0, 30);
            downloadFile(stl, `qr_stamp_${safeName}.stl`, 'application/octet-stream');
        }
    });

    // Initial settings display
    stampSizeVal.textContent = `${stampSizeInput.value} mm`;
    moduleHeightVal.textContent = `${parseFloat(moduleHeightInput.value).toFixed(1)} mm`;
    baseHeightVal.textContent = `${baseHeightInput.value} mm`;
    borderModulesVal.textContent = `${borderModulesInput.value} modules`;

})();
