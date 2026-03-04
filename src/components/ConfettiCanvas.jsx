import React, { useEffect, useRef } from 'react';

const ConfettiCanvas = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#22c55e', '#3b82f6', '#eab308', '#ec4899', '#a855f7', '#f97316'];

        for (let i = 0; i < 200; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                w: Math.random() * 10 + 5,
                h: Math.random() * 10 + 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                dx: Math.random() * 4 - 2,
                dy: Math.random() * 3 + 2,
                rot: Math.random() * 360,
                rotSpeed: Math.random() * 10 - 5
            });
        }

        let animationId;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rot * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();

                p.x += p.dx;
                p.y += p.dy;
                p.rot += p.rotSpeed;

                if (p.y > canvas.height) {
                    p.y = -20;
                    p.x = Math.random() * canvas.width;
                }
            });
            animationId = requestAnimationFrame(animate);
        };
        animate();

        return () => cancelAnimationFrame(animationId);
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
};

export default ConfettiCanvas;
