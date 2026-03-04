import React, { useEffect, useRef } from 'react';

const SheriffCanvasEffect = ({ isVisible, onComplete }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!isVisible) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let particles = [];
        const colors = ['#ef4444', '#f59e0b', '#fbbf24', '#ffffff'];

        // Create particles
        for (let i = 0; i < 100; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                r: Math.random() * 5 + 2,
                dx: (Math.random() - 0.5) * 20,
                dy: (Math.random() - 0.5) * 20,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                decay: Math.random() * 0.02 + 0.015
            });
        }

        let animationId;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;

            // Draw targeting reticle briefly
            ctx.save();
            ctx.globalAlpha = particles[0] ? Math.max(0, particles[0].life) : 0;
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2);
            ctx.stroke();

            // Crosshairs
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2 - 70, canvas.height / 2);
            ctx.lineTo(canvas.width / 2 + 70, canvas.height / 2);
            ctx.moveTo(canvas.width / 2, canvas.height / 2 - 70);
            ctx.lineTo(canvas.width / 2, canvas.height / 2 + 70);
            ctx.stroke();
            ctx.restore();

            // Draw particles
            particles.forEach(p => {
                if (p.life > 0) {
                    alive = true;
                    ctx.save();
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();

                    p.x += p.dx;
                    p.y += p.dy;
                    p.dy += 0.5; // gravity
                    p.life -= p.decay;
                }
            });

            if (alive) {
                animationId = requestAnimationFrame(animate);
            } else {
                if (onComplete) onComplete();
            }
        };

        animate();

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [isVisible, onComplete]);

    if (!isVisible) return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[9999]"
            style={{ width: '100%', height: '100%' }}
        />
    );
};

export default SheriffCanvasEffect;
