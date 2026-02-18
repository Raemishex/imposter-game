import useGameStore from '../store/useGameStore';
import { motion } from 'framer-motion';
import { Trophy, Skull, RotateCcw, Home, Users, Star } from 'lucide-react';
import { UI_TEXTS } from '../translations';
import { useSoundManager } from '../hooks/useSoundManager';
import Chat from './Chat';

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

    // Derive result data from gameResult (set by game_over event)
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

    // Host check
    const isHost = currentPlayer?.isHost || mode === 'local';

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden
            ${isJesterWin
                ? 'bg-gradient-to-b from-purple-950 via-[var(--bg-primary)] to-[var(--bg-primary)]'
                : isCrewWin
                    ? 'bg-gradient-to-b from-green-950 via-[var(--bg-primary)] to-[var(--bg-primary)]'
                    : 'bg-gradient-to-b from-red-950 via-[var(--bg-primary)] to-[var(--bg-primary)]'
            }`}
        >
            {/* Background glow */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none
                ${isJesterWin ? 'bg-purple-500' : isCrewWin ? 'bg-green-500' : 'bg-red-500'}`}
            />

            {/* Trophy / Skull Icon */}
            <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="relative mb-6 z-10"
            >
                {isJesterWin ? (
                    <span className="text-[8rem] leading-none drop-shadow-[0_0_30px_rgba(168,85,247,0.8)]">🎠</span>
                ) : isCrewWin ? (
                    <Trophy className="w-32 h-32 text-green-400 drop-shadow-[0_0_30px_rgba(34,197,94,0.8)]" />
                ) : (
                    <Skull className="w-32 h-32 text-red-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]" />
                )}
                {/* Sparkle stars for crew win */}
                {isCrewWin && (
                    <>
                        <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                            className="absolute -top-3 -right-3">
                            <Star className="w-7 h-7 text-yellow-400 fill-yellow-400" />
                        </motion.div>
                        <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
                            className="absolute -bottom-2 -left-4">
                            <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
                        </motion.div>
                    </>
                )}
            </motion.div>

            {/* Result Title */}
            <motion.div
                initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                className="space-y-2 z-10 mb-6"
            >
                <h1 className={`text-5xl font-black tracking-tight ${
                    isJesterWin ? 'text-purple-400' : isCrewWin ? 'text-green-400' : 'text-red-400'
                }`}>
                    {isJesterWin ? '🎠 Jester Qazandı!' : isCrewWin ? (t.victory || '🎉 Qazandınız!') : (t.defeat || '💀 Uduldunuz!')}
                </h1>
                <p className="text-lg text-[var(--text-secondary)] font-medium">
                    {reason || (isCrewWin ? t.civilianWin : t.imposterWin)}
                </p>
            </motion.div>

            {/* Game Summary Card */}
            <motion.div
                initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
                className="w-full max-w-sm bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-5 space-y-4 z-10 mb-6"
            >
                {/* Jester info */}
                {jesterName && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">🎠 Jester</span>
                        <span className={`font-black text-sm px-3 py-1 rounded-full ${
                            isJesterWin ? 'bg-purple-500/20 text-purple-400' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'
                        }`}>
                            {jesterName} {isJesterWin ? '👑' : ''}
                        </span>
                    </div>
                )}

                {/* Eliminated player */}
                {eliminatedName && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">
                            {isJester ? '🎠 Tutulan jester' : wasImposter ? '🎯 Tutulan imposter' : '❌ Səhv seçilən'}
                        </span>
                        <span className={`font-black text-sm px-3 py-1 rounded-full ${wasImposter ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                            {eliminatedName}
                        </span>
                    </div>
                )}

                {/* Secret word */}
                {word && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--text-secondary)]">🔑 Gizli söz</span>
                        <span className="font-black text-[var(--accent-color)] text-sm px-3 py-1 bg-[var(--bg-primary)] rounded-full border border-[var(--border-color)]">
                            {word}
                        </span>
                    </div>
                )}

                {/* Imposters list */}
                {impostors.length > 0 && (
                    <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-[var(--text-secondary)] shrink-0">😈 Imposter(lər)</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                            {impostors.map((name, i) => (
                                <span key={i} className="text-xs font-bold px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                                    {name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Player count */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-secondary)] flex items-center gap-1">
                        <Users className="w-4 h-4" /> Oyunçular
                    </span>
                    <span className="font-black text-sm text-[var(--text-primary)]">{players.length} nəfər</span>
                </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
                initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                className="w-full max-w-sm space-y-3 z-10"
            >
                {/* Play Again - ONLY HOST sees this */}
                {isHost ? (
                    <button
                        onClick={() => { playClick(); playAgain(); }}
                        className="w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2
                            bg-[var(--accent-color)] text-slate-900 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                    >
                        <RotateCcw className="w-5 h-5" />
                        {t.playAgain || 'Yenidən Oyna'}
                    </button>
                ) : (
                    /* Non-host players see a waiting message */
                    <div className="w-full py-4 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-bold text-center">
                        ⏳ Host yeni oyun başlatmasını gözləyin...
                    </div>
                )}

                {/* Leave / Home button */}
                <button
                    onClick={() => {
                        playClick();
                        if (mode === 'online') {
                            leaveRoom();
                        } else {
                            returnToLobby();
                        }
                    }}
                    className="w-full py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)]
                        font-bold flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-400
                        hover:border-red-500/30 transition-colors"
                >
                    <Home className="w-5 h-5" />
                    {mode === 'online' ? 'Otaqdan çıx' : (t.backToLobby || 'Lobbyə qayıt')}
                </button>
            </motion.div>

            <Chat />
        </div>
    );
};

export default ScreenResult;
