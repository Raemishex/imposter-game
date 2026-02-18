import { useState, useRef, useEffect, useCallback } from 'react';
import useGameStore from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, CheckCircle, Clock } from 'lucide-react';
import { UI_TEXTS } from '../translations';
import Modal from './Modal';
import Chat from './Chat';
import { useSoundManager } from '../hooks/useSoundManager';

const ScreenVote = () => {
    const {
        players,
        castVote,
        currentPlayer,
        language,
        voteUpdate,
        mode,
        returnToLobby,
        leaveRoom,
        chaosEvent
    } = useGameStore();

    const t = UI_TEXTS[language] || UI_TEXTS['az'];
    const { playSound } = useSoundManager();
    const [exitModal, setExitModal] = useState(false);
    const [myVote, setMyVote] = useState(null);
    const [countdown, setCountdown] = useState(null); // optional voting timer

    // Refs for each player card - used to draw SVG arrows
    const cardRefs = useRef({});
    const containerRef = useRef(null);
    const [arrows, setArrows] = useState([]); // [{fromId, toId, color}]

    const alivePlayers = players.filter(p => p.isAlive !== false);
    const votedCount = voteUpdate?.votedCount || 0;
    const totalVoters = voteUpdate?.totalVoters || alivePlayers.length;
    const votes = voteUpdate?.votes || {};
    const hasVoted = myVote !== null;

    // Recalculate arrows whenever votes change
    const recalcArrows = useCallback(() => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newArrows = [];

        Object.entries(votes).forEach(([voterId, targetId]) => {
            if (!targetId || targetId === -1) return;
            const fromEl = cardRefs.current[voterId];
            const toEl = cardRefs.current[targetId];
            if (!fromEl || !toEl) return;

            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();

            const fromX = fromRect.left + fromRect.width / 2 - containerRect.left;
            const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
            const toX = toRect.left + toRect.width / 2 - containerRect.left;
            const toY = toRect.top + toRect.height / 2 - containerRect.top;

            // Color based on who voted (cycle through palette)
            const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
            const colorIdx = Object.keys(votes).indexOf(voterId) % colors.length;

            newArrows.push({ fromId: voterId, toId: targetId, fromX, fromY, toX, toY, color: colors[colorIdx] });
        });

        setArrows(newArrows);
    }, [votes]);

    useEffect(() => {
        // Small delay to ensure DOM is rendered
        const timeout = setTimeout(recalcArrows, 100);
        return () => clearTimeout(timeout);
    }, [recalcArrows, votes]);

    // Tick sound for last 10 seconds (if countdown is active)
    useEffect(() => {
        if (countdown !== null && countdown <= 10 && countdown > 0) {
            playSound('tick');
        }
    }, [countdown, playSound]);

    const handleVote = (targetId) => {
        if (hasVoted) return;
        setMyVote(targetId);
        castVote(targetId);
    };

    const handleSkip = () => {
        if (hasVoted) return;
        setMyVote('skip');
        castVote(-1);
    };

    // Calculate vote counts per player
    const voteCountFor = (playerId) =>
        Object.values(votes).filter(v => v === playerId).length;

    return (
        <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-8 pb-4">
                <button
                    onClick={() => setExitModal(true)}
                    className="p-2 bg-[var(--bg-card)] rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-red-500 transition-colors"
                >
                    <Home className="w-5 h-5" />
                </button>

                <div className="text-center">
                    <motion.h1
                        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                        className="text-2xl font-black text-red-500 tracking-widest"
                    >
                        🗳️ {t.voting}
                    </motion.h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{t.whoIsImposter}</p>
                </div>

                <div className="w-10" />
            </div>

            {/* Chaos Event Banner */}
            {chaosEvent && (
                <div className={`mx-4 mb-2 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold ${
                    chaosEvent === 'blind_round' ? 'bg-gray-800 text-gray-200 border border-gray-600' :
                    chaosEvent === 'double_trouble' ? 'bg-red-900/40 text-red-300 border border-red-700' :
                    'bg-orange-900/40 text-orange-300 border border-orange-700'
                }`}>
                    <span className="text-lg">
                        {chaosEvent === 'blind_round' ? '🙈' : chaosEvent === 'double_trouble' ? '👥' : '⚡'}
                    </span>
                    <span>
                        {chaosEvent === 'blind_round' ? 'Kor Raund: Kateqoriya gizlidir!' :
                         chaosEvent === 'double_trouble' ? 'İkili Bəla: 2 imposter var!' :
                         'Sürət Raund: Vaxt yarıya endirildi!'}
                    </span>
                </div>
            )}

            {/* Vote Progress Bar */}
            <div className="px-4 mb-3">
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1.5">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Səs verənlər
                    </span>
                    <span className="font-black text-[var(--text-primary)]">{votedCount} / {totalVoters}</span>
                </div>
                <div className="w-full bg-[var(--bg-card)] rounded-full h-2 border border-[var(--border-color)]">
                    <motion.div
                        className="h-full bg-red-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: totalVoters > 0 ? `${(votedCount / totalVoters) * 100}%` : '0%' }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            {/* My vote status */}
            <AnimatePresence>
                {hasVoted && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mx-4 mb-3 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2"
                    >
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        <p className="text-sm text-green-400 font-bold">
                            {myVote === 'skip' ? 'Səs verməkdən imtina etdiniz' : 'Səsinizi verdiniz. Digərlərini gözləyin...'}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Player Grid + SVG Arrows overlay */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 relative" ref={containerRef}>

                {/* SVG Arrow Layer */}
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    style={{ overflow: 'visible' }}
                >
                    <defs>
                        {arrows.map((a, i) => (
                            <marker
                                key={`marker-${i}`}
                                id={`arrowhead-${i}`}
                                markerWidth="8" markerHeight="6"
                                refX="8" refY="3"
                                orient="auto"
                            >
                                <polygon points="0 0, 8 3, 0 6" fill={a.color} opacity="0.85" />
                            </marker>
                        ))}
                    </defs>
                    {arrows.map((a, i) => {
                        // Shorten line so it doesn't overlap avatar
                        const dx = a.toX - a.fromX;
                        const dy = a.toY - a.fromY;
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        const pad = 32;
                        const x1 = a.fromX + (dx / len) * pad;
                        const y1 = a.fromY + (dy / len) * pad;
                        const x2 = a.toX - (dx / len) * pad;
                        const y2 = a.toY - (dy / len) * pad;

                        return (
                            <motion.line
                                key={`arrow-${a.fromId}-${a.toId}-${i}`}
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 0.85 }}
                                transition={{ duration: 0.4 }}
                                x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke={a.color}
                                strokeWidth="2.5"
                                strokeDasharray="6 3"
                                markerEnd={`url(#arrowhead-${i})`}
                            />
                        );
                    })}
                </svg>

                {/* Player Cards Grid */}
                <div className="grid grid-cols-2 gap-3 relative z-0">
                    {alivePlayers.map((player, i) => {
                        const isMe = player.id === currentPlayer?.id || player.name === currentPlayer?.name;
                        const iVotedForThis = myVote === player.id;
                        const votesForThis = voteCountFor(player.id);

                        return (
                            <motion.button
                                key={player.id}
                                ref={el => { cardRefs.current[player.id] = el; }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                whileHover={!isMe && !hasVoted ? { scale: 1.04 } : {}}
                                whileTap={!isMe && !hasVoted ? { scale: 0.96 } : {}}
                                onClick={() => !isMe && !hasVoted && handleVote(player.id)}
                                disabled={isMe || hasVoted}
                                className={`
                                    relative p-4 rounded-xl border flex flex-col items-center gap-2 transition-all
                                    ${isMe
                                        ? 'opacity-50 cursor-not-allowed border-[var(--border-color)] bg-[var(--bg-card)]'
                                        : hasVoted
                                            ? iVotedForThis
                                                ? 'border-red-500 bg-red-500/10 cursor-default'
                                                : 'border-[var(--border-color)] bg-[var(--bg-card)] cursor-default opacity-70'
                                            : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-red-500 hover:bg-red-500/10 cursor-pointer'
                                    }
                                `}
                            >
                                {/* Avatar */}
                                <div className="relative w-14 h-14 rounded-full bg-[var(--bg-primary)] border-2 border-[var(--border-color)] flex items-center justify-center overflow-hidden">
                                    {player.avatar
                                        ? <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                                        : <span className="text-2xl font-black text-[var(--accent-color)]">{player.name.charAt(0).toUpperCase()}</span>
                                    }
                                    {/* My vote indicator */}
                                    {iVotedForThis && (
                                        <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center rounded-full">
                                            <span className="text-white text-xl">👆</span>
                                        </div>
                                    )}
                                </div>

                                {/* Name */}
                                <span className="font-bold text-sm truncate w-full text-center text-[var(--text-primary)]">
                                    {player.name}
                                    {isMe && <span className="text-[var(--text-secondary)] text-xs"> (sən)</span>}
                                </span>

                                {/* Host badge */}
                                {player.isHost && <span className="text-xs text-yellow-500">👑</span>}

                                {/* Vote count badge */}
                                <AnimatePresence>
                                    {votesForThis > 0 && (
                                        <motion.div
                                            key={votesForThis}
                                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg"
                                        >
                                            {votesForThis}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* Skip Vote Button */}
            {!hasVoted && (
                <div className="px-4 pb-6 pt-2">
                    <button
                        onClick={handleSkip}
                        className="w-full py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] font-bold hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
                    >
                        {t.skipVote || 'Səs verməkdən imtina et'}
                    </button>
                </div>
            )}

            {/* Exit Modal */}
            <Modal
                isOpen={exitModal}
                onClose={() => setExitModal(false)}
                title={t.endGame}
                type="alert"
            >
                {t.endGameConfirm}
                <div className="flex gap-3 mt-4">
                    <button onClick={() => setExitModal(false)} className="btn-secondary flex-1 py-2">
                        {t.cancel}
                    </button>
                    <button
                        onClick={() => {
                            setExitModal(false);
                            if (mode === 'online') {
                                if (currentPlayer?.isHost) returnToLobby();
                                else leaveRoom();
                            } else {
                                returnToLobby();
                            }
                        }}
                        className="btn-primary flex-1 py-2 bg-red-500 hover:bg-red-600 border-red-500"
                    >
                        {t.confirm}
                    </button>
                </div>
            </Modal>

            <Chat />
        </div>
    );
};

export default ScreenVote;
