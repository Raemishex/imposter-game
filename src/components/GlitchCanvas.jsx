import React, { useEffect, useRef } from 'react';

const GlitchCanvas = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let animationId;
        let tick = 0;

        const animate = () => {
            tick++;

            // Random static blocks
            if (Math.random() < 0.3) {
                const h = Math.random() * 10 + 2;
                const y = Math.random() * canvas.height;
                ctx.fillStyle = `rgba(255, 0, 0, ${Math.random() * 0.5})`;
                ctx.fillRect(0, y, canvas.width, h);
            }

            // Occasional screen shift
            if (Math.random() < 0.05) {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const shift = Math.floor(Math.random() * 20 - 10);
                ctx.putImageData(imgData, shift, 0);
            }

            // Dark red overlay
            ctx.fillStyle = 'rgba(50, 0, 0, 0.02)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            animationId = requestAnimationFrame(animate);
        };
        animate();

        return () => cancelAnimationFrame(animationId);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0 mix-blend-color-dodge opacity-50"
        />
    );
};

export default GlitchCanvas;
