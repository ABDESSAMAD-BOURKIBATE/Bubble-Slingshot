/**
 * Performance Trends Dashboard Component
 * Displays real-time performance metrics with heartbeat/ECG visualization
 */

import React, { useEffect, useRef } from 'react';
import { Activity, TrendingUp } from 'lucide-react';

interface PerformanceTrendsProps {
    focusLevel: number;
    stressLevel: number;
    events: number;
}

const PerformanceTrends: React.FC<PerformanceTrendsProps> = ({
    focusLevel,
    stressLevel,
    events
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        let animationId: number;
        let offset = 0;

        const drawHeartbeat = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const centerY = canvas.height / 2;
            const amplitude = 30;
            const speed = 2;

            // Draw grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            for (let i = 0; i < canvas.height; i += 20) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(canvas.width, i);
                ctx.stroke();
            }

            // Draw heartbeat line
            ctx.beginPath();
            ctx.strokeStyle = '#a78bfa'; // Purple for focus
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#a78bfa';

            for (let x = 0; x < canvas.width; x++) {
                const adjustedX = x + offset;
                let y = centerY;

                // Create realistic ECG pattern
                const segment = (adjustedX % 200) / 200;

                if (segment < 0.1) {
                    // P wave (small bump)
                    y = centerY - Math.sin(segment * 10 * Math.PI) * (amplitude * 0.2);
                } else if (segment >= 0.2 && segment < 0.35) {
                    // QRS complex (sharp spike)
                    const qrsSegment = (segment - 0.2) / 0.15;
                    if (qrsSegment < 0.3) {
                        y = centerY + amplitude * 0.3; // Q dip
                    } else if (qrsSegment < 0.6) {
                        y = centerY - amplitude * 1.5; // R spike
                    } else {
                        y = centerY + amplitude * 0.4; // S dip
                    }
                } else if (segment >= 0.5 && segment < 0.7) {
                    // T wave (medium bump)
                    const tSegment = (segment - 0.5) / 0.2;
                    y = centerY - Math.sin(tSegment * Math.PI) * (amplitude * 0.4);
                }

                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();

            // Draw stress line (red)
            ctx.beginPath();
            ctx.strokeStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';

            for (let x = 0; x < canvas.width; x++) {
                const adjustedX = x + offset + 100; // Offset for variation
                let y = centerY;

                const segment = (adjustedX % 200) / 200;

                if (segment < 0.1) {
                    y = centerY - Math.sin(segment * 10 * Math.PI) * (amplitude * 0.15 * (stressLevel / 100));
                } else if (segment >= 0.2 && segment < 0.35) {
                    const qrsSegment = (segment - 0.2) / 0.15;
                    if (qrsSegment < 0.3) {
                        y = centerY + amplitude * 0.2 * (stressLevel / 100);
                    } else if (qrsSegment < 0.6) {
                        y = centerY - amplitude * 1.2 * (stressLevel / 100);
                    } else {
                        y = centerY + amplitude * 0.3 * (stressLevel / 100);
                    }
                } else if (segment >= 0.5 && segment < 0.7) {
                    const tSegment = (segment - 0.5) / 0.2;
                    y = centerY - Math.sin(tSegment * Math.PI) * (amplitude * 0.3 * (stressLevel / 100));
                }

                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();

            offset -= speed;
            animationId = requestAnimationFrame(drawHeartbeat);
        };

        drawHeartbeat();

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [focusLevel, stressLevel]);

    return (
        <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Performance Trends
                </h3>
            </div>

            {/* Heartbeat Canvas */}
            <div className="relative h-32 bg-black/30 rounded-xl overflow-hidden border border-white/5">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    style={{ width: '100%', height: '100%' }}
                />
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-3 text-[10px]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span className="text-gray-400">FOCUS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-gray-400">STRESS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span className="text-gray-400">EVENTS</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerformanceTrends;
