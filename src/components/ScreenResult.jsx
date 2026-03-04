import useGameStore from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Skull, RotateCcw, Home, Users, Star } from 'lucide-react';
import { UI_TEXTS } from '../translations';
import { useSoundManager } from '../hooks/useSoundManager';
import Chat from './Chat';
import ConfettiCanvas from './ConfettiCanvas';
import GlitchCanvas from './GlitchCanvas';

const ScreenResult = () => {
    const {
        players,
        currentPlayer,
        mode,
        language,
        gameResult,
        playAgain,
        leaveRoom,
        returnToLobby
    } = useGameStore();

    const t = UI_TEXTS[language] || UI_TEXTS['az'];
    const { playSound } = useSoundManager();
    const playClick = () => playSound('click');

    const winner = gameResult?.winner;
    const reason = gameResult?.reason;
    const eliminatedName = gameResult?.eliminatedName;
    const wasImposter = gameResult?.wasImposter;
    const isJester = gameResult?.isJester;
    const word = gameResult?.word;
    const impostors = gameResult?.imposters || [];
    const jesterName = gameResult?.jester;

    const isCrewWin = winner === 'crew';
    const isJesterWin = winner === 'jester';
    const isHost = currentPlayer?.isHost || mode === 'local';

    // Dramatik fon rəng keçidi
    const bgGradient = isJesterWin
        ? 'from-purple-950 via-[var(--bg-primary)] to-[var(--bg-primary)]'
        : isCrewWin
            ? 'from-emerald-950 via-[var(--bg-primary)] to-[var(--bg-primary)]'
            : 'from-red-950 via-[var(--bg-primary)] to-[var(--bg-primary)]';

    const glowColor = isJesterWin ? 'bg-purple-500' : isCrewWin ? 'bg-emerald-500' : 'bg-red-600';

    // Staggered text variants
    const titleContainerVariants = {
        hidden: {},
        visible: {
            transition: { staggerChildren: 0.08, delayChildren: 0.3 }
        }
    };
    const letterVariant = {
        hidden: { y: 40, opacity: 0, rotateX: -90 },
        visible: { y: 0, opacity: 1, rotateX: 0, transition: { type: 'spring', stiffness: 200, damping: 15 } }
    };

    const titleText = isJesterWin
        ? '🎭 Jester Qazandı!'
        : isCrewWin
            ? (t.victory || '🎉 Qazandınız!')
            : (t.defeat || '💀 Uduldunuz!');

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className={`min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-gradient-to-b ${bgGradient}`}
        >
            {isCrewWin && <ConfettiCanvas />}
            {(!isCrewWin && !isJesterWin) && <GlitchCanvas />}
            {/* Animated background glow — pulsating */}
            <motion.div
                animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.15, 0.3, 0.15]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className={`absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none ${glowColor}`}
            />

            {/* Particle sparkles */}
            {[...Array(8)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                        y: [0, -60 - Math.random() * 80],
                        x: [-40 + Math.random() * 80]
                    }}
                    transition={{ duration: 2 + Math.random(), repeat: Infinity, delay: i * 0.3 }}
                    className={`absolute top-1/3 w-2 h-2 rounded-full pointer-events-none ${
                        isCrewWin ? 'bg-green-400' : isJesterWin ? 'bg-purple-400' : 'bg-red-400'
                    }`}
                    style={{ left: `${20 + Math.random() * 60}%` }}
                />
            ))}

            {/* Trophy / Skull Icon — epic entrance */}
            <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.1 }}
                className="relative mb-6 z-10"
            >
                {isJesterWin ? (
                    <motion.span
                        animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                        className="text-[8rem] leading-none drop-shadow-[0_0_40px_rgba(168,85,247,0.8)] inline-block"
                    >🎭</motion.span>
                ) : isCrewWin ? (
                    <motion.div
                        animate={{ y: [0, -15, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Trophy className="w-32 h-32 text-green-400 drop-shadow-[0_0_40px_rgba(34,197,94,0.8)]" />
                    </motion.div>
                ) : (
                    <motion.div
                        animate={{
                            scale: [1, 1.15, 1],
                            filter: ['drop-shadow(0 0 10px rgba(239,68,68,0.5))', 'drop-shadow(0 0 30px rgba(239,68,68,0.9))', 'drop-shadow(0 0 10px rgba(239,68,68,0.5))']
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Skull className="w-32 h-32 text-red-400" />
                    </motion.div>
                )}
                {/* Sparkle stars for crew win */}
                {isCrewWin && (
                    <>
                        <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, type: 'spring' }}
                            className="absolute -top-3 -right-3">
                            <Star className="w-7 h-7 text-yellow-400 fill-yellow-400" />
                        </motion.div>
                        <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: 'spring' }}
                            className="absolute -bottom-2 -left-4">
                            <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                        </motion.div>
                        <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8, type: 'spring' }}
                            className="absolute top-1/2 -right-6">
                            <Star className="w-4 h-4 text-yellow-200 fill-yellow-200" />
                        </motion.div>
                    </>
                )}
            </motion.div>

            {/* Result Title — staggered dramatic text */}
            <motion.div
                variants={titleContainerVariants}
                initial="hidden"
                animate="visible"
                className="z-10 mb-2"
            >
                <h1 className={`text-5xl font-black tracking-tight flex flex-wrap justify-center gap-1 ${
                    isJesterWin ? 'text-purple-400' : isCrewWin ? 'text-green-400' : 'text-red-400'
                }`}>
                    {titleText.split(' ').map((word, i) => (
                        <motion.span key={i} variants={letterVariant} className="inline-block">
                            {word}
                        </motion.span>
                    ))}
                </h1>
            </motion.div>
            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-lg text-[var(--text-secondary)] font-medium z-10 mb-6"
            >
                {reason || (isCrewWin ? t.civilianWin : t.imposterWin)}
            </motion.p>

            {/* Player Avatars — animated by winner */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap justify-center gap-3 mb-6 z-10 max-w-sm"
            >
                {players.map((p, i) => {
                    const pIsImposter = impostors.includes(p.name);
                    const pIsJester = p.name === jesterName;

                    // Crew Win: İmposter shake + scale down, Crew bounce
                    // Imposter Win: Crew fade, İmposter scale up + glow
                    let avatarAnimate = {};
                    let avatarTransition = {};
                    let extraClass = '';

                    if (isCrewWin) {
                        if (pIsImposter) {
                            avatarAnimate = { x: [-8, 8, -8, 8, 0], scale: [1, 1, 1, 0.6, 0], opacity: [1, 1, 1, 0.5, 0.2] };
                            avatarTransition = { duration: 1.5, delay: 0.8 + i * 0.1 };
                        } else {
                            avatarAnimate = { y: [0, -12, 0] };
                            avatarTransition = { duration: 1, repeat: Infinity, delay: i * 0.15 };
                        }
                    } else if (!isJesterWin) {
                        // İmposter qazandı
                        if (pIsImposter) {
                            avatarAnimate = { scale: [1, 1.2, 1.15], boxShadow: ['0 0 0px rgba(255,0,0,0)', '0 0 25px 5px rgba(255,0,0,0.7)', '0 0 15px 3px rgba(255,0,0,0.4)'] };
                            avatarTransition = { duration: 2, repeat: Infinity, ease: 'easeInOut' };
                        } else {
                            extraClass = 'opacity-30 grayscale';
                        }
                    }

                    return (
                        <motion.div
                            key={p.id || i}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1, ...avatarAnimate }}
                            transition={{ ...avatarTransition, delay: avatarTransition.delay || (0.4 + i * 0.08) }}
                            className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-lg border-2 ${
                                pIsJester ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' :
                                pIsImposter ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                                'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]'
                            } ${extraClass}`}
                            title={p.name}
                        >
                            {pIsJester ? '🎭' : pIsImposter ? '😈' : p.name.charAt(0).toUpperCase()}
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* Game Summary Card */}
            <motion.div
                initial={{ y: 40, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 150, damping: 18 }}
                className="w-full max-w-sm bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-5 space-y-4 z-10 mb-6 backdrop-blur-sm"
            >
                {jesterName && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">🎭 Jester</span>
                        <span className={`font-black text-sm px-3 py-1 rounded-full ${
                            isJesterWin ? 'bg-purple-500/20 text-purple-400' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'
                        }`}>
                            {jesterName} {isJesterWin ? '👑' : ''}
                        </span>
                    </div>
                )}
                {eliminatedName && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">
                            {isJester ? '🎭 Tutulan jester' : wasImposter ? '🎯 Tutulan imposter' : '❌ Səhv seçilən'}
                        </span>
                        <span className={`font-black text-sm px-3 py-1 rounded-full ${wasImposter ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                            {eliminatedName}
                        </span>
                    </div>
                )}
                {word && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">🔑 Gizli söz</span>
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.8, type: 'spring', stiffness: 300 }}
                            className="font-black text-[var(--accent-color)] text-sm px-3 py-1 bg-[var(--bg-primary)] rounded-full border border-[var(--border-color)]"
                        >
                            {word}
                        </motion.span>
                    </div>
                )}
                {impostors.length > 0 && (
                    <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-[var(--text-secondary)] shrink-0">😈 Imposter(lər)</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                            {impostors.map((name, i) => (
                                <motion.span
                                    key={i}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.9 + i * 0.1, type: 'spring' }}
                                    className="text-xs font-bold px-2 py-1 bg-red-500/20 text-red-400 rounded-full"
                                >
                                    {name}
                                </motion.span>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)] flex items-center gap-1">
                        <Users className="w-4 h-4" /> Oyunçular
                    </span>
                    <span className="font-black text-sm text-[var(--text-primary)]">{players.length} nəfər</span>
                </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="w-full max-w-sm space-y-3 z-10"
            >
                {isHost ? (
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { playClick(); playAgain(); }}
                        className="w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2
                            bg-[var(--accent-color)] text-slate-900 transition-all shadow-lg shadow-[var(--accent-color)]/30"
                    >
                        <RotateCcw className="w-5 h-5" />
                        {t.playAgain || 'Yenidən Oyna'}
                    </motion.button>
                ) : (
                    <div className="w-full py-4 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-bold text-center">
                        ⏳ Host yeni oyun başlatmasını gözləyin...
                    </div>
                )}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        playClick();
                        if (mode === 'online') leaveRoom();
                        else returnToLobby();
                    }}
                    className="w-full py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)]
                        font-bold flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-400
                        hover:border-red-500/30 transition-colors"
                >
                    <Home className="w-5 h-5" />
                    {mode === 'online' ? 'Otaqdan çıx' : (t.backToLobby || 'Lobbyə qayıt')}
                </motion.button>
            </motion.div>

            <Chat />
        </motion.div>
    );
};

export default ScreenResult;
