/**
 * useSoundManager — Global sound system for Imposter Game
 *
 * Sound files expected in /public/sounds/:
 *   join.mp3, start.mp3, flip.mp3, tick.mp3, vote.mp3, win.mp3, lose.mp3, click.mp3
 *
 * Usage:
 *   const { playSound, isMuted, toggleMute } = useSoundManager();
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Sound file map ────────────────────────────────────────────────────────────
const SOUND_FILES = {
    join:  '/sounds/join.mp3',
    start: '/sounds/start.mp3',
    flip:  '/sounds/flip.mp3',
    tick:  '/sounds/tick.mp3',
    vote:  '/sounds/vote.mp3',
    win:   '/sounds/win.mp3',
    lose:  '/sounds/lose.mp3',
    click: '/sounds/click.mp3',
};

// ── Volume map (0.0 – 1.0) ────────────────────────────────────────────────────
const SOUND_VOLUMES = {
    join:  0.5,
    start: 0.8,
    flip:  0.6,
    tick:  0.4,
    vote:  0.7,
    win:   0.9,
    lose:  0.9,
    click: 0.4,
};

// ── Singleton audio pool (shared across all hook instances) ───────────────────
let audioPool = null;
let mutedState = localStorage.getItem('soundMuted') === 'true';

function getAudioPool() {
    if (!audioPool) {
        audioPool = {};
        for (const [key, src] of Object.entries(SOUND_FILES)) {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.volume = SOUND_VOLUMES[key] ?? 0.6;
            audioPool[key] = audio;
        }
    }
    return audioPool;
}

// ── Subscribers for mute state changes ───────────────────────────────────────
const muteSubscribers = new Set();

function setGlobalMuted(val) {
    mutedState = val;
    localStorage.setItem('soundMuted', val ? 'true' : 'false');
    muteSubscribers.forEach(fn => fn(val));
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSoundManager() {
    const [isMuted, setIsMuted] = useState(mutedState);
    // Track if user has interacted (browser autoplay policy)
    const hasInteracted = useRef(false);

    useEffect(() => {
        // Pre-load audio pool
        getAudioPool();

        // Subscribe to global mute changes
        const handler = (val) => setIsMuted(val);
        muteSubscribers.add(handler);

        // Mark interaction on first user gesture
        const onInteract = () => { hasInteracted.current = true; };
        window.addEventListener('pointerdown', onInteract, { once: true });
        window.addEventListener('keydown', onInteract, { once: true });

        return () => {
            muteSubscribers.delete(handler);
            window.removeEventListener('pointerdown', onInteract);
            window.removeEventListener('keydown', onInteract);
        };
    }, []);

    const playSound = useCallback((type) => {
        if (mutedState) return;
        const pool = getAudioPool();
        const audio = pool[type];
        if (!audio) return;

        try {
            // Reset to start so rapid calls work
            audio.currentTime = 0;
            const promise = audio.play();
            if (promise !== undefined) {
                promise.catch(() => {
                    // Autoplay blocked — silently ignore
                });
            }
        } catch {
            // Ignore any errors
        }
    }, []);

    const toggleMute = useCallback(() => {
        setGlobalMuted(!mutedState);
    }, []);

    return { playSound, isMuted, toggleMute };
}

// ── Standalone helper for use outside React hooks (e.g. in Zustand store) ─────
export function playStoreSound(type) {
    if (mutedState) return;
    const pool = getAudioPool();
    const audio = pool[type];
    if (!audio) return;
    try { audio.currentTime = 0; audio.play().catch(() => {}); } catch {}
}

export default useSoundManager;
