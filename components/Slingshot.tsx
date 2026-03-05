/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getStrategicHint, TargetCandidate } from '../services/geminiService';
import { playShootSound, playPopSound, playLandSound, playUiClick } from '../services/audioService';
import { Point, Bubble, Particle, BubbleColor, DebugInfo, DifficultyLevel, MetricPoint } from '../types';
import { Loader2, Trophy, BrainCircuit, Play, MousePointerClick, Eye, Terminal, AlertTriangle, Target, Lightbulb, Monitor, Gauge, X, Zap, RefreshCw, Menu, BarChart3, Settings, Info, Waves, Anchor, Flame, Map, ChevronRight, Star, Lock, Clock, AlertOctagon, Activity, Heart, Brain, Timer, PieChart, Sparkles, Languages, TrendingUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import bubbleSlingshotIcon from '/bubble_slingshot_icon.png';


const PINCH_THRESHOLD = 0.05;
const GRAVITY = 0.0;
const FRICTION = 0.998;

// Responsive bubble configuration
const getResponsiveConfig = (width: number) => {
    // Mobile: < 768px, Tablet: 768-1024px, Desktop: > 1024px
    if (width < 768) {
        // Mobile - Big bubbles, few columns to fill width
        return {
            BUBBLE_RADIUS: 22,
            GRID_COLS: 8,
            SLINGSHOT_BOTTOM_OFFSET: 180
        };
    } else if (width < 1024) {
        // Tablet
        return {
            BUBBLE_RADIUS: 20,
            GRID_COLS: 10,
            SLINGSHOT_BOTTOM_OFFSET: 200
        };
    } else {
        // Desktop
        return {
            BUBBLE_RADIUS: 22,
            GRID_COLS: 12,
            SLINGSHOT_BOTTOM_OFFSET: 220
        };
    }
};

const MAX_DRAG_DIST = 180;
const MIN_FORCE_MULT = 0.15;
const MAX_FORCE_MULT = 0.45;

const COLOR_KEYS: BubbleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

type GameStage = 'sea' | 'island' | 'volcano';

// Color Helper for Gradients
const adjustColor = (color: string, amount: number) => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));

    const componentToHex = (c: number) => {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };

    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const GeminiSlingshot: React.FC = () => {
    const { t, language, setLanguage, isRTL } = useLanguage();

    const COLOR_CONFIG: Record<BubbleColor, { hex: string, points: number, labelKey: string }> = {
        red: { hex: '#ef5350', points: 100, labelKey: 'red' },
        blue: { hex: '#42a5f5', points: 150, labelKey: 'blue' },
        green: { hex: '#66bb6a', points: 200, labelKey: 'green' },
        yellow: { hex: '#ffee58', points: 250, labelKey: 'yellow' },
        purple: { hex: '#ab47bc', points: 300, labelKey: 'purple' },
        orange: { hex: '#ffa726', points: 500, labelKey: 'orange' }
    };

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameContainerRef = useRef<HTMLDivElement>(null);

    // Game State Refs
    const ballPos = useRef<Point>({ x: 0, y: 0 });
    const ballVel = useRef<Point>({ x: 0, y: 0 });
    const anchorPos = useRef<Point>({ x: 0, y: 0 });
    const isPinching = useRef<boolean>(false);
    const isFlying = useRef<boolean>(false);
    const flightStartTime = useRef<number>(0);
    const bubbles = useRef<Bubble[]>([]);
    const particles = useRef<Particle[]>([]);
    const scoreRef = useRef<number>(0);

    // Progression Refs
    const lastDropTimeRef = useRef<number>(0);
    const gameStartTimeRef = useRef<number>(0);
    const successfulShotsRef = useRef<number>(0);

    const aimTargetRef = useRef<Point | null>(null);
    const isAiThinkingRef = useRef<boolean>(false);

    // AI Request Trigger
    const captureRequestRef = useRef<boolean>(false);

    // History Tracking for Charts
    const metricsHistoryRef = useRef<MetricPoint[]>([]);
    const lastEventRef = useRef<'score' | 'level_up' | 'danger' | null>(null);

    // Current active color (Ref for loop, State for UI)
    const selectedColorRef = useRef<BubbleColor>('red');

    // React State
    const [loading, setLoading] = useState(true);

    // Settings & Progress State
    const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
    const difficultyRef = useRef<DifficultyLevel>('medium');

    const [gameStage, setGameStage] = useState<GameStage>('sea');
    const [unlockedStages, setUnlockedStages] = useState<GameStage[]>(['sea']); // Progression Locking

    const [currentLevel, setCurrentLevel] = useState(1);
    const MAX_LEVELS_PER_STAGE = 5; // Simplified for demo progression

    const [aiHint, setAiHint] = useState<string | null>(null);
    const [aiRationale, setAiRationale] = useState<string | null>(null);
    const [aimTarget, setAimTarget] = useState<Point | null>(null);
    const [score, setScore] = useState(0);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [selectedColor, setSelectedColor] = useState<BubbleColor>('red');
    const [availableColors, setAvailableColors] = useState<BubbleColor[]>([]);
    const [aiRecommendedColor, setAiRecommendedColor] = useState<BubbleColor | null>(null);
    const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
    const [showDebug, setShowDebug] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);

    // Psychology / Analysis State
    const [showPsychology, setShowPsychology] = useState(false);

    // Timer State for Advanced Stages
    const [dropTimerPct, setDropTimerPct] = useState(100);
    const [shakeScreen, setShakeScreen] = useState(false);

    // Menu State
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Fullscreen State
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    // Screen size for responsive config
    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

    // Get responsive configuration based on current screen width
    const config = getResponsiveConfig(screenWidth);
    const { BUBBLE_RADIUS, GRID_COLS, SLINGSHOT_BOTTOM_OFFSET } = config;
    const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);


    useEffect(() => {
        setAiHint(t('systemReady'));
    }, [t]);

    // Track screen resize for responsive config
    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Sync state to ref
    useEffect(() => {
        selectedColorRef.current = selectedColor;
    }, [selectedColor]);

    useEffect(() => {
        difficultyRef.current = difficulty;
    }, [difficulty]);

    useEffect(() => {
        aimTargetRef.current = aimTarget;
    }, [aimTarget]);

    useEffect(() => {
        isAiThinkingRef.current = isAiThinking;
    }, [isAiThinking]);

    // Watch for Score/Level Changes to mark events
    useEffect(() => {
        if (score > 0) lastEventRef.current = 'score';
    }, [score]);

    useEffect(() => {
        if (currentLevel > 1) lastEventRef.current = 'level_up';
    }, [currentLevel]);

    // AUTO-HIDE NOTIFICATIONS
    useEffect(() => {
        if (aiHint) {
            const timer = setTimeout(() => {
                setAiHint(null);
            }, 4000); // Disappear after 4 seconds
            return () => clearTimeout(timer);
        }
    }, [aiHint]);

    // Audio Wrappers with Interaction
    const handleDifficultyChange = (level: DifficultyLevel) => {
        playUiClick();
        setDifficulty(level);
    };

    const handleStageSelect = (stage: GameStage) => {
        if (!unlockedStages.includes(stage)) {
            // Play locked sound or wiggle?
            return;
        }
        playUiClick();
        setGameStage(stage);
        setCurrentLevel(1);
        lastDropTimeRef.current = performance.now();
    };

    const handleColorSelect = (color: BubbleColor) => {
        playUiClick();
        setSelectedColor(color);
    };

    const toggleMenu = () => {
        playUiClick();
        if (!isMenuOpen) {
            // When opening the menu, ensure all other overlays are closed
            setShowDebug(false);
            setShowPsychology(false);
        }
        setIsMenuOpen(!isMenuOpen);
    };

    const handleDebugToggle = (show: boolean) => {
        playUiClick();
        setShowDebug(show);
        if (show) setIsMenuOpen(false);
    };

    const handlePsychologyToggle = (show: boolean) => {
        playUiClick();
        setShowPsychology(show);
        if (show) setIsMenuOpen(false);
    };

    const handleLanguageChange = (lang: 'en' | 'ar') => {
        playUiClick();
        setLanguage(lang);
    };

    const handleRestart = () => {
        playUiClick();
        setIsGameOver(false);
        initGrid(canvasRef.current?.width || 1000, currentLevel, gameStage);
    };

    const handleGoToDashboard = () => {
        playUiClick();
        setIsGameOver(false);
        setIsMenuOpen(true);
        initGrid(canvasRef.current?.width || 1000, currentLevel, gameStage);
    };

    // --- Psychology & Intelligence Metrics Helpers ---
    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    const getPsychometrics = useCallback(() => {
        // 1. Stress Level
        let stressLevel = 10;
        const lowestBubbleY = bubbles.current.reduce((max, b) => b.active ? Math.max(max, b.y) : max, 0);
        const dangerY = anchorPos.current.y - 150;
        const maxY = dangerY;
        const percentFull = Math.min(100, Math.max(0, (lowestBubbleY / maxY) * 100));

        stressLevel = percentFull;
        if (gameStage !== 'sea') stressLevel += 20;
        stressLevel = Math.min(100, stressLevel);

        // 2. Focus Index
        const durationMin = (Date.now() - gameStartTimeRef.current) / 60000;
        const spm = scoreRef.current / (durationMin || 1);
        let focusIndex = Math.min(100, spm / 50);
        if (isAiThinkingRef.current) focusIndex += 10;

        // 3. Cognitive Load
        const bubbleCount = bubbles.current.filter(b => b.active).length;
        const load = Math.min(100, (bubbleCount / (GRID_COLS * 8)) * 100);

        // 4. Strategic IQ
        const baseIQ = 100;
        const stressBonus = Math.max(0, (50 - stressLevel) * 0.5);
        const focusBonus = (focusIndex / 100) * 30;
        const levelBonus = currentLevel * 5;

        const strategicIQ = Math.min(180, Math.floor(baseIQ + stressBonus + focusBonus + levelBonus));

        // 5. Playstyle Archetype
        let archetypeKey = "archetype_Tactician";
        if (strategicIQ > 140) archetypeKey = "archetype_Visionary";
        else if (stressLevel > 75 && focusIndex > 75) archetypeKey = "archetype_ClutchPlayer";
        else if (stressLevel > 75) archetypeKey = "archetype_Reactive";
        else if (focusIndex > 80 && stressLevel < 40) archetypeKey = "archetype_Grandmaster";
        else if (focusIndex > 60) archetypeKey = "archetype_Sniper";
        else if (strategicIQ < 105) archetypeKey = "archetype_Novice";

        const archetype = t(archetypeKey as any);

        return { stressLevel, focusIndex, load, strategicIQ, archetype };
    }, [currentLevel, gameStage, t]); // Added dependencies

    const getBubblePos = (row: number, col: number, width: number) => {
        const config = getResponsiveConfig(width);
        const ROW_HEIGHT = config.BUBBLE_RADIUS * Math.sqrt(3);
        const xOffset = (width - (config.GRID_COLS * config.BUBBLE_RADIUS * 2)) / 2 + config.BUBBLE_RADIUS;
        const isOdd = row % 2 !== 0;
        const x = xOffset + col * (config.BUBBLE_RADIUS * 2) + (isOdd ? config.BUBBLE_RADIUS : 0);
        const y = config.BUBBLE_RADIUS + row * ROW_HEIGHT;
        return { x, y };
    };

    const updateAvailableColors = () => {
        const activeColors = new Set<BubbleColor>();
        bubbles.current.forEach(b => {
            if (b.active) activeColors.add(b.color);
        });
        setAvailableColors(Array.from(activeColors));

        // Level Cleared Logic
        if (activeColors.size === 0 && bubbles.current.length > 0) {
            playLandSound();
            setAiHint(t('levelCleared'));

            setTimeout(() => {
                let nextLevel = currentLevel + 1;

                // Progression Logic
                if (nextLevel > MAX_LEVELS_PER_STAGE) {
                    // Stage Complete
                    if (gameStage === 'sea' && !unlockedStages.includes('island')) {
                        setUnlockedStages(prev => [...prev, 'island']);
                        setAiHint(`${t('stageUnlocked')}: ${t('island')}`);
                    } else if (gameStage === 'island' && !unlockedStages.includes('volcano')) {
                        setUnlockedStages(prev => [...prev, 'volcano']);
                        setAiHint(`${t('stageUnlocked')}: ${t('volcano')}`);
                    }
                    nextLevel = 1; // Loop or stay at max? Resetting to 1 for demo
                }
                setCurrentLevel(nextLevel);
            }, 1500);
        } else if (!activeColors.has(selectedColorRef.current) && activeColors.size > 0) {
            // Auto switch color if current runs out
            const next = Array.from(activeColors)[0];
            setSelectedColor(next);
        }
    };

    const initGrid = useCallback((width: number, lvl: number, stg: GameStage) => {
        const newBubbles: Bubble[] = [];

        // Rows scale slightly with level
        let baseRows = 4;
        // Stage influences density or pattern
        const gapChance = stg === 'sea' ? 0.15 : (stg === 'island' ? 0.1 : 0.05);

        for (let r = 0; r < baseRows; r++) {
            for (let c = 0; c < (r % 2 !== 0 ? GRID_COLS - 1 : GRID_COLS); c++) {
                if (Math.random() > gapChance) {
                    const { x, y } = getBubblePos(r, c, width);
                    newBubbles.push({
                        id: `${r}-${c}-${Date.now()}`,
                        row: r,
                        col: c,
                        x,
                        y,
                        color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
                        active: true
                    });
                }
            }
        }
        bubbles.current = newBubbles;
        updateAvailableColors();
        lastDropTimeRef.current = performance.now(); // Reset drop timer on new grid

        // Trigger initial AI analysis
        setTimeout(() => {
            captureRequestRef.current = true;
        }, 2000);
    }, []);

    // --- CEILING DROP (SHRINKING) MECHANIC ---
    const dropCeiling = useCallback((width: number) => {
        // 1. Shift all existing bubbles down (row + 1)
        bubbles.current.forEach(b => {
            b.row += 1;
            const { x, y } = getBubblePos(b.row, b.col, width);
            b.x = x;
            b.y = y;
        });

        // 2. Add new row at top (row 0)
        const newRowBubbles: Bubble[] = [];
        const colsInRow = GRID_COLS; // Row 0 is always even (full cols) in this logic
        for (let c = 0; c < colsInRow; c++) {
            const { x, y } = getBubblePos(0, c, width);
            newRowBubbles.push({
                id: `new-${Date.now()}-${c}`,
                row: 0,
                col: c,
                x,
                y,
                color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
                active: true
            });
        }
        bubbles.current = [...newRowBubbles, ...bubbles.current];

        // 3. Visual & Audio Feedback
        playLandSound();
        setShakeScreen(true);
        setTimeout(() => setShakeScreen(false), 300);

        // 4. Check Game Over
        const dangerY = anchorPos.current.y - 150;
        const lowestBubble = bubbles.current.reduce((max, b) => Math.max(max, b.y), 0);
        if (lowestBubble > dangerY) {
            setIsGameOver(true);
        }

        updateAvailableColors();
    }, [currentLevel, gameStage, initGrid, t]);

    const createExplosion = (x: number, y: number, color: string) => {
        for (let i = 0; i < 15; i++) {
            particles.current.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                life: 1.0,
                color
            });
        }
    };

    const isPathClear = (target: Bubble) => {
        if (!anchorPos.current) return false;

        const startX = anchorPos.current.x;
        const startY = anchorPos.current.y;
        const endX = target.x;
        const endY = target.y;

        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(distance / (BUBBLE_RADIUS / 2));

        for (let i = 1; i < steps - 2; i++) {
            const t = i / steps;
            const cx = startX + dx * t;
            const cy = startY + dy * t;

            for (const b of bubbles.current) {
                if (!b.active || b.id === target.id) continue;
                const distSq = Math.pow(cx - b.x, 2) + Math.pow(cy - b.y, 2);
                if (distSq < Math.pow(BUBBLE_RADIUS * 1.8, 2)) {
                    return false;
                }
            }
        }
        return true;
    };

    const getAllReachableClusters = (): TargetCandidate[] => {
        const activeBubbles = bubbles.current.filter(b => b.active);
        const uniqueColors = Array.from(new Set(activeBubbles.map(b => b.color))) as BubbleColor[];
        const allClusters: TargetCandidate[] = [];

        // Analyze opportunities for ALL colors
        for (const color of uniqueColors) {
            const visited = new Set<string>();

            for (const b of activeBubbles) {
                if (b.color !== color || visited.has(b.id) && b.active) continue;

                const clusterMembers: Bubble[] = [];
                const queue = [b];
                visited.add(b.id);

                while (queue.length > 0) {
                    const curr = queue.shift()!;
                    clusterMembers.push(curr);

                    const neighbors = activeBubbles.filter(n =>
                        !visited.has(n.id) && n.color === color && isNeighbor(curr, n)
                    );
                    neighbors.forEach(n => {
                        visited.add(n.id);
                        queue.push(n);
                    });
                }

                // Check if this cluster is hittable
                clusterMembers.sort((a, b) => b.y - a.y);
                const hittableMember = clusterMembers.find(m => isPathClear(m));

                if (hittableMember) {
                    const xPct = hittableMember.x / (gameContainerRef.current?.clientWidth || window.innerWidth);
                    let desc = "Center";
                    if (xPct < 0.33) desc = "Left";
                    else if (xPct > 0.66) desc = "Right";

                    allClusters.push({
                        id: hittableMember.id,
                        color: color,
                        size: clusterMembers.length,
                        row: hittableMember.row,
                        col: hittableMember.col,
                        pointsPerBubble: COLOR_CONFIG[color].points,
                        description: `${desc}`
                    });
                }
            }
        }
        return allClusters;
    };

    const checkMatches = (startBubble: Bubble) => {
        const toCheck = [startBubble];
        const visited = new Set<string>();
        const matches: Bubble[] = [];
        const targetColor = startBubble.color;

        while (toCheck.length > 0) {
            const current = toCheck.pop()!;
            if (visited.has(current.id)) continue;
            visited.add(current.id);

            if (current.color === targetColor) {
                matches.push(current);
                const neighbors = bubbles.current.filter(b => b.active && !visited.has(b.id) && isNeighbor(current, b));
                toCheck.push(...neighbors);
            }
        }

        if (matches.length >= 3) {
            // PLAY SOUND FOR POP
            playPopSound(matches.length);

            let points = 0;
            const basePoints = COLOR_CONFIG[targetColor].points;

            matches.forEach(b => {
                b.active = false;
                createExplosion(b.x, b.y, COLOR_CONFIG[b.color].hex);
                points += basePoints;
            });
            // Combo Multiplier
            const multiplier = matches.length > 3 ? 1.5 : 1.0;
            scoreRef.current += Math.floor(points * multiplier);
            setScore(scoreRef.current);
            return true;
        }
        return false;
    };

    const isNeighbor = (a: Bubble, b: Bubble) => {
        const dr = b.row - a.row;
        const dc = b.col - a.col;
        if (Math.abs(dr) > 1) return false;
        if (dr === 0) return Math.abs(dc) === 1;
        if (a.row % 2 !== 0) {
            return dc === 0 || dc === 1;
        } else {
            return dc === -1 || dc === 0;
        }
    };

    const performAiAnalysis = async (screenshot: string) => {
        isAiThinkingRef.current = true;
        setIsAiThinking(true);

        const allClusters = getAllReachableClusters();
        const maxRow = bubbles.current.reduce((max, b) => b.active ? Math.max(max, b.row) : max, 0);
        const canvasWidth = canvasRef.current?.width || 1000;

        getStrategicHint(
            screenshot,
            allClusters,
            maxRow,
            difficultyRef.current,
            language
        ).then(aiResponse => {
            const { hint, debug } = aiResponse;
            setDebugInfo(debug);
            // setAiHint(hint.message); // Disable obtrusive text hint
            // setAiRationale(hint.rationale || null); // Disable obtrusive rationale

            if (typeof hint.targetRow === 'number' && typeof hint.targetCol === 'number') {
                if (hint.recommendedColor) {
                    setAiRecommendedColor(hint.recommendedColor);
                    // setSelectedColor(hint.recommendedColor); // Subtly recommend without forcing
                }
                const pos = getBubblePos(hint.targetRow, hint.targetCol, canvasWidth);
                setAimTarget(pos);
            }

            isAiThinkingRef.current = false;
            setIsAiThinking(false);
        });
    };

    // --- Rendering Helper ---
    const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colorKey: BubbleColor, power: number = 0) => {
        const config = COLOR_CONFIG[colorKey];
        const baseColor = config.hex;

        if (power > 0.1) {
            ctx.save();
            const glowRadius = radius + (power * 20);
            const glowAlpha = power * 0.6;

            const glowGrad = ctx.createRadialGradient(x, y, radius, x, y, glowRadius);
            glowGrad.addColorStop(0, baseColor);
            glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.beginPath();
            ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = glowGrad;
            ctx.globalAlpha = glowAlpha;
            ctx.fill();
            ctx.restore();
        }

        const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
        // Bright white specular highlight offset to the top-left
        grad.addColorStop(0, '#ffffff');
        // Smooth transition to the main color
        grad.addColorStop(0.3, baseColor);
        // Deep shadow at the bottom-right for 3D depth
        grad.addColorStop(0.85, adjustColor(baseColor, -80));
        grad.addColorStop(1, '#000000');

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Inner soft rim light to enhance glass feel
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        // ctx.stroke(); // Removing harsh outline in favor of the inner gradient

        // Sharp glossy reflection light on top
        ctx.beginPath();
        ctx.ellipse(x - radius * 0.25, y - radius * 0.35, radius * 0.4, radius * 0.15, Math.PI / 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();

        // Secondary subtle reflection on bottom right
        ctx.beginPath();
        ctx.ellipse(x + radius * 0.3, y + radius * 0.3, radius * 0.2, radius * 0.1, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();
    };

    // --- Main Game Loop ---

    useEffect(() => {
        if (!videoRef.current || !canvasRef.current || !gameContainerRef.current) return;

        if (gameStartTimeRef.current === 0) {
            gameStartTimeRef.current = Date.now();
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const container = gameContainerRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        anchorPos.current = { x: canvas.width / 2, y: canvas.height - SLINGSHOT_BOTTOM_OFFSET };
        ballPos.current = { ...anchorPos.current };

        initGrid(canvas.width, currentLevel, gameStage);

        let camera: any = null;
        let hands: any = null;

        const onResults = (results: any) => {
            setLoading(false);

            if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                anchorPos.current = { x: canvas.width / 2, y: canvas.height - SLINGSHOT_BOTTOM_OFFSET };
                if (!isFlying.current && !isPinching.current) {
                    ballPos.current = { ...anchorPos.current };
                }
            }

            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Removed video rendering to show CSS background instead

            const now = performance.now();
            let dropInterval = Infinity;

            if (gameStage === 'island') dropInterval = 20000;
            if (gameStage === 'volcano') dropInterval = 10000;

            // Dynamic Difficulty Adjustment based on stress
            const lowestBubbleY = bubbles.current.reduce((max, b) => b.active ? Math.max(max, b.y) : max, 0);
            const dangerY = anchorPos.current.y - 150;
            const stressLevel = Math.min(100, Math.max(0, (lowestBubbleY / dangerY) * 100));
            if (stressLevel > 80 && dropInterval !== Infinity) {
                dropInterval *= 1.5; // Give player 50% more time if stressed
            }

            if (!isMenuOpen && !isGameOver && dropInterval !== Infinity) {
                const elapsed = now - lastDropTimeRef.current;
                if (elapsed > dropInterval) {
                    dropCeiling(canvas.width);
                    lastDropTimeRef.current = now;
                }
                const newPct = Math.max(0, 100 - (elapsed / dropInterval) * 100);
                if (Math.floor(newPct) !== Math.floor(dropTimerPct)) {
                    setDropTimerPct(newPct);
                }
            }

            let handPos: Point | null = null;
            let pinchDist = 1.0;

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];
                const idxTip = landmarks[8];
                const thumbTip = landmarks[4];

                const rawHandX = (idxTip.x * canvas.width + thumbTip.x * canvas.width) / 2;
                const rawHandY = (idxTip.y * canvas.height + thumbTip.y * canvas.height) / 2;

                // Gesture Smoothing (Lerp)
                if (isPinching.current && ballPos.current) {
                    handPos = {
                        x: ballPos.current.x + (rawHandX - ballPos.current.x) * 0.4,
                        y: ballPos.current.y + (rawHandY - ballPos.current.y) * 0.4
                    };
                } else {
                    handPos = { x: rawHandX, y: rawHandY };
                }

                const dx = idxTip.x - thumbTip.x;
                const dy = idxTip.y - thumbTip.y;
                pinchDist = Math.sqrt(dx * dx + dy * dy);

                if (window.drawConnectors && window.drawLandmarks) {
                    window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#669df6', lineWidth: 1 });
                    window.drawLandmarks(ctx, landmarks, { color: '#aecbfa', lineWidth: 1, radius: 2 });
                }

                ctx.beginPath();
                ctx.arc(handPos.x, handPos.y, 20, 0, Math.PI * 2);
                ctx.strokeStyle = pinchDist < PINCH_THRESHOLD ? '#66bb6a' : '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Block input if menu is open or game is over
            const canInteract = !isMenuOpen && !isGameOver;

            if (canInteract && handPos && pinchDist < PINCH_THRESHOLD && !isFlying.current) {
                const distToBall = Math.sqrt(Math.pow(handPos.x - ballPos.current.x, 2) + Math.pow(handPos.y - ballPos.current.y, 2));
                if (!isPinching.current && distToBall < 100) {
                    isPinching.current = true;
                }

                if (isPinching.current) {
                    ballPos.current = { x: handPos.x, y: handPos.y };
                    const dragDx = ballPos.current.x - anchorPos.current.x;
                    const dragDy = ballPos.current.y - anchorPos.current.y;
                    const dragDist = Math.sqrt(dragDx * dragDx + dragDy * dragDy);

                    if (dragDist > MAX_DRAG_DIST) {
                        const angle = Math.atan2(dragDy, dragDx);
                        ballPos.current.x = anchorPos.current.x + Math.cos(angle) * MAX_DRAG_DIST;
                        ballPos.current.y = anchorPos.current.y + Math.sin(angle) * MAX_DRAG_DIST;
                    }
                }
            }
            else if (canInteract && isPinching.current && (!handPos || pinchDist >= PINCH_THRESHOLD)) {
                isPinching.current = false;

                const dx = anchorPos.current.x - ballPos.current.x;
                const dy = anchorPos.current.y - ballPos.current.y;
                const stretchDist = Math.sqrt(dx * dx + dy * dy);

                if (stretchDist > 30) {
                    playShootSound();

                    isFlying.current = true;
                    flightStartTime.current = performance.now();
                    const powerRatio = Math.min(stretchDist / MAX_DRAG_DIST, 1.0);
                    const velocityMultiplier = MIN_FORCE_MULT + (MAX_FORCE_MULT - MIN_FORCE_MULT) * (powerRatio * powerRatio);

                    ballVel.current = {
                        x: dx * velocityMultiplier,
                        y: dy * velocityMultiplier
                    };
                    successfulShotsRef.current += 1; // Increment successful shots
                } else {
                    ballPos.current = { ...anchorPos.current };
                }
            }
            else if (!isFlying.current && !isPinching.current) {
                const dx = anchorPos.current.x - ballPos.current.x;
                const dy = anchorPos.current.y - ballPos.current.y;
                ballPos.current.x += dx * 0.15;
                ballPos.current.y += dy * 0.15;
            }

            // --- Physics ---
            const gridRows = 8;
            if (isFlying.current) {
                if (performance.now() - flightStartTime.current > 5000) {
                    isFlying.current = false;
                    ballPos.current = { ...anchorPos.current };
                    ballVel.current = { x: 0, y: 0 };
                } else {
                    const currentSpeed = Math.sqrt(ballVel.current.x ** 2 + ballVel.current.y ** 2);
                    const steps = Math.ceil(currentSpeed / (BUBBLE_RADIUS * 0.8));
                    let collisionOccurred = false;

                    for (let i = 0; i < steps; i++) {
                        ballPos.current.x += ballVel.current.x / steps;
                        ballPos.current.y += ballVel.current.y / steps;

                        if (ballPos.current.x < BUBBLE_RADIUS || ballPos.current.x > canvas.width - BUBBLE_RADIUS) {
                            ballVel.current.x *= -1;
                            ballPos.current.x = Math.max(BUBBLE_RADIUS, Math.min(canvas.width - BUBBLE_RADIUS, ballPos.current.x));
                        }

                        if (ballPos.current.y < BUBBLE_RADIUS) {
                            collisionOccurred = true;
                            break;
                        }

                        for (const b of bubbles.current) {
                            if (!b.active) continue;
                            const dist = Math.sqrt(
                                Math.pow(ballPos.current.x - b.x, 2) +
                                Math.pow(ballPos.current.y - b.y, 2)
                            );
                            if (dist < BUBBLE_RADIUS * 1.8) {
                                collisionOccurred = true;
                                break;
                            }
                        }
                        if (collisionOccurred) break;
                    }

                    ballVel.current.y += GRAVITY;
                    ballVel.current.x *= FRICTION;
                    ballVel.current.y *= FRICTION;

                    if (collisionOccurred) {
                        isFlying.current = false;
                        playLandSound();

                        let bestDist = Infinity;
                        let bestRow = 0;
                        let bestCol = 0;
                        let bestX = 0;
                        let bestY = 0;

                        for (let r = 0; r < gridRows + 5; r++) {
                            const colsInRow = r % 2 !== 0 ? GRID_COLS - 1 : GRID_COLS;
                            for (let c = 0; c < colsInRow; c++) {
                                const { x, y } = getBubblePos(r, c, canvas.width);
                                const occupied = bubbles.current.some(b => b.active && b.row === r && b.col === c);
                                if (occupied) continue;

                                const dist = Math.sqrt(
                                    Math.pow(ballPos.current.x - x, 2) +
                                    Math.pow(ballPos.current.y - y, 2)
                                );

                                if (dist < bestDist) {
                                    bestDist = dist;
                                    bestRow = r;
                                    bestCol = c;
                                    bestX = x;
                                    bestY = y;
                                }
                            }
                        }

                        const newBubble: Bubble = {
                            id: `${bestRow}-${bestCol}-${Date.now()}`,
                            row: bestRow,
                            col: bestCol,
                            x: bestX,
                            y: bestY,
                            color: selectedColorRef.current,
                            active: true
                        };
                        bubbles.current.push(newBubble);
                        checkMatches(newBubble);
                        updateAvailableColors();

                        ballPos.current = { ...anchorPos.current };
                        ballVel.current = { x: 0, y: 0 };
                        captureRequestRef.current = true;
                    }

                    if (ballPos.current.y > canvas.height) {
                        isFlying.current = false;
                        ballPos.current = { ...anchorPos.current };
                        ballVel.current = { x: 0, y: 0 };
                    }
                }
            }

            bubbles.current.forEach(b => {
                if (!b.active) return;
                drawBubble(ctx, b.x, b.y, BUBBLE_RADIUS - 1, b.color);
            });

            const currentAimTarget = aimTargetRef.current;
            const thinking = isAiThinkingRef.current;
            const currentSelected = selectedColorRef.current;
            // Only show trajectory when actively pinching/aiming
            const shouldShowLine = isPinching.current && !isFlying.current;

            if (shouldShowLine) {
                ctx.save();
                const highlightColor = COLOR_CONFIG[currentSelected].hex;

                ctx.beginPath();
                ctx.moveTo(anchorPos.current.x, anchorPos.current.y);

                // Calculate trajectory based on current pull
                const dx = anchorPos.current.x - ballPos.current.x;
                const dy = anchorPos.current.y - ballPos.current.y;
                const stretchDist = Math.sqrt(dx * dx + dy * dy);

                if (stretchDist > 10) {
                    // Simple linear trajectory prediction for visualization
                    ctx.lineTo(anchorPos.current.x + dx * 5, anchorPos.current.y + dy * 5);
                } else {
                    ctx.lineTo(anchorPos.current.x, anchorPos.current.y - 100);
                }

                const time = performance.now();
                const dashOffset = (time / 15) % 30;
                ctx.setLineDash([10, 15]); // Thinner, sparser dashes for subtlety
                ctx.lineDashOffset = -dashOffset;

                ctx.strokeStyle = `rgba(255, 255, 255, 0.4)`; // Subtle white line
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.restore();
            }

            // Subtly glow the AI recommended target bubble
            if (currentAimTarget && !thinking && aiRecommendedColor) {
                ctx.save();
                const highlightColor = COLOR_CONFIG[aiRecommendedColor].hex;
                ctx.beginPath();
                ctx.arc(currentAimTarget.x, currentAimTarget.y, BUBBLE_RADIUS + 5, 0, Math.PI * 2);
                ctx.fillStyle = highlightColor;
                ctx.globalAlpha = 0.3 + Math.sin(performance.now() / 200) * 0.2; // Pulsating glow
                ctx.fill();
                ctx.restore();
            }

            // --- PREMIUM 3D SLINGSHOT LAUNCHER ---
            ctx.save();
            const bandColor = isPinching.current ? '#fdd835' : 'rgba(255,100,100,0.8)'; // Red-ish elastic

            // Draw elastic band BACK part (behind the ball)
            if (!isFlying.current) {
                const backBandGradient = ctx.createLinearGradient(anchorPos.current.x - 45, anchorPos.current.y - 30, ballPos.current.x, ballPos.current.y);
                backBandGradient.addColorStop(0, '#B71C1C'); // Dark Red
                backBandGradient.addColorStop(1, '#FF7043'); // Bright Orange

                ctx.beginPath();
                ctx.moveTo(anchorPos.current.x - 45, anchorPos.current.y - 30); // Left tip
                ctx.lineTo(ballPos.current.x, ballPos.current.y);

                // Dynamic width: thinner as you pull further
                const stretchDist = Math.hypot(anchorPos.current.x - ballPos.current.x, anchorPos.current.y - ballPos.current.y);
                ctx.lineWidth = Math.max(3, 8 - (stretchDist / 40));

                ctx.strokeStyle = backBandGradient;
                ctx.lineCap = 'round';
                ctx.stroke();
            }

            // Draw the Bubble (Loaded Ammunition)
            ctx.save();
            drawBubble(ctx, ballPos.current.x, ballPos.current.y, BUBBLE_RADIUS, selectedColorRef.current);
            ctx.restore();

            // Draw elastic band FRONT part (in front of the ball)
            if (!isFlying.current) {
                const frontBandGradient = ctx.createLinearGradient(anchorPos.current.x + 45, anchorPos.current.y - 30, ballPos.current.x, ballPos.current.y);
                frontBandGradient.addColorStop(0, '#C62828');
                frontBandGradient.addColorStop(1, '#FF8A65');

                ctx.beginPath();
                ctx.moveTo(ballPos.current.x, ballPos.current.y);
                ctx.lineTo(anchorPos.current.x + 45, anchorPos.current.y - 30); // Right tip

                const stretchDist = Math.hypot(anchorPos.current.x - ballPos.current.x, anchorPos.current.y - ballPos.current.y);
                ctx.lineWidth = Math.max(3, 8 - (stretchDist / 40));

                ctx.strokeStyle = frontBandGradient;
                ctx.lineCap = 'round';
                ctx.stroke();

                // Draw a small leather pouch holding the ball connecting the bands
                ctx.beginPath();
                ctx.arc(ballPos.current.x, ballPos.current.y + BUBBLE_RADIUS - 5, 8, 0, Math.PI, false);
                ctx.fillStyle = '#4E342E'; // Leather brown
                ctx.fill();
            }

            // --- Wooden Y-Fork Structure ---

            // 1. Shadow underneath the launcher for 3D depth
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 10;

            const forkGradient = ctx.createLinearGradient(
                anchorPos.current.x - 30, anchorPos.current.y,
                anchorPos.current.x + 30, anchorPos.current.y
            );
            // Rich wood gradient
            forkGradient.addColorStop(0, '#5D3A1A');
            forkGradient.addColorStop(0.3, '#8B5E3C');
            forkGradient.addColorStop(0.7, '#A06E49');
            forkGradient.addColorStop(1, '#3E2108');

            const baseWidthBottom = 22;
            const baseWidthTop = 14;

            ctx.beginPath();
            // Start at bottom left base
            ctx.moveTo(anchorPos.current.x - baseWidthBottom, canvas.height);
            // Go to central split point (bottom of the Y)
            ctx.lineTo(anchorPos.current.x - baseWidthTop, anchorPos.current.y + 30);

            // Curve up to left tip
            ctx.quadraticCurveTo(anchorPos.current.x - 45, anchorPos.current.y + 5, anchorPos.current.x - 55, anchorPos.current.y - 30);
            // Left tip top edge (rounded)
            ctx.arc(anchorPos.current.x - 45, anchorPos.current.y - 30, 10, Math.PI, 0);

            // Curve back down to inner split
            ctx.quadraticCurveTo(anchorPos.current.x - 20, anchorPos.current.y + 15, anchorPos.current.x, anchorPos.current.y + 25);

            // Curve up to inner right tip
            ctx.quadraticCurveTo(anchorPos.current.x + 20, anchorPos.current.y + 15, anchorPos.current.x + 35, anchorPos.current.y - 30);
            // Right tip top edge (rounded)
            ctx.arc(anchorPos.current.x + 45, anchorPos.current.y - 30, 10, Math.PI, 0);

            // Curve down to right base
            ctx.quadraticCurveTo(anchorPos.current.x + 45, anchorPos.current.y + 5, anchorPos.current.x + baseWidthTop, anchorPos.current.y + 30);
            // Go to bottom right base
            ctx.lineTo(anchorPos.current.x + baseWidthBottom, canvas.height);

            ctx.closePath();
            ctx.fillStyle = forkGradient;
            ctx.fill();

            // Disable shadow for details
            ctx.shadowColor = 'transparent';

            // Wood Grain/Highlight Details
            ctx.beginPath();
            ctx.moveTo(anchorPos.current.x - 5, canvas.height);
            ctx.lineTo(anchorPos.current.x - 5, anchorPos.current.y + 30);
            ctx.quadraticCurveTo(anchorPos.current.x - 35, anchorPos.current.y, anchorPos.current.x - 45, anchorPos.current.y - 25);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // Soft highlight
            ctx.stroke();

            // 2. Metal Caps at the tips where bands attach
            const drawMetalCap = (x: number, y: number) => {
                const metalGrad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 6);
                metalGrad.addColorStop(0, '#FFFFFF');
                metalGrad.addColorStop(0.4, '#B0BEC5');
                metalGrad.addColorStop(1, '#455A64');
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fillStyle = metalGrad;
                ctx.fill();
                ctx.strokeStyle = '#263238';
                ctx.lineWidth = 1;
                ctx.stroke();
            };

            drawMetalCap(anchorPos.current.x - 45, anchorPos.current.y - 30);
            drawMetalCap(anchorPos.current.x + 45, anchorPos.current.y - 30);

            // Base stand detail (shadow at bottom)
            ctx.beginPath();
            ctx.ellipse(anchorPos.current.x, canvas.height, 30, 5, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fill();

            ctx.restore();

            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.05;
                if (p.life <= 0) particles.current.splice(i, 1);
                else {
                    ctx.globalAlpha = p.life;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                }
            }

            ctx.restore();

            if (captureRequestRef.current) {
                captureRequestRef.current = false;

                const offscreen = document.createElement('canvas');
                const targetWidth = 480;
                const scale = Math.min(1, targetWidth / canvas.width);

                offscreen.width = canvas.width * scale;
                offscreen.height = canvas.height * scale;

                const oCtx = offscreen.getContext('2d');
                if (oCtx) {
                    oCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);
                    const screenshot = offscreen.toDataURL("image/jpeg", 0.6);
                    setTimeout(() => performAiAnalysis(screenshot), 0);
                }
            }
        };

        if (window.Hands) {
            hands = new window.Hands({
                locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
            });
            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });
            hands.onResults(onResults);
            if (window.Camera) {
                camera = new window.Camera(video, {
                    onFrame: async () => {
                        if (videoRef.current && hands) await hands.send({ image: videoRef.current });
                    },
                    width: 1280,
                    height: 720,
                });
                camera.start();
            }
        }

        // Timer Loop
        const timerInterval = setInterval(() => {
            // Drop logic
            if (gameStage === 'sea') {
                setDropTimerPct(100);
            } else {
                const now = performance.now();
                const interval = gameStage === 'island' ? 20000 : 10000;
                const elapsed = now - lastDropTimeRef.current;
                setDropTimerPct(Math.max(0, 100 - (elapsed / interval) * 100));
            }

            // --- NEW: History Tracking ---
            const { stressLevel, focusIndex } = getPsychometrics();

            const newPoint: MetricPoint = {
                timestamp: Date.now(),
                stress: stressLevel,
                focus: focusIndex,
                event: lastEventRef.current
            };
            lastEventRef.current = null; // Reset event trigger

            metricsHistoryRef.current.push(newPoint);
            if (metricsHistoryRef.current.length > 30) {
                metricsHistoryRef.current.shift(); // Keep last 30 seconds
            }
        }, 1000);

        return () => {
            if (camera) camera.stop();
            if (hands) hands.close();
            clearInterval(timerInterval);
        };
    }, [initGrid, currentLevel, gameStage, dropCeiling, t, language, getPsychometrics, isGameOver, isMenuOpen]); // Added isGameOver, isMenuOpen

    const recColorConfig = aiRecommendedColor ? COLOR_CONFIG[aiRecommendedColor] : null;
    const borderColor = recColorConfig ? recColorConfig.hex : '#444746';

    return (
        <div
            className={`w-full h-screen overflow-hidden relative transition-transform duration-100 text-[#e3e3e3] ${shakeScreen ? 'translate-y-1' : ''}`}
            style={{
                backgroundImage: 'url(/background.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >

            {/* FULL SCREEN GAME AREA */}
            <div ref={gameContainerRef} className="absolute inset-0 w-full h-full">
                {/* Ambient dark overlay for perfect contrast */}
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px] pointer-events-none z-0"></div>
                <video ref={videoRef} className="absolute hidden" playsInline />
                <canvas ref={canvasRef} className="absolute inset-0 z-10" />

                {/* Professional Loading Screen */}
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0a0a09] via-[#1a1a2e] to-[#0f172a] z-50 overflow-hidden">
                        {/* Animated Background Particles */}
                        <div className="absolute inset-0 pointer-events-none">
                            {[...Array(30)].map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute rounded-full opacity-30 animate-float"
                                    style={{
                                        width: `${Math.random() * 120 + 40}px`,
                                        height: `${Math.random() * 120 + 40}px`,
                                        left: `${Math.random() * 100}%`,
                                        top: `${Math.random() * 100}%`,
                                        background: `radial-gradient(circle, ${['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'][Math.floor(Math.random() * 6)]}, transparent 70%)`,
                                        animationDelay: `${Math.random() * 5}s`,
                                        animationDuration: `${Math.random() * 15 + 15}s`,
                                        boxShadow: '0 0 20px rgba(255,255,255,0.05)'
                                    }}
                                />
                            ))}
                        </div>

                        {/* Main Loading Content with Glassmorphism */}
                        <div className="relative z-10 flex flex-col items-center -translate-y-8 glass-panel py-12 px-16 rounded-[4rem] max-w-lg w-full">
                            {/* Logo/Title Area */}
                            <div className="mb-10 text-center relative">
                                <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full"></div>
                                <div className="relative inline-block">
                                    {/* Center Icon (Static, no outer rings) */}
                                    <div className="relative w-32 h-32 flex items-center justify-center">
                                        {/* Circular Icon Container */}
                                        <div className="relative w-28 h-28 rounded-full overflow-hidden bg-black/50 backdrop-blur-md flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.6)] border border-white/20">
                                            <img
                                                src={bubbleSlingshotIcon}
                                                alt="Bubble Slingshot"
                                                className="w-full h-full object-contain object-center rounded-full"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <h1 className="font-title text-4xl sm:text-6xl font-normal mt-10 pb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient drop-shadow-[0_0_20px_rgba(168,85,247,0.7)] tracking-wider whitespace-nowrap">
                                    Bubble Slingshot
                                </h1>
                            </div>

                            {/* Loading Animation */}
                            <div className="flex flex-col items-center gap-8 w-full px-4">
                                {/* Bubble Animation */}
                                <div className="flex items-center justify-center gap-4">
                                    {['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'].map((color, i) => (
                                        <div
                                            key={i}
                                            className="w-4 h-4 rounded-full animate-bounce"
                                            style={{
                                                background: `radial-gradient(circle at 30% 30%, ${color}, ${adjustColor(color, -60)})`,
                                                animationDelay: `${i * 0.15}s`,
                                                boxShadow: `0 0 15px ${color}`
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Progress Bar & Text */}
                                <div className="w-full relative">
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-white text-sm font-bold flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                            <span className="tracking-wide text-white">{t('loading')}</span>
                                        </p>
                                        <p className="text-gray-400 text-xs font-mono tracking-widest animate-pulse uppercase">Initializing...</p>
                                    </div>
                                    <div className="w-full bg-black/60 rounded-full h-2.5 overflow-hidden backdrop-blur-sm border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                                        <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-loading-bar shadow-[0_0_10px_rgba(168,85,247,0.8)]"></div>
                                    </div>
                                </div>

                                {/* Premium Feature Hints Cards */}
                                <div className="mt-4 w-full flex overflow-x-auto gap-4 pb-4 no-scrollbar sm:grid sm:grid-cols-3">
                                    {/* AI Hints Card */}
                                    <div className="flex-none w-32 sm:w-auto flex flex-col items-center gap-3 p-4 rounded-3xl glass-panel relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 group-hover:border-purple-400/40 shadow-[inset_0_0_10px_rgba(168,85,247,0.1)] transition-colors">
                                            <BrainCircuit className="w-6 h-6 text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)] group-hover:scale-110 transition-transform" />
                                        </div>
                                        <span className="text-[11px] text-gray-300 font-bold text-center uppercase tracking-widest relative z-10 group-hover:text-white transition-colors">AI Hints</span>
                                    </div>

                                    {/* Gestures Card */}
                                    <div className="flex-none w-32 sm:w-auto flex flex-col items-center gap-3 p-4 rounded-3xl glass-panel relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 group-hover:border-blue-400/40 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)] transition-colors">
                                            <Waves className="w-6 h-6 text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)] group-hover:scale-110 transition-transform" />
                                        </div>
                                        <span className="text-[11px] text-gray-300 font-bold text-center uppercase tracking-widest relative z-10 group-hover:text-white transition-colors">Gestures</span>
                                    </div>

                                    {/* Stages Card */}
                                    <div className="flex-none w-32 sm:w-auto flex flex-col items-center gap-3 p-4 rounded-3xl glass-panel relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
                                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 group-hover:border-yellow-400/40 shadow-[inset_0_0_10px_rgba(234,179,8,0.1)] transition-colors">
                                            <Trophy className="w-6 h-6 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)] group-hover:scale-110 transition-transform z-10" />
                                        </div>
                                        <span className="text-[11px] text-gray-300 font-bold text-center uppercase tracking-widest relative z-10 group-hover:text-white transition-colors">Stages</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Copyright */}
                        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 text-center opacity-70 w-full px-4">
                            <p className={`text-gray-400 text-[10px] sm:text-xs font-medium tracking-widest leading-relaxed ${isRTL ? 'font-arabic' : ''}`}>
                                {isRTL ? (
                                    <>جميع الحقوق محفوظة © {new Date().getFullYear()}</>
                                ) : (
                                    <>© {new Date().getFullYear()} ALL RIGHTS RESERVED</>
                                )}
                            </p>
                            <p className={`text-blue-400/80 text-[10px] mt-2 font-bold tracking-[0.2em] uppercase neon-text-blue ${isRTL ? 'font-arabic' : ''}`}>
                                {isRTL ? (
                                    <>مطور: المهندس عبد الصمد بوركيبات</>
                                ) : (
                                    <>Developed by Abdessamad Bourkibate</>
                                )}
                            </p>
                        </div>
                    </div>
                )}

                {/* Danger Timer Bar (Only for advanced stages) */}
                {gameStage !== 'sea' && (
                    <div className="absolute top-0 left-0 w-full z-30">
                        <div className="h-1.5 w-full bg-black/50 backdrop-blur-sm">
                            <div
                                className={`h-full transition-all duration-100 ease-linear ${dropTimerPct < 30 ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}`}
                                style={{ width: `${dropTimerPct}%` }}
                            />
                        </div>
                        {dropTimerPct < 30 && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-red-500 font-bold text-sm bg-black/40 px-3 py-1 rounded-full border border-red-500/30 animate-pulse">
                                <AlertOctagon className="w-4 h-4" />
                                <span>{t('dangerShrinking')}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* HUD: Interaction Controls Row (Menu, Tips, Fullscreen) */}
                {!loading && (
                    <div className="absolute bottom-[9rem] sm:bottom-[11rem] left-0 w-full px-4 sm:px-6 z-50 flex items-center justify-between pointer-events-none">
                        {/* LEFT: Menu / Control HUB */}
                        <div className={`flex flex-1 ${isRTL ? 'justify-end' : 'justify-start'} pointer-events-auto`}>
                            <button
                                onClick={toggleMenu}
                                className={`flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl glass-panel text-white/90 hover:bg-white/10 hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] hover:border-purple-400/60 hover:-translate-y-1 transition-all duration-300 active:scale-95 group shadow-[inset_0_1px_rgba(255,255,255,0.1),0_5px_15px_rgba(0,0,0,0.5)]`}
                                title="Open Menu"
                            >
                                <Menu className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                                <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-[0.2em] neon-text-purple">
                                    {t('menu')}
                                </span>
                            </button>
                        </div>

                        {/* CENTER: Empty for balance */}
                        <div className="flex-1 flex justify-center pointer-events-none"></div>

                        {/* RIGHT: System Utilities (Fullscreen) */}
                        <div className={`flex flex-1 ${isRTL ? 'justify-start' : 'justify-end'} pointer-events-auto`}>
                            <button
                                onClick={toggleFullscreen}
                                className={`flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl glass-panel text-white/90 hover:bg-white/10 hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] hover:border-blue-400/60 hover:-translate-y-1 transition-all duration-300 active:scale-95 group shadow-[inset_0_1px_rgba(255,255,255,0.1),0_5px_15px_rgba(0,0,0,0.5)]`}
                                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                            >
                                {isFullscreen ? (
                                    <Monitor className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                ) : (
                                    <Zap className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" />
                                )}
                                <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-[0.2em] neon-text-blue">
                                    {isFullscreen ? t('exit') : t('fullscreen')}
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {/* HUD: Professional Glassmorphism Color Dock */}
                <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 z-40 w-full max-w-[95vw] md:max-w-auto flex justify-center pointer-events-none">
                    <div className="flex items-center gap-3 sm:gap-4 glass-panel px-4 sm:px-8 py-3 sm:py-4 rounded-[2rem] sm:rounded-[2.5rem] overflow-x-auto no-scrollbar pointer-events-auto relative">
                        {/* Ambient Glow behind dock */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-[2.5rem] blur-xl pointer-events-none"></div>

                        {availableColors.length === 0 ? (
                            <p className="text-xs sm:text-sm text-gray-300 font-bold px-4 sm:px-8 tracking-widest uppercase neon-text-blue">{t('levelCleared')}</p>
                        ) : (
                            COLOR_KEYS.filter(c => availableColors.includes(c)).map(color => {
                                const isSelected = selectedColor === color;
                                const isRecommended = aiRecommendedColor === color;
                                const config = COLOR_CONFIG[color];

                                return (
                                    <button
                                        key={color}
                                        onClick={() => handleColorSelect(color)}
                                        className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-500 transform flex items-center justify-center hover:-translate-y-2 group
                                    ${isSelected ? 'scale-110 z-10' : 'opacity-70 hover:opacity-100 hover:scale-105'}
                                `}
                                    >
                                        {/* Color Circle */}
                                        <div
                                            className={`w-full h-full rounded-full shadow-[inset_0_-6px_10px_rgba(0,0,0,0.5),0_8px_15px_rgba(0,0,0,0.4)] transition-all duration-300
                                                ${isSelected ? 'ring-4 ring-white/80 ring-offset-2 ring-offset-transparent' : 'ring-1 ring-white/20'}`}
                                            style={{
                                                background: `radial-gradient(circle at 35% 25%, ${adjustColor(config.hex, 40)} 0%, ${config.hex} 40%, ${adjustColor(config.hex, -80)} 100%)`,
                                                boxShadow: isSelected
                                                    ? `0 0 25px ${config.hex}, inset 0 -3px 8px rgba(0,0,0,0.6)`
                                                    : `0 6px 12px rgba(0,0,0,0.4), inset 0 -3px 6px rgba(0,0,0,0.5)`
                                            }}
                                        />

                                        {/* Super Glossy Glass Reflections */}
                                        <div className="absolute inset-[1px] rounded-full border-[1.5px] border-white/50 pointer-events-none mix-blend-overlay" />
                                        <div className="absolute top-0.5 left-1 w-4 h-2.5 sm:w-5 sm:h-3 bg-gradient-to-b from-white/90 to-transparent rounded-full transform -rotate-45 opacity-90 pointer-events-none mix-blend-overlay" />
                                        <div className="absolute bottom-1 right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/40 blur-[1px] pointer-events-none" />

                                        {isRecommended && !isSelected && (
                                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-yellow-300 to-yellow-600 text-black text-[8px] sm:text-[10px] font-black flex items-center justify-center rounded-full shadow-[0_0_15px_rgba(234,179,8,0.8)] border border-yellow-200 animate-bounce z-20">!</span>
                                        )}

                                        {isSelected && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-pulse-glow">
                                                <MousePointerClick className="w-4 h-4 sm:w-6 sm:h-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" strokeWidth={3} />
                                            </div>
                                        )}
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>



                {/* Tactical Guide Toast - AUTO HIDES - Professional Floating Pill */}
                {aiHint && (
                    <div className="absolute bottom-[13rem] sm:bottom-[15rem] left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-500 w-[90%] max-w-md">
                        <div
                            className="mx-auto bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4"
                            style={{ borderLeft: `4px solid ${borderColor}` }}
                        >
                            <Target className="w-5 h-5 shrink-0" style={{ color: borderColor }} />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm text-white font-semibold leading-tight truncate ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {aiHint}
                                </p>
                            </div>
                            {isAiThinking && (
                                <div className="animate-spin text-white/50">
                                    <RefreshCw className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* GAME OVER MODAL */}
            {isGameOver && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 animate-in zoom-in-95 duration-300">
                    <div className="flex flex-col items-center gap-6 p-8 bg-[#09090b] border border-red-500/30 rounded-[3rem] shadow-[0_0_50px_rgba(239,68,68,0.3)] max-w-sm w-full text-center relative overflow-hidden glass-panel">
                        {/* Ambient Red Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-red-600/20 blur-[60px] rounded-full pointer-events-none"></div>
                        <div className="absolute bottom-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>

                        <div className="p-5 bg-red-500/10 rounded-full mb-2 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse-glow">
                            <AlertOctagon className="w-14 h-14 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                        </div>

                        <div className="relative z-10 text-center space-y-2">
                            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-red-300 uppercase tracking-widest leading-none drop-shadow-[0_2px_10px_rgba(239,68,68,0.5)]">{t('gameOver')}</h2>
                            <p className="text-red-400/80 font-bold tracking-wider text-sm uppercase">{t('dangerShrinking')}</p>
                        </div>

                        <div className="flex flex-col gap-4 w-full mt-4 relative z-10">
                            <button
                                onClick={handleRestart}
                                className="w-full py-4 bg-gradient-to-r from-red-600 hover:from-red-500 to-red-800 hover:to-red-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3 active:scale-95"
                            >
                                <RefreshCw className="w-5 h-5" />
                                {t('restartLevel')}
                            </button>

                            <button
                                onClick={handleGoToDashboard}
                                className="w-full py-4 bg-white/5 text-gray-300 font-bold uppercase tracking-widest rounded-2xl border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-300 backdrop-blur-md active:scale-95"
                            >
                                {t('goToDashboard')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DASHBOARD MODAL — Mobile-First Premium Dashboard */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
                    {/* Deep Blur Backdrop */}
                    <div className="absolute inset-0 bg-black/85 backdrop-blur-3xl" onClick={toggleMenu}></div>

                    <div className="w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl bg-zinc-950/90 sm:rounded-[2rem] rounded-t-[2rem] border-t border-x sm:border border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] sm:shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden relative animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[92vh] sm:max-h-[90vh] flex flex-col">

                        {/* Top Gradient Bar */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 z-20"></div>
                        {/* Ambient Glows */}
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-600/15 rounded-full blur-[80px] pointer-events-none"></div>
                        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-600/15 rounded-full blur-[80px] pointer-events-none"></div>

                        {/* Header — Compact for mobile */}
                        <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-3 flex justify-between items-center border-b border-white/5 relative z-10 shrink-0">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-gray-500 tracking-tight">{t('dashboard')}</h2>
                                <p className="text-[10px] sm:text-xs text-indigo-400 font-bold mt-1 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                    {t('campaignProgress')}
                                </p>
                            </div>
                            <button
                                onClick={toggleMenu}
                                className="p-2.5 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-90 group"
                            >
                                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-8 py-5 space-y-5 relative z-10">

                            {/* === SECTION 1: Level Progress & World Map (Most important on mobile) === */}
                            <div className="space-y-4">
                                {/* LEVEL PROGRESS — Compact card */}
                                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                            <Star className="w-3.5 h-3.5 text-yellow-400" /> {t('level')} {currentLevel}
                                        </label>
                                        <span className="text-[10px] text-gray-500">{t('nextUnlock')} {MAX_LEVELS_PER_STAGE + 1}</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-black/50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 rounded-full"
                                            style={{ width: `${(currentLevel / MAX_LEVELS_PER_STAGE) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                {/* WORLD MAP — Horizontal stage selector */}
                                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                            <Map className="w-3.5 h-3.5" /> {t('worldMap')}
                                        </label>
                                        <span className="text-[10px] text-blue-400 font-bold uppercase bg-blue-500/10 px-2 py-0.5 rounded-full">
                                            {t('world')} {gameStage === 'sea' ? '1' : gameStage === 'island' ? '2' : '3'}
                                        </span>
                                    </div>

                                    <div className="relative h-20 w-full bg-black/30 rounded-xl overflow-hidden flex items-center justify-around px-4">
                                        <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-white/10 -translate-y-1/2 z-0" />

                                        {(['sea', 'island', 'volcano'] as GameStage[]).map((stage) => {
                                            const isUnlocked = unlockedStages.includes(stage);
                                            const isActive = gameStage === stage;

                                            let Icon = Waves;
                                            let bgClass = "bg-blue-500";

                                            if (stage === 'island') { Icon = Anchor; bgClass = "bg-teal-500"; }
                                            if (stage === 'volcano') { Icon = Flame; bgClass = "bg-red-500"; }

                                            return (
                                                <button
                                                    key={stage}
                                                    disabled={!isUnlocked}
                                                    onClick={() => handleStageSelect(stage)}
                                                    className={`relative z-10 flex flex-col items-center gap-1.5 transition-all duration-300
                                                        ${isActive ? 'scale-110 opacity-100' : ''}
                                                        ${!isUnlocked ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}
                                                    `}
                                                >
                                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all
                                                        ${isActive ? `${bgClass} border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]` : 'bg-zinc-800 border-white/20'}`}>
                                                        {isUnlocked ? (
                                                            <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                                        ) : (
                                                            <Lock className="w-4 h-4 text-gray-600" />
                                                        )}
                                                    </div>
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-gray-600'}`}>
                                                        {t(stage)}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* === SECTION 2: Performance Trends (Compact on mobile) === */}
                            <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <TrendingUp className="w-4 h-4 text-purple-400" />
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('performanceTrends')}</span>
                                </div>

                                <div className="relative h-24 sm:h-32 w-full bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                                    <svg className="w-full h-full" preserveAspectRatio="none">
                                        <line x1="0" y1="25%" x2="100%" y2="25%" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                                        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                                        <line x1="0" y1="75%" x2="100%" y2="75%" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                                        <path
                                            d={`M 0,${100 - (metricsHistoryRef.current[0]?.focus || 0)} ` +
                                                metricsHistoryRef.current.map((p, i) =>
                                                    `L ${(i / 30) * 100}%,${100 - p.focus}`
                                                ).join(' ')}
                                            fill="none"
                                            stroke="#a855f7"
                                            strokeWidth="2"
                                            className="opacity-80"
                                        />

                                        <path
                                            d={`M 0,${100 - (metricsHistoryRef.current[0]?.stress || 0)} ` +
                                                metricsHistoryRef.current.map((p, i) =>
                                                    `L ${(i / 30) * 100}%,${100 - p.stress}`
                                                ).join(' ')}
                                            fill="none"
                                            stroke="#ef4444"
                                            strokeWidth="2"
                                            className="opacity-80"
                                        />

                                        {metricsHistoryRef.current.map((p, i) => {
                                            if (!p.event) return null;
                                            const yPos = 100 - p.focus;
                                            const color = p.event === 'score' ? '#fbbf24' : '#22c55e';
                                            return (
                                                <circle
                                                    key={i}
                                                    cx={`${(i / 30) * 100}%`}
                                                    cy={`${yPos}%`}
                                                    r="3"
                                                    fill={color}
                                                    className="animate-pulse"
                                                />
                                            );
                                        })}
                                    </svg>
                                </div>
                                <div className="flex justify-between mt-2 px-1">
                                    <div className="flex gap-3">
                                        <div className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                            <span className="text-[9px] text-gray-500 font-bold uppercase">{t('focus')}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                            <span className="text-[9px] text-gray-500 font-bold uppercase">{t('stress')}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                        <span className="text-[9px] text-gray-500 font-bold uppercase">{t('events')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* === SECTION 3: Settings (Language + Difficulty in a row on mobile) === */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* LANGUAGE */}
                                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2 mb-3">
                                        <Languages className="w-3.5 h-3.5" /> {t('language')}
                                    </label>
                                    <div className="flex gap-2 bg-black/30 p-1 rounded-xl">
                                        <button
                                            onClick={() => handleLanguageChange('en')}
                                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${language === 'en' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                        >
                                            English
                                        </button>
                                        <button
                                            onClick={() => handleLanguageChange('ar')}
                                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all font-sans ${language === 'ar' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                        >
                                            العربية
                                        </button>
                                    </div>
                                </div>

                                {/* ASSIST MODE */}
                                <div className="bg-zinc-900/60 p-4 rounded-2xl border border-white/5">
                                    <label className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2 mb-3">
                                        <Gauge className="w-3.5 h-3.5" /> {t('assistMode')}
                                    </label>
                                    <div className="grid grid-cols-3 gap-2 bg-black/30 p-1 rounded-xl">
                                        {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((level) => (
                                            <button
                                                key={level}
                                                onClick={() => handleDifficultyChange(level)}
                                                className={`py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                                    ${difficulty === level
                                                        ? 'bg-white text-black shadow-lg'
                                                        : 'text-gray-500 hover:text-white hover:bg-white/5'}
                                                `}
                                            >
                                                {t(level)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* === SECTION 4: Action Buttons === */}
                            <div className="grid grid-cols-2 gap-3 pb-2">
                                <button
                                    onClick={() => handlePsychologyToggle(true)}
                                    className="col-span-2 flex items-center justify-center gap-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 border border-indigo-500/30 shadow-[0_8px_20px_rgba(79,70,229,0.2)] transition-all active:scale-[0.97] group"
                                >
                                    <div className="p-2 bg-indigo-500/30 rounded-full border border-indigo-400/40">
                                        <Activity className="w-5 h-5 text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.8)]" />
                                    </div>
                                    <span className="text-xs sm:text-sm font-black text-white uppercase tracking-widest">{t('playerAnalysis')}</span>
                                </button>

                                <button
                                    className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-zinc-900/80 border border-white/5 opacity-50 cursor-not-allowed"
                                >
                                    <BarChart3 className="w-4 h-4 text-yellow-500/50" />
                                    <span className="text-xs font-bold text-gray-400">{t('leaderboard')}</span>
                                </button>

                                <button
                                    onClick={handleRestart}
                                    className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-white/10 transition-all active:scale-95 group"
                                >
                                    <RefreshCw className="w-4 h-4 text-orange-400 group-hover:rotate-180 transition-transform duration-500" />
                                    <span className="text-xs font-bold text-gray-300 group-hover:text-white">{t('restartLevel')}</span>
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* PSYCHOLOGY / ANALYSIS MODAL */}
            {showPsychology && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-300">
                    {/* Deep Blur Backdrop */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl transition-opacity pointer-events-none"></div>

                    {/* Changed max-w-md to max-w-5xl for horizontal layout */}
                    <div className="w-full max-w-5xl glass-panel bg-black/60 rounded-[2.5rem] border border-white/10 border-t-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_2px_10px_rgba(255,255,255,0.1)] overflow-hidden relative flex flex-col md:flex-row max-h-[90vh]">
                        {/* High-Tech Decorative Elements */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-20"></div>

                        {/* LEFT PANEL: Header & Key Metrics */}
                        <div className={`w-full md:w-1/3 bg-black/40 backdrop-blur-3xl p-8 border-b md:border-b-0 ${isRTL ? 'md:border-l' : 'md:border-r'} border-white/10 flex flex-col gap-8 relative z-10`}>
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                        <Activity className="w-7 h-7 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 uppercase tracking-wide neon-text-purple">{t('analysis')}</h2>
                                        <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest mt-1">{t('playerState')}</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowPsychology(false)} className="md:hidden p-3 glass-panel rounded-2xl text-gray-400 hover:text-white transition-all transform hover:scale-105 active:scale-95">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Session Duration */}
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-1.5 bg-blue-500/10 rounded-lg"><Timer className="w-4 h-4 text-blue-400" /></div>
                                    <span className="text-xs text-gray-400 font-bold uppercase">{t('sessionTime')}</span>
                                </div>
                                <div className="text-3xl font-mono font-black text-white tracking-tight">
                                    {formatTime(Date.now() - gameStartTimeRef.current)}
                                </div>
                            </div>

                            {/* Cognitive Load (moved to left panel) */}
                            {(() => {
                                const { load } = getPsychometrics();
                                return (
                                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5 flex-1 flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <PieChart className="w-4 h-4 text-orange-400" />
                                                <span className="text-xs font-bold text-gray-500 uppercase">{t('cognitiveLoad')}</span>
                                            </div>
                                            <span className="text-sm text-orange-400 font-bold">{Math.round(load)}%</span>
                                        </div>
                                        <div className="h-3 w-full bg-black/50 rounded-full overflow-hidden mb-2">
                                            <div className={`h-full bg-gradient-to-r from-yellow-500 to-orange-600 transition-all duration-700 ${isRTL ? 'scale-x-[-1]' : ''}`} style={{ width: `${load}%` }} />
                                        </div>
                                        <p className="text-[10px] text-gray-500 leading-tight">{t('loadDesc')}</p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* RIGHT PANEL: Charts & Detailed Metrics */}
                        <div className="w-full md:w-2/3 p-6 bg-[#18181b] flex flex-col gap-6 overflow-y-auto">
                            {/* Close Button Desktop */}
                            <div className={`hidden md:flex ${isRTL ? 'justify-start' : 'justify-end'}`}>
                                <button onClick={() => setShowPsychology(false)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-full text-xs text-gray-400 hover:text-white transition-colors border border-transparent hover:border-white/10">
                                    <span>{t('closeMonitor')}</span>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {(() => {
                                    const { stressLevel, focusIndex, strategicIQ, archetype } = getPsychometrics();
                                    return (
                                        <>
                                            {/* Stress Level */}
                                            <div className="bg-[#202023] p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all">
                                                <div className="flex justify-between items-start mb-4 relative z-10">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('stressLevel')}</span>
                                                    <Heart className={`w-5 h-5 ${stressLevel > 60 ? 'text-red-400 animate-pulse' : 'text-green-400'}`} />
                                                </div>
                                                <div className="text-4xl font-black text-white relative z-10 mb-1">{Math.round(stressLevel)}<span className="text-lg text-gray-500">%</span></div>
                                                <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                                                    <div className={`h-full ${stressLevel > 60 ? 'bg-red-500' : 'bg-green-500'} transition-all duration-1000 ${isRTL ? 'scale-x-[-1]' : ''}`} style={{ width: `${stressLevel}%` }} />
                                                </div>
                                            </div>

                                            {/* Focus Index */}
                                            <div className="bg-[#202023] p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all">
                                                <div className="flex justify-between items-start mb-4 relative z-10">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('focusIndex')}</span>
                                                    <Brain className="w-5 h-5 text-purple-400" />
                                                </div>
                                                <div className="text-4xl font-black text-white relative z-10 mb-1">{Math.round(focusIndex)}</div>
                                                <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                                                    <div className={`h-full bg-purple-500 transition-all duration-1000 ${isRTL ? 'scale-x-[-1]' : ''}`} style={{ width: `${focusIndex}%` }} />
                                                </div>
                                            </div>

                                            {/* NEW: Strategic Intelligence (Full Width or Grid Span) */}
                                            <div className="col-span-2 bg-gradient-to-r from-[#202023] to-[#25252a] p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-all flex justify-between items-center">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Sparkles className="w-4 h-4 text-yellow-400" />
                                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('strategicIntelligence')}</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-3">
                                                        <span className="text-4xl font-black text-white">{strategicIQ}</span>
                                                        <span className="text-sm font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full uppercase tracking-wide border border-yellow-500/20">{archetype}</span>
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 mt-2">{t('iqDesc')}</p>
                                                </div>
                                                <div className="h-16 w-32 hidden sm:flex items-end justify-between gap-1 opacity-50">
                                                    {/* Simple Bar Graph Visual */}
                                                    {[40, 60, 45, 70, 50, 80, 65].map((h, i) => (
                                                        <div key={i} className="w-full bg-yellow-500/40 rounded-t-sm" style={{ height: `${h}%` }}></div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Main Chart */}
                            <div className="flex-1 bg-black/20 p-6 rounded-3xl border border-white/5 flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('realTimeBio')}</span>
                                        <span className="text-[10px] text-gray-600">{t('monitoringSignals')}</span>
                                    </div>
                                    <div className="flex gap-2 items-center bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[10px] text-green-400 font-bold uppercase">{t('live')}</span>
                                    </div>
                                </div>

                                {/* Improved Chart Viz */}
                                <div className="flex-1 flex items-end justify-between gap-1.5 opacity-90 h-32">
                                    {[...Array(30)].map((_, i) => {
                                        const h = 15 + Math.random() * 70;
                                        // Color gradient based on height
                                        const isHigh = h > 60;
                                        const bgClass = isHigh ? 'bg-indigo-400' : 'bg-indigo-500/30';
                                        return (
                                            <div
                                                key={i}
                                                className={`w-full rounded-t-sm transition-all duration-500 ease-in-out hover:bg-indigo-300 ${bgClass}`}
                                                style={{ height: `${h}%` }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DEBUG MODAL */}
            {showDebug && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#18181b] w-full max-w-3xl max-h-[85vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#27272a]">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-black/40 rounded-lg">
                                    <Terminal className="w-4 h-4 text-green-500" />
                                </div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t('systemLogs')}</h2>
                            </div>
                            <button onClick={() => handleDebugToggle(false)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 font-mono text-sm">
                            {/* Status Section */}
                            <div>
                                <div className="flex items-center gap-2 mb-3 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                    <Zap className="w-3 h-3" /> {t('engineStatus')}
                                </div>
                                <div className={`p-4 rounded-xl border ${isAiThinking ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="relative flex h-3 w-3">
                                            {isAiThinking && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>}
                                            <span className={`relative inline-flex rounded-full h-3 w-3 ${isAiThinking ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                                        </span>
                                        <span className="font-bold">{isAiThinking ? t('analyzing') : t('idle')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Vision Input */}
                            {debugInfo?.screenshotBase64 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                        <Eye className="w-3 h-3" /> {t('computerVision')}
                                    </div>
                                    <div className="rounded-xl overflow-hidden border border-white/10 bg-black relative h-48 w-full max-w-md">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={debugInfo.screenshotBase64} alt="System Vision" className="w-full h-full object-contain opacity-80" />
                                        <div className={`absolute bottom-2 ${isRTL ? 'left-2' : 'right-2'} bg-black/60 px-2 py-1 rounded text-[10px] text-white/50`}>SOURCE_FEED_01</div>
                                    </div>
                                </div>
                            )}

                            {/* AI Output Stats */}
                            {debugInfo && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3 text-gray-500 text-xs font-bold uppercase tracking-wider">
                                        <BrainCircuit className="w-3 h-3" /> {t('neuralNet')}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-[#27272a] p-3 rounded-xl border border-white/5">
                                            <p className="text-[10px] text-gray-500 mb-1 uppercase">{t('latency')}</p>
                                            <div className="flex items-center gap-1 text-blue-400 font-bold text-lg">
                                                {debugInfo.latency} <span className="text-xs text-gray-600">ms</span>
                                            </div>
                                        </div>
                                        <div className="bg-[#27272a] p-3 rounded-xl border border-white/5">
                                            <p className="text-[10px] text-gray-500 mb-1 uppercase">{t('strategy')}</p>
                                            <div className="flex items-center gap-1 text-white font-bold capitalize">
                                                {debugInfo.parsedResponse?.recommendedColor || 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    {debugInfo.error && (
                                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-4">
                                            <div className="flex items-start gap-3 text-red-400">
                                                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-bold uppercase">{t('criticalError')}</p>
                                                    <p className="text-xs font-mono mt-1 break-all opacity-80">{debugInfo.error}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                                        <p className="text-[10px] text-gray-500 mb-2 uppercase flex justify-between">
                                            <span>{t('rawJson')}</span>
                                            <span>{debugInfo.rawResponse.length} bytes</span>
                                        </p>
                                        <pre className={`text-[11px] text-green-400 whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed ${isRTL ? 'text-left' : ''} dir="ltr"`}>
                                            {debugInfo.rawResponse}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeminiSlingshot;