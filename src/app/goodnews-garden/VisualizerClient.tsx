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
    titleTag?: string;
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

interface GraphLink {
    source: string | Node;
    target: string | Node;
}

interface Data {
    nodes: Node[];
    links: GraphLink[];
    categoryColors?: Record<string, string>;
    titleTagColors?: Record<string, string>;
}

// Configuration
const CONFIG = {
    dataUrl: '/goodnews-garden/data/processed.json',
    animationSpeed: 1,
    nodeAppearDuration: 1500,
    dateDuration: 800,
    labelDuration: 2000,
    nodeBaseSize: 3,
    nodeOpacityActive: 1,
    nodeOpacityFaded: 0.8,
    linkOpacity: 0.6,
    linkWidth: 1.5,
    cameraOrbitSpeed: 0.0005,
    cameraDistance: 800,
    cameraMinDistance: 50,
    cameraMaxDistance: 10000,
    glowIntensity: 2.5,
    glowDuration: 2000,
    defaultNodeColor: '#F8BBD9',
    linkColor: 'rgba(129, 199, 132, 0.4)',
    backgroundColor: '#fefefe',
};

// Flower color palettes for different categories (spring/garden theme)
const FLOWER_PALETTES: Record<string, { petal: string; center: string; glow: string }> = {
    'Wisata': { petal: '#81D4FA', center: '#FFE082', glow: '#4FC3F7' },
    'IPTEK & Pendidikan': { petal: '#A5D6A7', center: '#FFF59D', glow: '#66BB6A' },
    'Nasional': { petal: '#EF9A9A', center: '#FFCC80', glow: '#E57373' },
    'Humaniora': { petal: '#FFE082', center: '#FFAB91', glow: '#FFD54F' },
    'Sosial Budaya': { petal: '#F8BBD9', center: '#FFECB3', glow: '#F48FB1' },
    'Sejarah': { petal: '#CE93D8', center: '#F8BBD9', glow: '#BA68C8' },
    'Opini': { petal: '#90CAF9', center: '#B3E5FC', glow: '#64B5F6' },
    'Internasional': { petal: '#80DEEA', center: '#E0F7FA', glow: '#4DD0E1' },
    'Ekonomi': { petal: '#FFAB91', center: '#FFE0B2', glow: '#FF8A65' },
    'Olahraga': { petal: '#C5E1A5', center: '#F0F4C3', glow: '#9CCC65' },
    'Legenda': { petal: '#E1BEE7', center: '#F3E5F5', glow: '#CE93D8' },
    'Uncategorized': { petal: '#CFD8DC', center: '#ECEFF1', glow: '#B0BEC5' }
};

// Nature/flowery emojis for each category
const CATEGORY_EMOJIS: Record<string, string> = {
    'Wisata': '🌊',
    'IPTEK & Pendidikan': '🌿',
    'Nasional': '🌹',
    'Humaniora': '🌻',
    'Sosial Budaya': '🌸',
    'Sejarah': '🍂',
    'Opini': '💭',
    'Internasional': '🌍',
    'Ekonomi': '🌾',
    'Olahraga': '🍀',
    'Legenda': '✨',
    'Uncategorized': '🌱'
};

// Helper to get emoji for a category
function getCategoryEmoji(category: string | undefined): string {
    return CATEGORY_EMOJIS[category || ''] || CATEGORY_EMOJIS['Uncategorized'];
}

// Helper to get flower palette
function getFlowerPalette(node: Node): { petal: string; center: string; glow: string } {
    const category = node.category || 'Uncategorized';
    return FLOWER_PALETTES[category] || FLOWER_PALETTES['Uncategorized'];
}

// Smoother easing for bloom animation
function easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export default function VisualizerClient() {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<any>(null);

    // State refs (mutable, no re-render)
    const stateRef = useRef({
        data: null as Data | null,
        currentNodes: [] as Node[],
        currentLinks: [] as GraphLink[],
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
        sharedGeometries: {} as Record<string, THREE.SphereGeometry>,
        emojiTextureCache: new Map<string, THREE.CanvasTexture>(),
        speed: 1,
        highlightedCategory: null as string | null,
    });

    // UI State (triggers re-render)
    const [legendItems, setLegendItems] = useState<{ tag: string; color: string; emoji: string }[]>([]);
    const [stats, setStats] = useState({ nodes: 0, links: 0 });
    const [currentDate, setCurrentDate] = useState('planting...');
    const [progress, setProgress] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [autoOrbit, setAutoOrbit] = useState(true);
    const [autoZoom, setAutoZoom] = useState(true);
    const [showLegend, setShowLegend] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null);
    const [recentLabels, setRecentLabels] = useState<{ id: string; text: string; timestamp: number }[]>([]);
    const [showCarousel, setShowCarousel] = useState(true);

    // Sync stateRef for access inside non-reactive graph loops/functions
    useEffect(() => {
        stateRef.current.highlightedCategory = highlightedCategory;
        if (graphRef.current) {
            graphRef.current.nodeColor(graphRef.current.nodeColor());
            graphRef.current.linkColor(graphRef.current.linkColor());
            // Refresh node 3D objects to apply opacity filtering
            graphRef.current.nodeThreeObject((node: Node) => createFlowerObject(node));
        }
    }, [highlightedCategory]);

    useEffect(() => {
        let ForceGraph3D: any;

        const init = async () => {
            const fgModule = await import('3d-force-graph');
            ForceGraph3D = fgModule.default;

            try {
                const response = await fetch(CONFIG.dataUrl);
                if (!response.ok) throw new Error('Failed to load data');
                const data: Data = await response.json();

                // Override colors with flower palette
                if (data.categoryColors) {
                    Object.keys(FLOWER_PALETTES).forEach(cat => {
                        if (FLOWER_PALETTES[cat] && data.categoryColors) {
                            data.categoryColors[cat] = FLOWER_PALETTES[cat].petal;
                        }
                    });
                }
                if (data.titleTagColors) {
                    Object.keys(FLOWER_PALETTES).forEach(cat => {
                        if (FLOWER_PALETTES[cat] && data.titleTagColors) {
                            data.titleTagColors[cat] = FLOWER_PALETTES[cat].petal;
                        }
                    });
                }

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

                setTimeout(() => startAnimation(), 1000);

                console.log('🌸 Flower Garden Visualization initialized');
                console.log(`Loaded ${data.nodes.length} flower nodes and ${data.links.length} vine connections`);

            } catch (error) {
                console.error('Initialization error:', error);
            }
        };

        init();

        return () => {
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
        const topicCounts: Record<string, number> = {};
        data.nodes.forEach(node => {
            const topic = node.category || 'Uncategorized';
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });

        const topTopics = Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        setLegendItems(topTopics.map(([tag]) => {
            const palette = FLOWER_PALETTES[tag] || FLOWER_PALETTES['Uncategorized'];
            return {
                tag,
                color: palette.petal,
                emoji: getCategoryEmoji(tag)
            };
        }));
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
        if (!dateStr || dateStr === '—' || dateStr === 'planting...') return dateStr;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return dateStr;
        const [day, month, year] = parts;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
    };

    const getNodeColor = (node: Node) => {
        const activeCategory = stateRef.current.highlightedCategory;
        if (activeCategory) {
            if (node.category !== activeCategory) {
                return 'rgba(200, 200, 200, 0.2)';
            }
        }
        return getFlowerPalette(node).petal;
    };

    const getLinkColor = (link: GraphLink) => {
        const sourceId = typeof link.source === 'object' ? (link.source as Node).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as Node).id : link.target;
        const sourceNode = stateRef.current.nodesById[sourceId as string];
        const targetNode = stateRef.current.nodesById[targetId as string];

        const activeCategory = stateRef.current.highlightedCategory;

        if (activeCategory && sourceNode && targetNode) {
            if (sourceNode.category !== activeCategory || targetNode.category !== activeCategory) {
                return 'rgba(200, 200, 200, 0.1)';
            }
        }

        if (sourceNode) {
            const palette = getFlowerPalette(sourceNode);
            const color = new THREE.Color(palette.petal);
            const greenVine = new THREE.Color('#81C784');
            color.lerp(greenVine, 0.6);
            return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 0.5)`;
        }
        return CONFIG.linkColor;
    };

    // Shared geometries for performance
    const getSharedGeometry = (type: string, size: number): THREE.SphereGeometry => {
        const key = `${type}_${size.toFixed(2)}`;
        if (!stateRef.current.sharedGeometries[key]) {
            switch (type) {
                case 'core':
                    stateRef.current.sharedGeometries[key] = new THREE.SphereGeometry(size, 12, 12);
                    break;
                case 'halo':
                    stateRef.current.sharedGeometries[key] = new THREE.SphereGeometry(size, 8, 8);
                    break;
                case 'glow':
                    stateRef.current.sharedGeometries[key] = new THREE.SphereGeometry(size, 6, 6);
                    break;
                default:
                    stateRef.current.sharedGeometries[key] = new THREE.SphereGeometry(size, 8, 8);
            }
        }
        return stateRef.current.sharedGeometries[key];
    };

    // Get or create a cached emoji texture
    const getEmojiTexture = (emoji: string): THREE.CanvasTexture => {
        if (stateRef.current.emojiTextureCache.has(emoji)) {
            return stateRef.current.emojiTextureCache.get(emoji)!;
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        const resolution = 64;
        canvas.width = resolution;
        canvas.height = resolution;

        context.font = `${resolution * 0.7}px serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(emoji, resolution / 2, resolution / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        stateRef.current.emojiTextureCache.set(emoji, texture);
        return texture;
    };

    // Create a sprite with a cached emoji texture
    const createEmojiSprite = (emoji: string, size: number, opacityMultiplier: number = 1.0): THREE.Sprite => {
        const texture = getEmojiTexture(emoji);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: opacityMultiplier,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(size, size, 1);
        return sprite;
    };

    // Simple, performant bloom shape using layered spheres
    const createBloomShape = (
        group: THREE.Group,
        scale: number,
        palette: { petal: string; center: string; glow: string },
        isAnimating: boolean,
        opacityMultiplier: number = 1.0,
        emoji: string = '🌸'
    ) => {
        const haloGeometry = getSharedGeometry('halo', 1);
        const haloMaterial = new THREE.MeshBasicMaterial({
            color: palette.petal,
            transparent: true,
            opacity: 0.5 * opacityMultiplier
        });
        const halo = new THREE.Mesh(haloGeometry, haloMaterial);
        halo.scale.setScalar(scale * 1.3);
        group.add(halo);

        const petalGeometry = getSharedGeometry('core', 1);
        const petalMaterial = new THREE.MeshBasicMaterial({
            color: palette.petal,
            transparent: true,
            opacity: 0.85 * opacityMultiplier
        });
        const petalSphere = new THREE.Mesh(petalGeometry, petalMaterial);
        petalSphere.scale.setScalar(scale * 0.95);
        group.add(petalSphere);

        const emojiSprite = createEmojiSprite(emoji, scale * 1.8, opacityMultiplier);
        group.add(emojiSprite);

        return group;
    };

    const createFlowerObject = (node: Node): THREE.Group => {
        const isGlowing = stateRef.current.glowingNodes.has(node.id);
        const palette = getFlowerPalette(node);
        const emoji = getCategoryEmoji(node.category);
        const nodeSize = node.size || CONFIG.nodeBaseSize;
        const baseScale = nodeSize;

        const isFiltered = stateRef.current.highlightedCategory && node.category !== stateRef.current.highlightedCategory;
        const opacityMultiplier = isFiltered ? 0.12 : 1.0;

        const group = new THREE.Group();

        if (isGlowing && !isFiltered) {
            const startTime = stateRef.current.glowingNodes.get(node.id)!;
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / CONFIG.glowDuration, 1);
            const bloomScale = easeOutBack(progress);

            const glowSize = baseScale * (1.8 + (1 - progress) * 1.5);
            const glowGeometry = getSharedGeometry('glow', 1);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: palette.glow,
                transparent: true,
                opacity: 0.4 * (1 - progress * 0.8),
            });
            const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
            glowMesh.scale.setScalar(glowSize);
            group.add(glowMesh);

            createBloomShape(group, baseScale * bloomScale, palette, true, opacityMultiplier, emoji);
        } else {
            createBloomShape(group, baseScale, palette, false, opacityMultiplier, emoji);
        }

        return group;
    };

    const initGraph = (ForceGraph3DArg: any) => {
        if (!containerRef.current) return;
        const ForceGraph3D = ForceGraph3DArg;

        const graph = ForceGraph3D()(containerRef.current)
            .backgroundColor(CONFIG.backgroundColor)
            .showNavInfo(false)
            .enableNavigationControls(true)
            .enablePointerInteraction(true)
            .nodeLabel((node: any) => {
                const n = node as Node;
                const palette = getFlowerPalette(n);
                const emoji = getCategoryEmoji(n.category);
                return `<div style="margin: 0px; padding: 0px; background: #fdfcfa;">
                    <div style="padding: 12px; background: rgba(255, 255, 255, 0.98); box-shadow: 0 8px 32px rgba(0,0,0,0.08); border-radius: 14px; max-width: 280px; font-family: Inter, sans-serif; border: 1px solid ${palette.petal}40;">
                        <div style="font-size: 11px; color: ${palette.petal}; margin-bottom: 6px; font-weight: 500;">${emoji} ${n.category}</div>
                        <strong style="color: #4a4540; font-size: 13px; line-height: 1.4;">${n.title}</strong><br>
                        <span style="color: #8a7e72; font-size: 11px;">${formatDate(n.date)}</span>
                    </div>
                </div>`;
            })
            .nodeColor((node: any) => getNodeColor(node as Node))
            .nodeOpacity(0.95)
            .nodeVal((node: any) => (node as Node).size || CONFIG.nodeBaseSize)
            .nodeRelSize(5)
            .nodeThreeObject((node: any) => createFlowerObject(node as Node))
            .nodeThreeObjectExtend(false)
            .linkColor((link: any) => getLinkColor(link as GraphLink))
            .linkOpacity(CONFIG.linkOpacity)
            .linkWidth(() => CONFIG.linkWidth)
            .linkCurvature(0.25)
            .linkCurveRotation((link: any) => {
                const sourceId = typeof link.source === 'object' ? (link.source as Node).id : link.source;
                const hash = (sourceId as string).split('').reduce((a: number, b: string) => (a * 31 + b.charCodeAt(0)) | 0, 0);
                return (hash % 360) * Math.PI / 180;
            })
            .numDimensions(3)
            .d3AlphaDecay(0.04)
            .d3VelocityDecay(0.3)
            .onNodeClick((node: any) => {
                const n = node as Node;
                if (n.x === undefined || n.y === undefined || n.z === undefined) return;

                if (stateRef.current.isPlaying) pauseAnimation();
                setSelectedNode(n);

                const distance = 80;
                graphRef.current.cameraPosition(
                    { x: n.x + distance, y: n.y + distance * 0.4, z: n.z + distance },
                    { x: n.x, y: n.y, z: n.z },
                    1500
                );
                stateRef.current.networkCenter = { x: n.x, y: n.y, z: n.z };
                stateRef.current.userInteracting = true;
            })
            .onBackgroundClick(() => {
                setSelectedNode(null);
                stateRef.current.userInteracting = false;
            });

        // Configure 3D forces for garden-like distribution
        graph.d3Force('charge', d3.forceManyBody().strength(-50).distanceMax(250));
        graph.d3Force('link', d3.forceLink().id((d: any) => d.id).distance(50).strength(0.15));
        graph.d3Force('center', d3.forceCenter(0, 0));
        graph.d3Force('collision', d3.forceCollide().radius((node: any) => ((node as Node).size || CONFIG.nodeBaseSize) * 2).iterations(1));

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
                if (stateRef.current.isPlaying) pauseAnimation();
                if (stateRef.current.interactionTimeout) clearTimeout(stateRef.current.interactionTimeout);
            });

            controls.addEventListener('end', () => {
                stateRef.current.userInteracting = false;
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
        setCurrentDate(stateRef.current.uniqueDates[0] || 'planting...');
        setProgress(0);
        setRecentLabels([]);
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

                    let labelText = '';
                    if (node.keywords && node.keywords.length > 0) {
                        labelText = node.keywords[0];
                    } else if (node.title) {
                        labelText = node.title.split(' ').slice(0, 2).join(' ');
                    } else {
                        labelText = node.category || 'Article';
                    }

                    stateRef.current.floatingLabels.set(nodeId, {
                        startTime: Date.now(),
                        text: labelText
                    });

                    const newLabel = { id: nodeId, text: labelText, timestamp: Date.now() };
                    setRecentLabels(prev => {
                        const updated = [...prev, newLabel];
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

    let lastGlowUpdate = 0;
    const GLOW_UPDATE_INTERVAL = 100;

    const startGlowAnimation = () => {
        const animate = () => {
            const now = Date.now();

            if (now - lastGlowUpdate > GLOW_UPDATE_INTERVAL) {
                lastGlowUpdate = now;

                let hasGlowingNodes = false;
                for (const [nodeId, startTime] of stateRef.current.glowingNodes) {
                    if (now - startTime > CONFIG.glowDuration) {
                        stateRef.current.glowingNodes.delete(nodeId);
                    } else {
                        hasGlowingNodes = true;
                    }
                }

                if (hasGlowingNodes && graphRef.current) {
                    graphRef.current.nodeThreeObject((node: Node) => createFlowerObject(node));
                }
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
            requestAnimationFrame(animate);
        };
        animate();
    };

    const startAutoOrbit = () => {
        const animate = () => {
            if (!graphRef.current) {
                requestAnimationFrame(animate);
                return;
            }

            if (stateRef.current.autoOrbit && !stateRef.current.userInteracting && graphRef.current) {
                const graph = graphRef.current;
                const currentPos = graph.cameraPosition();
                const controls = graph.controls();
                const target = controls ? controls.target : new THREE.Vector3(
                    stateRef.current.networkCenter.x,
                    stateRef.current.networkCenter.y,
                    stateRef.current.networkCenter.z
                );

                const offset = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z).sub(target);
                const spherical = new THREE.Spherical().setFromVector3(offset);
                spherical.theta += CONFIG.cameraOrbitSpeed * 0.5 * stateRef.current.speed;

                const newOffset = new THREE.Vector3().setFromSpherical(spherical);
                const newPos = new THREE.Vector3().copy(target).add(newOffset);

                graph.cameraPosition(
                    { x: newPos.x, y: newPos.y, z: newPos.z },
                    { x: target.x, y: target.y, z: target.z },
                    0
                );
            }

            requestAnimationFrame(animate);
        };
        animate();
    };

    const toggleAutoOrbit = () => {
        const newAutoOrbit = !stateRef.current.autoOrbit;
        stateRef.current.autoOrbit = newAutoOrbit;
        setAutoOrbit(newAutoOrbit);

        if (newAutoOrbit && graphRef.current) {
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

    const calculateAverageDistance = (center: { x: number; y: number; z: number }) => {
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
            const dx = pos.x - center.x;
            const dz = pos.z - center.z;
            stateRef.current.orbitAngle = Math.atan2(dx, dz);
        }
    };

    return (
        <div className="relative w-full h-screen bg-[#fdfcfa] text-[#5d5347] overflow-hidden light" data-theme="light" style={{ colorScheme: 'light' }}>
            {/* Loading Screen */}
            <div id="loading-screen" className={`${isLoading ? '' : 'hidden'}`}>
                <div className="loader-container">
                    <div className="loader-ring"></div>
                    <div className="loader-ring"></div>
                    <div className="loader-ring"></div>
                    <h2 className="loader-text">Growing the Garden</h2>
                    <p className="loader-subtext">Planting Seeds of Positive News...</p>
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
                        <Link href="https://raihankalla.id/data" className="control-btn" style={{ border: 'none', background: 'transparent', padding: 0 }} title="Back to Home">
                            <svg className="icon" viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                            </svg>
                        </Link>
                        <div className="title-content">
                            <h1>Good News Garden</h1>
                            <span className="subtitle">Watch Positivity Bloom Over Time</span>
                        </div>
                    </div>
                    <div className="stats-container">
                        <div className="stat-item">
                            <span className="stat-value">{stats.nodes}</span>
                            <span className="stat-label">Blooms</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats.links}</span>
                            <span className="stat-label">Vines</span>
                        </div>
                    </div>
                </header>

                {/* Date Display */}
                <div className="date-display pointer-events-auto">
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
                        <label>speed</label>
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
                            style={{ borderColor: autoOrbit ? 'var(--accent-leaf)' : '', color: autoOrbit ? 'var(--accent-leaf)' : '' }}
                            title="Toggle Auto-Orbit"
                        >
                            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                        </button>
                        <button
                            className="control-btn"
                            onClick={toggleAutoZoom}
                            style={{ borderColor: autoZoom ? 'var(--accent-leaf)' : '', color: autoZoom ? 'var(--accent-leaf)' : '' }}
                            title="Toggle Auto-Zoom"
                        >
                            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /><path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z" /></svg>
                        </button>
                        <button className="control-btn" onClick={() => fitCameraToNetwork(true)} title="Center View">
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
                        <div className="info-category" style={{ background: `linear-gradient(135deg, ${getFlowerPalette(selectedNode).petal}, ${getFlowerPalette(selectedNode).glow})` }}>
                            {getCategoryEmoji(selectedNode.category)} {selectedNode.category || 'Article'}
                        </div>
                        <h3 className="info-title">{selectedNode.title}</h3>
                        <div className="info-date">{formatDate(selectedNode.date)}</div>

                        {selectedNode.keywords && (
                            <div className="info-keywords">
                                {selectedNode.keywords.map((kw, i) => (
                                    <span key={i} className="keyword-tag" style={{
                                        background: `${getFlowerPalette(selectedNode).petal}20`,
                                        borderColor: getFlowerPalette(selectedNode).petal,
                                        color: getFlowerPalette(selectedNode).glow
                                    }}>{kw}</span>
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
                                        <a href={selectedNode.url} target="_blank" rel="noopener noreferrer" style={{ color: getFlowerPalette(selectedNode).glow, textDecoration: 'none', fontWeight: 'bold', marginLeft: '5px' }}>
                                            (Read more 🌱)
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
                                style={{ top: '3px', right: '3px', fontSize: '1rem' }}
                            >&times;</button>
                            <h4>Garden Guide</h4>
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
                                        <span className="legend-color" style={{ background: `linear-gradient(135deg, ${item.color}, ${FLOWER_PALETTES[item.tag]?.center || item.color})` }}>{item.emoji}</span>
                                        <span>{item.tag}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Text Stream Toggle (Mobile) */}
                {!showCarousel && (
                    <button
                        id="stream-toggle"
                        className="control-btn md:hidden"
                        onClick={() => setShowCarousel(true)}
                        title="Show Keywords"
                    >
                        <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 15h16v-2H4v2zm0 4h16v-2H4v2zm0-8h16V9H4v2zm0-6v2h16V5H4z" />
                        </svg>
                    </button>
                )}

                {/* Vertical Text Stream (Right Side) */}
                <div
                    className={`text-stream pointer-events-none ${showCarousel ? '' : 'hidden'} top-[115px] md:top-1/2 md:-translate-y-1/2`}
                >
                    {/* Close Button (Mobile Only) */}
                    <button
                        className="pointer-events-auto md:hidden mb-2 text-[#5d5347]/50 hover:text-[#5d5347]"
                        onClick={() => setShowCarousel(false)}
                        style={{ fontSize: '1.5rem', lineHeight: '1', position: 'absolute', top: '-30px', right: '0', zIndex: 30 }}
                    >
                        &times;
                    </button>

                    <div className="stream-labels">
                        {recentLabels.map((label, index) => {
                            const listLength = recentLabels.length;
                            const centerIndex = (listLength - 1) / 2;
                            const dist = Math.abs(index - centerIndex);
                            const opacity = Math.max(0.3, 1 - (dist * 0.25));
                            const scale = Math.max(0.85, 1 - (dist * 0.05));
                            const blur = dist > 1.5 ? 'blur(1px)' : 'none';
                            const textShadow = opacity > 0.8 ? '0 0 15px rgba(129, 199, 132, 0.6)' : 'none';

                            return (
                                <div
                                    key={label.id}
                                    className="stream-label"
                                    style={{
                                        opacity: opacity,
                                        transform: `scale(${scale})`,
                                        filter: blur,
                                        textShadow: textShadow
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
