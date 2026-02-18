'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as d3 from 'd3';
import Link from 'next/link';

// Types
interface Node {
    id: string;
    date: string;
    title: string;
    titleTag?: string; // Optional because logic checks it
    category?: string;
    size?: number;
    x?: number;
    y?: number;
    z?: number;
    keywords?: string[];
    narasi_preview?: string;
    url?: string;
    __threeObj?: THREE.Object3D;
}

interface Link {
    source: string | Node;
    target: string | Node;
}

interface Data {
    nodes: Node[];
    links: Link[];
    categoryColors?: Record<string, string>;
    titleTagColors?: Record<string, string>;
}

// Configuration
const CONFIG = {
    dataUrl: '/hoax-network/data/processed.json',
    animationSpeed: 1,
    nodeAppearDuration: 1500,
    dateDuration: 800,
    labelDuration: 2000,
    nodeBaseSize: 3,
    nodeOpacityActive: 1,
    nodeOpacityFaded: 0.8,
    linkOpacity: 0.3, // Increased from 0.25
    linkWidth: 0.8, // Increased from 0.4
    cameraOrbitSpeed: 0.001,
    cameraDistance: 800,
    cameraMinDistance: 50,
    cameraMaxDistance: 10000,
    glowIntensity: 2,
    glowDuration: 1500,
    defaultNodeColor: '#00f2ff',
    linkColor: 'rgba(0, 242, 255, 0.15)',
    backgroundColor: '#05050a',
};

export default function VisualizerClient() {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<any>(null); // 3d-force-graph instance

    // State refs (mutable, no re-render)
    const stateRef = useRef({
        data: null as Data | null,
        currentNodes: [] as Node[],
        currentLinks: [] as Link[],
        isPlaying: false,
        currentDateIndex: 0,
        uniqueDates: [] as string[],
        nodesByDate: {} as Record<string, string[]>,
        nodesById: {} as Record<string, Node>,
        autoOrbit: true,
        autoZoom: true,
        orbitAngle: 0,
        userInteracting: false,
        networkCenter: { x: 0, y: 0, z: 0 },
        animationTimer: null as NodeJS.Timeout | null,
        interactionTimeout: null as NodeJS.Timeout | null,
        glowingNodes: new Map<string, number>(),
        floatingLabels: new Map<string, { startTime: number; text: string }>(),
        addedNodeIds: new Set<string>(),
        addedLinkIds: new Set<string>(),
        sharedNodeGeometry: null as THREE.SphereGeometry | null,

        speed: 1,
        highlightedCategory: null as string | null,
    });

    // UI State (triggers re-render)
    const [legendItems, setLegendItems] = useState<{ tag: string, color: string }[]>([]);
    const [stats, setStats] = useState({ nodes: 0, links: 0 });
    const [currentDate, setCurrentDate] = useState('Loading...');
    const [progress, setProgress] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [autoOrbit, setAutoOrbit] = useState(true);
    const [autoZoom, setAutoZoom] = useState(true);
    const [showLegend, setShowLegend] = useState(false);

    // Info Panel State
    // Info Panel State
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null);
    const [recentLabels, setRecentLabels] = useState<{ id: string, text: string, timestamp: number }[]>([]);
    const [showCarousel, setShowCarousel] = useState(true);

    // Sync stateRef for access inside non-reactive graph loops/functions
    useEffect(() => {
        stateRef.current.highlightedCategory = highlightedCategory;
        if (graphRef.current) {
            // Trigger update to apply new colors
            graphRef.current.nodeColor(graphRef.current.nodeColor());
            graphRef.current.linkColor(graphRef.current.linkColor());
        }
    }, [highlightedCategory]);

    useEffect(() => {
        let ForceGraph3D: any;

        const init = async () => {
            // Dynamic import for client-side only library
            const fgModule = await import('3d-force-graph');
            ForceGraph3D = fgModule.default;

            try {
                const response = await fetch(CONFIG.dataUrl);
                if (!response.ok) throw new Error('Failed to load data');
                const data: Data = await response.json();

                stateRef.current.data = data;
                stateRef.current.nodesById = {};
                data.nodes.forEach(node => {
                    stateRef.current.nodesById[node.id] = node;
                });

                processDates();
                populateLegend(data);
                initGraph(ForceGraph3D);

                setIsLoading(false);
                startAutoOrbit();
                startGlowAnimation();
                startLabelAnimation();

                // Start animation automatically after load
                setTimeout(() => startAnimation(), 1000);

            } catch (error) {
                console.error('Initialization error:', error);
                // Handle error state
            }
        };

        init();

        return () => {
            // Cleanup
            if (stateRef.current.animationTimer) clearTimeout(stateRef.current.animationTimer);
            if (stateRef.current.interactionTimeout) clearTimeout(stateRef.current.interactionTimeout);
            if (graphRef.current) graphRef.current._destructor?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    stateRef.current.isPlaying ? pauseAnimation() : startAnimation();
                    break;
                case 'r':
                case 'R':
                    resetAnimation();
                    break;
                case 'o':
                case 'O':
                    toggleAutoOrbit();
                    break;
                case 'f':
                case 'F':
                    fitCameraToNetwork();
                    break;
                case 'Escape':
                    setSelectedNode(null);
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const populateLegend = (data: Data) => {
        const { titleTagColors, categoryColors } = data;
        const colors = titleTagColors || categoryColors || {};
        const tagCounts: Record<string, number> = {};

        data.nodes.forEach(node => {
            const tag = node.titleTag || node.category;
            if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });

        const topTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        setLegendItems(topTags.map(([tag]) => ({
            tag,
            color: colors[tag] || CONFIG.defaultNodeColor
        })));
    };

    const processDates = () => {
        const { nodes } = stateRef.current.data!;
        stateRef.current.nodesByDate = {};

        nodes.forEach(node => {
            const dateStr = node.date;
            if (!stateRef.current.nodesByDate[dateStr]) {
                stateRef.current.nodesByDate[dateStr] = [];
            }
            stateRef.current.nodesByDate[dateStr].push(node.id);
        });

        stateRef.current.uniqueDates = Object.keys(stateRef.current.nodesByDate).sort((a, b) => {
            const [dayA, monthA, yearA] = a.split('/').map(Number);
            const [dayB, monthB, yearB] = b.split('/').map(Number);
            return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
        });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === '—') return dateStr;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return dateStr;
        const [day, month, year] = parts;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
    };

    const getNodeColor = (node: Node) => {
        const { categoryColors, titleTagColors } = stateRef.current.data!;
        const activeCategory = stateRef.current.highlightedCategory;

        // If a category is highlighted and this node doesn't match, return faded color
        if (activeCategory) {
            const nodeCategory = node.titleTag || node.category;
            if (nodeCategory !== activeCategory) {
                return 'rgba(255, 255, 255, 0.1)'; // Faded gray for non-matches
            }
        }

        if (node.titleTag && titleTagColors && titleTagColors[node.titleTag]) {
            return titleTagColors[node.titleTag];
        }
        if (node.category && categoryColors && categoryColors[node.category]) {
            return categoryColors[node.category];
        }
        return CONFIG.defaultNodeColor;
    };

    const getLinkColor = (link: Link) => {
        const sourceId = typeof link.source === 'object' ? (link.source as Node).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as Node).id : link.target;
        const sourceNode = stateRef.current.nodesById[sourceId as string];
        const targetNode = stateRef.current.nodesById[targetId as string];

        const activeCategory = stateRef.current.highlightedCategory;

        // If filter active, fade links not connecting two visible nodes
        if (activeCategory && sourceNode && targetNode) {
            const sourceCat = sourceNode.titleTag || sourceNode.category;
            const targetCat = targetNode.titleTag || targetNode.category;
            if (sourceCat !== activeCategory || targetCat !== activeCategory) {
                return 'rgba(255, 255, 255, 0.05)';
            }
        }

        if (sourceNode) {
            return getNodeColor(sourceNode); // This handles the match color logic too
        }
        return CONFIG.linkColor;
    };

    const createTextSprite = (text: string, color: any) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return new THREE.Object3D();

        canvas.width = 400;
        canvas.height = 100;

        // context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        // context.beginPath();
        // // @ts-ignore - roundRect might not be in TS definition yet or needs polyfill check, but standard now
        // if (context.roundRect) context.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 15);
        // else context.rect(5, 5, canvas.width - 10, canvas.height - 10);
        // context.fill();

        // // context.strokeStyle = color.getStyle ? color.getStyle() : color;
        // context.lineWidth = 2;
        // context.stroke();

        context.font = 'bold 28px Inter, Arial, sans-serif';
        context.textAlign = 'center' as CanvasTextAlign;
        context.textBaseline = 'middle' as CanvasTextBaseline;
        context.fillStyle = '#ffffff';
        context.fillText(text.toUpperCase().substring(0, 20), canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(30, 7.5, 1);

        return sprite;
    };

    const createNodeObject = (node: Node) => {
        const isGlowing = stateRef.current.glowingNodes.has(node.id);
        const colorVal = getNodeColor(node);
        const color = new THREE.Color(colorVal);
        const nodeSize = node.size || CONFIG.nodeBaseSize;

        const group = new THREE.Group();

        if (isGlowing) {
            const startTime = stateRef.current.glowingNodes.get(node.id)!;
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / CONFIG.glowDuration, 1);

            // Outer glow
            const glowSize = nodeSize * (3.5 - progress * 2);
            const glowGeometry = new THREE.SphereGeometry(glowSize, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.4 * (1 - progress),
            });
            const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);

            const pulse = 1 + 0.2 * Math.sin(elapsed * 0.008);
            glowMesh.scale.setScalar(pulse);
            group.add(glowMesh);

            // Bright core
            const coreGeometry = new THREE.SphereGeometry(nodeSize * 1.2, 12, 12);
            const coreMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.6 * (1 - progress),
            });
            const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
            group.add(coreMesh);
        }

        // Floating label
        if (stateRef.current.floatingLabels.has(node.id)) {
            const labelInfo = stateRef.current.floatingLabels.get(node.id)!;
            const elapsed = Date.now() - labelInfo.startTime;
            const progress = Math.min(elapsed / CONFIG.labelDuration, 1);

            if (progress < 1) {
                const sprite = createTextSprite(labelInfo.text, color);
                const riseHeight = 15 + progress * 25;
                sprite.position.set(0, riseHeight, 0);

                if (progress > 0.5) {
                    const fadeProgress = (progress - 0.5) / 0.5;
                    (sprite as THREE.Sprite).material.opacity = 1 - fadeProgress;
                }

                group.add(sprite);
            }
        }

        return group;
    };

    const initGraph = (ForceGraph3DArg: any) => {
        if (!containerRef.current) return;
        const ForceGraph3D = ForceGraph3DArg;

        // Pre-create geometry
        if (!stateRef.current.sharedNodeGeometry) {
            stateRef.current.sharedNodeGeometry = new THREE.SphereGeometry(1, 16, 16);
        }

        const graph = ForceGraph3D()(containerRef.current)
            .backgroundColor(CONFIG.backgroundColor)
            .showNavInfo(false)
            .enableNavigationControls(true)
            .enablePointerInteraction(true)
            .nodeLabel((node: any) => {
                const n = node as Node;
                const color = getNodeColor(n);
                return `<div style="padding: 10px; background: rgba(0,0,0,0.9); border-radius: 10px; max-width: 300px; font-family: Inter, sans-serif; border: 1px solid ${color};">
            <div style="font-size: 11px; color: ${color}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">${n.titleTag || n.category}</div>
            <strong style="color: #fff; font-size: 14px;">${n.title}</strong><br>
            <span style="color: #888; font-size: 12px;">${formatDate(n.date)}</span>
        </div>`;
            })
            .nodeColor((node: any) => getNodeColor(node as Node))
            .nodeOpacity(0.95)
            .nodeVal((node: any) => (node as Node).size || CONFIG.nodeBaseSize)
            .nodeRelSize(4)
            .nodeThreeObject((node: any) => {
                // Core mesh
                const n = node as Node;
                if (!stateRef.current.sharedNodeGeometry) stateRef.current.sharedNodeGeometry = new THREE.SphereGeometry(1, 16, 16);
                const color = getNodeColor(n);
                const material = new THREE.MeshLambertMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.9
                });
                const mesh = new THREE.Mesh(stateRef.current.sharedNodeGeometry, material);
                const size = n.size || CONFIG.nodeBaseSize;
                mesh.scale.setScalar(size);
                return mesh;
            })
            .nodeThreeObjectExtend(true) // We want the glow/labels added ON TOP
            .linkColor((link: any) => getLinkColor(link as Link))
            .linkOpacity(CONFIG.linkOpacity)
            .linkWidth(CONFIG.linkWidth) // Use config value
            .numDimensions(3)
            .d3AlphaDecay(0.04)
            .d3VelocityDecay(0.3)
            .onNodeClick((node: any) => {
                const n = node as Node;
                if (n.x === undefined || n.y === undefined || n.z === undefined) return;

                // Pause animation when clicking a node
                if (stateRef.current.isPlaying) pauseAnimation();

                setSelectedNode(n);

                // Aim at node
                const distance = 40;
                const distRatio = 1 + distance / Math.hypot(n.x, n.y, n.z);

                graphRef.current.cameraPosition(
                    { x: n.x * distRatio, y: n.y * distRatio, z: n.z * distRatio }, // new position
                    { x: n.x, y: n.y, z: n.z }, // lookAt ({ x, y, z })
                    3000
                );
            })
            .onBackgroundClick(() => {
                setSelectedNode(null);
            });

        // Forces
        graph.d3Force('charge', d3.forceManyBody().strength(-40).distanceMax(200));
        graph.d3Force('link', d3.forceLink().id((d: any) => d.id).distance(40).strength(0.2));
        // graph.d3Force('center', d3.forceCenter(0, 0)); // Removed to use default 3D center
        graph.d3Force('collision', d3.forceCollide().radius((node: any) => ((node as Node).size || CONFIG.nodeBaseSize) * 1.5).iterations(1));

        // Custom object update (for glow and labels) -- we hooked into nodeThreeObject above to create the core sphere, 
        // but the original code had a separate `createNodeObject` logic that returned a GROUP with glow/labels.
        // The `nodeThreeObjectExtend(true)` means the return value of nodeThreeObject is added to the node. 
        // Wait, the original code returned a GROUP replacing the default object? 
        // Original code: .nodeThreeObject(node => ... returns mesh or group ...) 
        // It seems the original code logic was inconsistent in my read or it used a trick.
        // The original code in `initGraph` returned a mesh using shared geometry.
        // AND `startGlowAnimation` called `state.graph.nodeThreeObject(node => createNodeObject(node));` repeatedly?
        // THAT is expensive! It replaces the whole object!
        // Ah, `nodeThreeObject` when called sets the accessor.
        // So the original code SWAPPED the object accessor function during animation?
        // That seems inefficient but that's what it did.

        // To make it efficient in React/Next, I should probably stick to one accessor that builds a Group containing both the core and any dynamic elements.
        // But modifying the scene graph every frame is also heavy.
        // Let's stick to the original logic: Update the accessor in the animation loop if needed.

        graph.cameraPosition({ x: 0, y: 0, z: CONFIG.cameraDistance });
        graph.graphData({ nodes: [], links: [] });

        graphRef.current = graph;
        setupCameraControls();
    };

    const setupCameraControls = () => {
        const controls = graphRef.current.controls();
        if (controls) {
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = CONFIG.cameraMinDistance;
            controls.maxDistance = CONFIG.cameraMaxDistance;
            controls.zoomSpeed = 2.0;

            controls.addEventListener('start', () => {
                stateRef.current.userInteracting = true;

                // Update state refs directly
                // stateRef.current.autoOrbit = false; // User requested to keep auto orbit compliant
                // stateRef.current.autoZoom = false;

                // Update React state to reflect in UI buttons immediately
                // setAutoOrbit(false);
                // setAutoZoom(false);

                if (stateRef.current.isPlaying) pauseAnimation();
                if (stateRef.current.interactionTimeout) clearTimeout(stateRef.current.interactionTimeout);
            });

            controls.addEventListener('end', () => {
                stateRef.current.userInteracting = false;

                // Do NOT automatically re-enable autoOrbit/autoZoom.
                // User interaction permanently pauses them until they click the buttons again.
                // We just clear the timeout if it existed.
                if (stateRef.current.interactionTimeout) {
                    clearTimeout(stateRef.current.interactionTimeout);
                    stateRef.current.interactionTimeout = null;
                }
            });
        }
    };

    const startAnimation = () => {
        if (stateRef.current.isPlaying) return;
        stateRef.current.isPlaying = true;
        stateRef.current.autoZoom = true;
        setIsPlaying(true);
        setAutoZoom(true);
        animationTick();
    };

    const pauseAnimation = () => {
        stateRef.current.isPlaying = false;
        setIsPlaying(false);
        if (stateRef.current.animationTimer) {
            clearTimeout(stateRef.current.animationTimer);
            stateRef.current.animationTimer = null;
        }
    };

    const resetAnimation = () => {
        pauseAnimation();
        stateRef.current.currentDateIndex = 0;
        stateRef.current.currentNodes = [];
        stateRef.current.currentLinks = [];
        stateRef.current.addedNodeIds.clear();
        stateRef.current.addedLinkIds.clear();
        stateRef.current.glowingNodes.clear();
        stateRef.current.floatingLabels.clear();

        if (graphRef.current) graphRef.current.graphData({ nodes: [], links: [] });

        setStats({ nodes: 0, links: 0 });
        // Update date display via tick logic or manual
        setCurrentDate(stateRef.current.uniqueDates[0]);
        setProgress(0);
    };

    const animationTick = () => {
        if (!stateRef.current.isPlaying) return;

        if (stateRef.current.currentDateIndex >= stateRef.current.uniqueDates.length) {
            pauseAnimation();
            fitCameraToNetwork();
            return;
        }

        const currentDateStr = stateRef.current.uniqueDates[stateRef.current.currentDateIndex];
        setCurrentDate(currentDateStr);
        setProgress(((stateRef.current.currentDateIndex + 1) / stateRef.current.uniqueDates.length) * 100);

        const nodeIdsForDate = stateRef.current.nodesByDate[currentDateStr] || [];
        let nodesAdded = false;

        nodeIdsForDate.forEach(nodeId => {
            if (!stateRef.current.addedNodeIds.has(nodeId)) {
                const node = stateRef.current.nodesById[nodeId];
                if (node) {
                    stateRef.current.currentNodes.push(node);
                    stateRef.current.addedNodeIds.add(nodeId);
                    stateRef.current.glowingNodes.set(nodeId, Date.now());
                    // Option 1: Use first keyword, fallback to truncated title or category
                    let labelText = '';
                    if (node.keywords && node.keywords.length > 0) {
                        labelText = node.keywords[0];
                    } else if (node.title) {
                        labelText = node.title.split(' ').slice(0, 2).join(' '); // First 2 words of title
                    } else {
                        labelText = node.titleTag || node.category || 'HOAX';
                    }

                    stateRef.current.floatingLabels.set(nodeId, {
                        startTime: Date.now(),
                        text: labelText
                    });

                    // Add to recent labels for carousel UI
                    const newLabel = { id: nodeId, text: labelText, timestamp: Date.now() };
                    // We need to update the React state to render this. 
                    // Since this runs in an animation loop, we should be careful.

                    setRecentLabels(prev => {
                        const updated = [...prev, newLabel];
                        // Keep 7 items to have a smooth flow (3 above, 1 center, 3 below roughly)
                        if (updated.length > 7) return updated.slice(updated.length - 7);
                        return updated;
                    });

                    nodesAdded = true;
                }
            }
        });

        stateRef.current.data?.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? (link.source as Node).id : link.source;
            const targetId = typeof link.target === 'object' ? (link.target as Node).id : link.target;
            const linkId = `${sourceId}-${targetId}`;

            if (stateRef.current.addedNodeIds.has(sourceId as string) &&
                stateRef.current.addedNodeIds.has(targetId as string) &&
                !stateRef.current.addedLinkIds.has(linkId)) {
                stateRef.current.currentLinks.push(link);
                stateRef.current.addedLinkIds.add(linkId);
            }
        });

        if (nodesAdded && graphRef.current) {
            graphRef.current.graphData({
                nodes: [...stateRef.current.currentNodes],
                links: [...stateRef.current.currentLinks]
            });
            setStats({
                nodes: stateRef.current.currentNodes.length,
                links: stateRef.current.currentLinks.length
            });
        }

        stateRef.current.currentDateIndex++;
        const delay = CONFIG.dateDuration / stateRef.current.speed;

        stateRef.current.animationTimer = setTimeout(animationTick, delay);
    };

    const startGlowAnimation = () => {
        const animate = () => {
            const now = Date.now();
            for (const [nodeId, startTime] of stateRef.current.glowingNodes) {
                if (now - startTime > CONFIG.glowDuration) {
                    stateRef.current.glowingNodes.delete(nodeId);
                }
            }

            // This is the heavy part: Re-evaluating node objects to show glow/labels
            if ((stateRef.current.glowingNodes.size > 0 || stateRef.current.floatingLabels.size > 0) && graphRef.current) {
                // We use the same 'createNodeObject' function.
                // Note: graph.nodeThreeObject(...) triggers a full update of changed nodes? 
                // actually it just updates the accessor. 3d-force-graph will re-render objects if they are dirty?
                // Actually typically you need to call graph.refresh() or similar? 
                // The original code passed the function again: state.graph.nodeThreeObject(...)
                // This might re-evaluate ALL nodes.
                graphRef.current.nodeThreeObject((node: Node) => createNodeObject(node));
            }

            requestAnimationFrame(animate);
        };
        animate();
    };

    const startLabelAnimation = () => {
        const animate = () => {
            const now = Date.now();
            for (const [nodeId, labelInfo] of stateRef.current.floatingLabels) {
                if (now - labelInfo.startTime > CONFIG.labelDuration) {
                    stateRef.current.floatingLabels.delete(nodeId);
                }
            }
            // Combined with glow animation usually, but kept separate in original.
            requestAnimationFrame(animate);
        };
        animate();
    }

    const startAutoOrbit = () => {
        const animate = () => {
            if (!graphRef.current) {
                requestAnimationFrame(animate);
                return;
            }

            // AUTO ORBIT LOGIC
            // We only apply orbit if enabled and user is NOT interacting
            if (stateRef.current.autoOrbit && !stateRef.current.userInteracting && graphRef.current) {
                const graph = graphRef.current;

                // Get current camera state
                const currentPos = graph.cameraPosition();

                // Get looking target (Pan support). Fallback to networkCenter if controls undefined
                const controls = graph.controls();
                // Use the controls specific target as the orbit center to respect PAN
                const target = controls ? controls.target : new THREE.Vector3(stateRef.current.networkCenter.x, stateRef.current.networkCenter.y, stateRef.current.networkCenter.z);

                // Convert position relative to target to Spherical coordinates
                const offset = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z).sub(target);
                const spherical = new THREE.Spherical().setFromVector3(offset);

                // Increment Theta (horizontal rotation)
                spherical.theta += CONFIG.cameraOrbitSpeed * 0.5 * stateRef.current.speed;

                // Convert back to Cartesian
                const newOffset = new THREE.Vector3().setFromSpherical(spherical);
                const newPos = new THREE.Vector3().copy(target).add(newOffset);

                // Apply new position while maintaining the same target (LookAt)
                graph.cameraPosition(
                    { x: newPos.x, y: newPos.y, z: newPos.z },
                    { x: target.x, y: target.y, z: target.z },
                    0 // Instant update
                );
            }

            requestAnimationFrame(animate);
        }
        animate();
    };

    const toggleAutoOrbit = () => {
        const newAutoOrbit = !stateRef.current.autoOrbit;
        stateRef.current.autoOrbit = newAutoOrbit;
        setAutoOrbit(newAutoOrbit);

        if (newAutoOrbit && graphRef.current) {
            // RESUME ORBIT SMOOTHLY: Sync state with current camera position
            const camPos = graphRef.current.cameraPosition();
            const center = stateRef.current.networkCenter;
            const dx = camPos.x - center.x;
            const dz = camPos.z - center.z;

            CONFIG.cameraDistance = Math.sqrt(dx * dx + dz * dz);
            stateRef.current.orbitAngle = Math.atan2(dx, dz);
        }
    };

    const toggleAutoZoom = () => {
        const newAutoZoom = !stateRef.current.autoZoom;
        stateRef.current.autoZoom = newAutoZoom;
        setAutoZoom(newAutoZoom);
    };

    const calculateNetworkCenter = () => {
        if (stateRef.current.currentNodes.length === 0) return { x: 0, y: 0, z: 0 };
        let sumX = 0, sumY = 0, sumZ = 0;
        let count = 0;
        stateRef.current.currentNodes.forEach(node => {
            if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
                sumX += node.x;
                sumY += node.y;
                sumZ += node.z;
                count++;
            }
        });
        return count > 0 ? { x: sumX / count, y: sumY / count, z: sumZ / count } : { x: 0, y: 0, z: 0 };
    };

    const calculateAverageDistance = (center: { x: number, y: number, z: number }) => {
        let sum = 0;
        let count = 0;
        stateRef.current.currentNodes.forEach(node => {
            if (node.x !== undefined && node.y !== undefined && node.z !== undefined) {
                const dx = node.x - center.x;
                const dy = node.y - center.y;
                const dz = node.z - center.z;
                sum += Math.sqrt(dx * dx + dy * dy + dz * dz);
                count++;
            }
        });
        return count > 0 ? sum / count : 100;
    };

    const fitCameraToNetwork = (animate = true) => {
        const center = calculateNetworkCenter();
        const avgRadius = calculateAverageDistance(center);
        const distance = Math.max(avgRadius * 2.8, 400);

        stateRef.current.networkCenter = center;
        CONFIG.cameraDistance = distance;

        const pos = {
            x: center.x + distance * 0.7,
            y: center.y + distance * 0.3,
            z: center.z + distance * 0.7
        };

        if (graphRef.current) {
            graphRef.current.cameraPosition(pos, center, animate ? 1500 : 0);

            // Sync internal state with the target position so it doesn't snap back if auto-orbit resumes
            const dx = pos.x - center.x;
            const dz = pos.z - center.z;
            stateRef.current.orbitAngle = Math.atan2(dx, dz);
        }
    };

    return (
        <div className="relative w-full h-screen bg-[#05050a] text-white overflow-hidden">
            {/* Loading Screen */}
            <div id="loading-screen" className={`${isLoading ? '' : 'hidden'}`}>
                <div className="loader-container">
                    <div className="loader-ring"></div>
                    <div className="loader-ring"></div>
                    <div className="loader-ring"></div>
                    <h2 className="loader-text">Loading Network Data</h2>
                    <p className="loader-subtext">Preparing visualization...</p>
                </div>
            </div>

            {/* Graph Container */}
            <div ref={containerRef} id="graph-container" className="absolute inset-0 z-0" />

            {/* UI Overlay */}
            <div id="ui-overlay" className="absolute inset-0 z-10 pointer-events-none">

                {/* Title Bar */}
                <header className="title-bar pointer-events-auto">
                    <div className="flex items-center gap-4">
                        {/* Home Button */}
                        <Link href="https://raihankalla.id" className="control-btn" style={{ border: 'none', background: 'transparent', padding: 0 }} title="Back to Home">
                            <svg className="icon" viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
                                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                            </svg>
                        </Link>
                        <div className="title-content">
                            <h1>Hoax Text Network</h1>
                            <span className="subtitle">TurnBackHoax.id Dataset of 2025</span>
                        </div>
                    </div>
                    <div className="stats-container">
                        <div className="stat-item">
                            <span className="stat-value">{stats.nodes}</span>
                            <span className="stat-label">Articles</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats.links}</span>
                            <span className="stat-label">Connections</span>
                        </div>
                    </div>
                </header>

                {/* Date Display */}
                <div className="date-display pointer-events-auto">
                    <div className="date-label">Date</div>
                    <div className="date-value">{formatDate(currentDate)}</div>
                    <div className="date-progress">
                        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>

                {/* Controls */}
                <div className="controls-panel pointer-events-auto">
                    <div className="control-group">
                        <button className="control-btn" onClick={() => isPlaying ? pauseAnimation() : startAnimation()} title="Play / Pause">
                            {isPlaying ? (
                                <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                            ) : (
                                <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            )}
                        </button>
                        <button className="control-btn" onClick={resetAnimation} title="Reset">
                            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
                        </button>
                    </div>
                    <div className="control-group speed-control">
                        <input
                            type="range"
                            min="0.5"
                            max="5"
                            step="0.5"
                            value={speed}
                            onChange={(e) => {
                                const newSpeed = parseFloat(e.target.value);
                                setSpeed(newSpeed);
                                stateRef.current.speed = newSpeed;
                            }}
                        />
                        <span id="speed-value">{speed}x</span>
                    </div>
                    <div className="control-group">
                        <button
                            className="control-btn"
                            onClick={toggleAutoOrbit}
                            style={{ borderColor: autoOrbit ? 'var(--accent-primary)' : '', color: autoOrbit ? 'var(--accent-primary)' : '' }}
                            title="Toggle Auto-Orbit"
                        >
                            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                        </button>
                        <button
                            className="control-btn"
                            onClick={toggleAutoZoom}
                            style={{ borderColor: autoZoom ? 'var(--accent-primary)' : '', color: autoZoom ? 'var(--accent-primary)' : '' }}
                            title="Toggle Auto-Zoom"
                        >
                            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /><path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z" /></svg>
                        </button>
                        <button className="control-btn" onClick={() => fitCameraToNetwork(true)}>
                            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zm0 14h5v-5h-2v3h-3v2zM5 19h5v-2H7v-3H5v5z" /></svg>
                        </button>
                    </div>
                </div>

                {/* Credits */}
                <div className="credits pointer-events-auto">
                    &copy; {new Date().getFullYear()} <a href="https://raihankalla.id" target="_blank" rel="noreferrer">@alhrkn</a>
                </div>

                {/* Info Panel */}
                {selectedNode && (
                    <div className="info-panel pointer-events-auto">
                        <button className="close-btn" onClick={() => {
                            setSelectedNode(null);
                            fitCameraToNetwork(true);
                        }}>&times;</button>
                        <div className="info-category" style={{ backgroundColor: getNodeColor(selectedNode) }}>
                            {selectedNode.titleTag || selectedNode.category || 'HOAX'}
                        </div>
                        <h3 className="info-title">{selectedNode.title}</h3>
                        <div className="info-date">{formatDate(selectedNode.date)}</div>

                        {selectedNode.keywords && (
                            <div className="info-keywords">
                                {selectedNode.keywords.map((kw, i) => (
                                    <span key={i} className="keyword-tag">{kw}</span>
                                ))}
                            </div>
                        )}

                        <div className="info-preview">
                            {selectedNode.narasi_preview ? (
                                <>
                                    {selectedNode.narasi_preview.length > 200
                                        ? selectedNode.narasi_preview.substring(0, 200) + '...'
                                        : selectedNode.narasi_preview}
                                    {selectedNode.url && selectedNode.url !== '#' && (
                                        <a href={selectedNode.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-secondary)', textDecoration: 'none', fontWeight: 'bold', marginLeft: '5px' }}>
                                            (Read more)
                                        </a>
                                    )}
                                </>
                            ) : 'No preview available.'}
                        </div>
                    </div>
                )}

                {/* Legend Panel */}
                {legendItems.length > 0 && (
                    <>
                        {!showLegend && (
                            <button
                                id="legend-toggle"
                                className="control-btn"
                                onClick={() => setShowLegend(true)}
                                title="Show Legend"
                            >
                                <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M4 15h16v-2H4v2zm0 4h16v-2H4v2zm0-8h16V9H4v2zm0-6v2h16V5H4z" />
                                </svg>
                            </button>
                        )}

                        <div className={`legend-panel pointer-events-auto hidden md:block ${showLegend ? 'visible' : ''}`}>
                            <button
                                className="close-btn legend-close-btn"
                                onClick={() => setShowLegend(false)}
                                style={{ top: '0.5rem', right: '0.5rem', fontSize: '1.2rem' }}
                            >&times;</button>
                            <h4 style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-sm)' }}>
                                Categories
                            </h4>
                            <div className="legend-items">
                                {legendItems.map((item, i) => (
                                    <div
                                        key={i}
                                        className="legend-item"
                                        onClick={() => setHighlightedCategory(highlightedCategory === item.tag ? null : item.tag)}
                                        style={{
                                            cursor: 'pointer',
                                            opacity: highlightedCategory && highlightedCategory !== item.tag ? 0.3 : 1
                                        }}
                                    >
                                        <span className="legend-color" style={{ background: item.color, color: item.color }}></span>
                                        <span>{item.tag}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}


                {/* Vertical Text Carousel (Right Side) */}
                {/* Mobile Toggle Button for Carousel */}
                {!showCarousel && (
                    <button
                        className="control-btn md:hidden"
                        onClick={() => setShowCarousel(true)}
                        title="Show Text Stream"
                        style={{ position: 'absolute', right: '1rem', top: '90px', zIndex: 20 }}
                    >
                        <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 15h16v-2H4v2zm0 4h16v-2H4v2zm0-8h16V9H4v2zm0-6v2h16V5H4z" />
                        </svg>
                    </button>
                )}



                <div
                    className={`absolute right-4 md:right-8 flex-col items-end gap-1 pointer-events-none z-10 ${showCarousel ? 'flex' : 'hidden'} md:flex top-[90px] md:top-1/2 md:-translate-y-1/2`}
                >
                    {/* Close Button (Mobile Only) - Outside the masked area so it's not faded */}
                    <button
                        className="pointer-events-auto md:hidden mb-2 text-white/50 hover:text-white"
                        onClick={() => setShowCarousel(false)}
                        style={{ fontSize: '1.5rem', lineHeight: '1', zIndex: 30 }}
                    >
                        &times;
                    </button>

                    <div style={{
                        maxHeight: '200px',
                        overflow: 'hidden',
                        maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        width: '100%'
                    }}>


                        {recentLabels.map((label, index) => {
                            // Simplified 2D Logic:
                            // Just use distance from center for opacity/scale.
                            const listLength = recentLabels.length;
                            const centerIndex = (listLength - 1) / 2;
                            const dist = Math.abs(index - centerIndex);

                            // Fading: Center is 1.0, edges drop to ~0.3
                            const opacity = Math.max(0.3, 1 - (dist * 0.25));

                            // Scale: Center is 1.0, edges drop to ~0.85
                            const scale = Math.max(0.85, 1 - (dist * 0.05));

                            // Blur edges slightly for depth effect without 3D
                            const blur = dist > 1.5 ? 'blur(1px)' : 'none';

                            return (
                                <div
                                    key={label.id}
                                    className="text-right font-bold text-accent-primary"
                                    style={{
                                        textShadow: opacity > 0.8 ? '0 0 12px rgba(0, 242, 255, 0.6)' : 'none',
                                        fontSize: '1.2rem',
                                        height: '30px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',

                                        // 2D Transformations only
                                        opacity: opacity,
                                        transform: `scale(${scale})`,
                                        filter: blur,
                                        transformOrigin: 'right center',
                                        transition: 'all 0.4s ease-out', // Standard smooth transition

                                        whiteSpace: 'nowrap',
                                        width: '100%'
                                    }}
                                >
                                    {label.text}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}
