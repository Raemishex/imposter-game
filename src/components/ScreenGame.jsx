import { useState, useEffect, useRef } from 'react';
import useGameStore from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
    EyeOff, AlertTriangle, CheckCircle, Fingerprint,
    ArrowRight, User, LogOut, Users, Send, SkipForward, Clock, CheckSquare
} from 'lucide-react';
import { CATEGORIES } from '../data';
import { UI_TEXTS } from '../translations';
import Modal from './Modal';
import Chat from './Chat';
import { useSoundManager } from '../hooks/useSoundManager';


const TURN_DURATION = 60;

const ScreenGame = () => {
    const {
        isImposter, currentCategory, currentWord, mode, gameState,
        players, localRevealIndex, nextLocalReveal, startingPlayerId,
        timeLimit, language, imposterHint, currentPlayer,
        returnToLobby, leaveRoom,
        // Discussion (online)
        discussionTurn, discussionClues,
        startDiscussion, submitClue, passTurn,
        // Advanced features
        role, chaosEvent,
        // Ready system
        playerReady, readyUpdate,
        // Admin mode
        isSecretAdmin,
        // Imposter kateqoriya (serverdən gələn)
        imposterCategory,
        // Next round info
        nextRoundInfo,
        // Phase 3: Admin Cheats
        spyWord,
        adminPlayerIds
    } = useGameStore();

    const t = UI_TEXTS[language] || UI_TEXTS['az'];
    const showSquad = useGameStore(s => s.imposterSquad);
    const { playSound } = useSoundManager();

    // ─── Local state ──────────────────────────────────────────────────────────
    const [isHolding, setIsHolding] = useState(false);
    const prevHolding = useRef(false);
    const [hasSeenCard, setHasSeenCard] = useState(false); // tracks if player revealed card
    const [isReady, setIsReady] = useState(false);         // tracks if player pressed Hazıram
    const [localPhase, setLocalPhase] = useState('pass');
    const [exitModal, setExitModal] = useState(false);
    const [sheriffModal, setSheriffModal] = useState(false);

    // Play flip sound when card is revealed; mark hasSeenCard
    useEffect(() => {
        if (isHolding && !prevHolding.current) {
            playSound('flip');
            setHasSeenCard(true);
        }
        prevHolding.current = isHolding;
    }, [isHolding, playSound]);

    // Reset ready state on new game
    useEffect(() => {
        setIsReady(false);
        setHasSeenCard(false);
    }, [gameState]);
    const [playerListModal, setPlayerListModal] = useState(false);
    const [clueText, setClueText] = useState('');
    const clueInputRef = useRef(null);

    // ─── Local discussion state (for local mode) ───────────────────────────────
    const [localDiscussion, setLocalDiscussion] = useState(null);
    // null | { phase: 'turns'|'ended', turnIndex, clues, timeLeft }

    const timerRef = useRef(null);

    // ─── Category ─────────────────────────────────────────────────────────────
    const categoryObj = CATEGORIES.find(c => c.id === currentCategory);
    const categoryName = chaosEvent === 'blind_round'
        ? '???'
        : (categoryObj?.name?.[language] || currentCategory || 'Naməlum');

    // imposter üçün görünən kateqoriya (server tərəfindən göndərilir)
    const imposterDisplayCategory = chaosEvent === 'blind_round'
        ? '???'
        : (imposterCategory || currentCategory || '?');

    // ─── Ordered players for local mode ───────────────────────────────────────
    const orderedPlayers = (() => {
        const alivePlayers = (players || []).filter(p => p.isAlive);
        if (!alivePlayers.length) return [];
        const startIdx = alivePlayers.findIndex(p => p.id === startingPlayerId);
        if (startIdx === -1) return [...alivePlayers];
        return [...alivePlayers.slice(startIdx), ...alivePlayers.slice(0, startIdx)];
    })();

    // ─── Sound on timer tick (online mode) ────────────────────────────────────
    useEffect(() => {
        if (discussionTurn?.timeLeft <= 10 && discussionTurn?.timeLeft > 0) {
            playSound('tick');
        }
        if (discussionTurn?.timeLeft === 0) {
            playSound('tick'); // end of turn signal
        }
    }, [discussionTurn?.timeLeft, playSound]);

    // ─── Local discussion timer ────────────────────────────────────────────────
    useEffect(() => {
        if (localDiscussion?.phase !== 'turns') return;
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setLocalDiscussion(prev => {
                if (!prev) return prev;
                const newTime = prev.timeLeft - 1;
                if (newTime <= 10 && newTime > 0) playSound('tick');
                if (newTime <= 0) {
                    clearInterval(timerRef.current);
                    playSound('tick');
                    return handleLocalAutoAdvance(prev);
                }
                return { ...prev, timeLeft: newTime };
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [localDiscussion?.turnIndex, localDiscussion?.phase, playSound]);

    const handleLocalAutoAdvance = (prev) => {
        const nextIndex = prev.turnIndex + 1;
        const newClues = [...prev.clues, {
            name: orderedPlayers[prev.turnIndex]?.name || '?',
            text: null,
            passed: true
        }];
        if (nextIndex >= orderedPlayers.length) {
            return { ...prev, phase: 'ended', clues: newClues };
        }
        return { ...prev, turnIndex: nextIndex, timeLeft: TURN_DURATION, clues: newClues };
    };

    const handleLocalSubmit = () => {
        if (!localDiscussion) return;
        clearInterval(timerRef.current);
        playSound('click');
        const currentName = orderedPlayers[localDiscussion.turnIndex]?.name || '?';
        const newClues = [...localDiscussion.clues, {
            name: currentName,
            text: clueText.trim() || null,
            passed: !clueText.trim()
        }];
        setClueText('');
        const nextIndex = localDiscussion.turnIndex + 1;
        if (nextIndex >= orderedPlayers.length) {
            setLocalDiscussion({ ...localDiscussion, phase: 'ended', clues: newClues });
        } else {
            setLocalDiscussion({ ...localDiscussion, turnIndex: nextIndex, timeLeft: TURN_DURATION, clues: newClues });
        }
    };

    const handleStartLocalDiscussion = () => {
        setLocalDiscussion({ phase: 'turns', turnIndex: 0, clues: [], timeLeft: TURN_DURATION });
    };

    const handleStartOnlineDiscussion = () => {
        startDiscussion();
    };

    const handleSheriffShoot = (targetId) => {
        setSheriffModal(false);
        playSound('click');
        if (mode === 'online') {
            useGameStore.getState().sheriffShootOnline?.(targetId);
        } else {
            useGameStore.getState().sheriffShootLocal?.(targetId);
        }
    };

    // ─── Shared helpers ────────────────────────────────────────────────────────
    const isOnlineDiscussion = mode === 'online' && (gameState === 'discussion' || gameState === 'discussion_ended');
    const isLocalDiscussionActive = mode === 'local' && localDiscussion !== null;

    const aliveSheriff = players.find(p => p.role === 'sheriff' && p.isAlive);
    const canIShoot = mode === 'online'
        ? (currentPlayer?.role === 'sheriff' && currentPlayer?.isAlive && !currentPlayer?.hasShot)
        : (aliveSheriff !== undefined && !aliveSheriff?.hasShot);

    // ─── LOCAL REVEAL PHASE ───────────────────────────────────────────────────
    if (mode === 'local' && gameState === 'local_reveal') {
        const currentPlayerToView = players[localRevealIndex];
        if (!currentPlayerToView) return <div className="min-h-screen flex items-center justify-center">Xəta...</div>;

        const isCurrentPlayerImposter = currentPlayerToView.isImposter;
        const isCurrentPlayerJester = currentPlayerToView.role === 'jester';
        const otherImposters = (isCurrentPlayerImposter && showSquad)
            ? players.filter(p => p.isImposter && p.id !== currentPlayerToView.id).map(p => p.name)
            : [];

        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[var(--bg-primary)]">
                <button onClick={() => setExitModal(true)} className="absolute top-4 left-4 z-50 p-2 bg-[var(--bg-card)] rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-red-500 transition-colors">
                    <LogOut className="w-6 h-6" />
                </button>

                <AnimatePresence mode="wait">
                    {localPhase === 'pass' ? (
                        <motion.div key="pass" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -50 }} className="text-center space-y-8">
                            <div className="w-24 h-24 rounded-full bg-[var(--text-primary)]/10 flex items-center justify-center mx-auto animate-pulse">
                                <User className="w-12 h-12 text-[var(--text-primary)]" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-[var(--text-secondary)] mb-2">Telefonu ver:</h1>
                                <h2 className="text-5xl font-black text-[var(--text-primary)]">{currentPlayerToView.name}</h2>
                            </div>
                            <button onClick={() => setLocalPhase('view')} className="btn-primary px-12 py-4 text-xl rounded-full">
                                Mənəm, {currentPlayerToView.name}
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex flex-col items-center gap-8">
                            {!isHolding && (
                                <div className="text-center space-y-2 pointer-events-none animate-pulse">
                                    <Fingerprint className="w-16 h-16 mx-auto text-[var(--accent-color)]" />
                                    <p className="text-[var(--text-secondary)] text-lg font-bold">{t.tapToReveal}</p>
                                </div>
                            )}
                            <div className="w-full max-w-sm aspect-[3/4] relative cursor-pointer"
                                style={{ perspective: '1000px' }}
                                onTouchStart={() => setIsHolding(true)} onTouchEnd={() => setIsHolding(false)}
                                onMouseDown={() => setIsHolding(true)} onMouseUp={() => setIsHolding(false)} onMouseLeave={() => setIsHolding(false)}
                            >
                                <motion.div className="w-full h-full relative" style={{ transformStyle: 'preserve-3d' }} animate={{ rotateY: isHolding ? 180 : 0 }} transition={{ duration: 0.3 }}>
                                    <div className="absolute inset-0 rounded-3xl bg-[var(--bg-card)] border-2 border-[var(--border-color)] flex items-center justify-center shadow-xl" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                                        <div className="text-6xl font-black text-[var(--text-primary)]/10">?</div>
                                    </div>
                                    <div className={`absolute inset-0 rounded-3xl p-6 flex flex-col items-center justify-center text-center border-4 ${
                                        isCurrentPlayerJester
                                            ? 'bg-purple-500/10 border-purple-500/50'
                                            : isCurrentPlayerImposter
                                                ? 'bg-red-500/10 border-red-500/50'
                                                : 'bg-green-500/10 border-green-500/50'
                                    }`} style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }} initial={{ rotateY: 180 }} animate={{ rotateY: 180 }} transition={{ duration: 0 }}>
                                        {isCurrentPlayerJester ? (
                                            <>
                                                <span className="text-6xl mb-4">🎠</span>
                                                <h2 className="text-3xl font-black text-purple-400 mb-2">Jester!</h2>
                                                <p className="text-purple-300 text-sm">Məqsədin: səs verilərək oyundan çıxarılmaq!</p>
                                                <div className="mt-6 p-4 bg-[var(--bg-primary)]/80 rounded-xl w-full">
                                                    <p className="text-xs text-[var(--text-secondary)] uppercase mb-1">Gizli söz</p>
                                                    <p className="text-2xl font-black text-[var(--text-primary)]">{currentWord}</p>
                                                    <p className="text-xs text-purple-400 mt-1">({categoryName})</p>
                                                </div>
                                            </>
                                        ) : isCurrentPlayerImposter ? (
                                            <>
                                                <AlertTriangle className="w-20 h-20 text-red-500 mb-4" />
                                                <h2 className="text-4xl font-black text-red-500 mb-2">{t.imposters}</h2>
                                                <p className="text-red-300">{t.youAreImposter}</p>
                                                {imposterHint && <div className="mt-6 p-4 bg-[var(--bg-primary)]/80 rounded-xl"><p className="text-xs text-[var(--text-secondary)] uppercase">Mövzu</p><p className="text-xl font-bold text-[var(--text-primary)]">{imposterDisplayCategory}</p></div>}
                                                {otherImposters.length > 0 && <div className="mt-4 p-3 bg-red-900/30 rounded-xl border border-red-500/30 w-full"><p className="text-xs text-red-300 uppercase mb-1">{t.otherImposters}</p><div className="flex flex-wrap justify-center gap-2">{otherImposters.map((n, i) => <span key={i} className="px-2 py-1 bg-red-500/20 rounded text-red-200 text-sm font-bold">{n}</span>)}</div></div>}
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
                                                <h2 className="text-3xl font-black text-green-500 mb-2">{t.youAreCivilian}</h2>
                                                <div className="mt-8 p-6 bg-[var(--bg-primary)]/80 rounded-xl w-full">
                                                    <p className="text-xs text-[var(--text-secondary)] uppercase mb-1">{t.secretWord}</p>
                                                    <p className="text-3xl font-black text-[var(--text-primary)]">{currentWord}</p>
                                                    <p className="text-xs text-[var(--text-secondary)]">({categoryName})</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                            <button onClick={() => { setIsHolding(false); setLocalPhase('pass'); nextLocalReveal(); }} className="btn-secondary w-full py-4 rounded-xl flex items-center justify-center gap-2">
                                Gördüm, Növbəti <ArrowRight className="w-5 h-5" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <ExitModal isOpen={exitModal} onClose={() => setExitModal(false)} t={t} mode={mode} currentPlayer={currentPlayer} returnToLobby={returnToLobby} leaveRoom={leaveRoom} />
            </div>
        );
    }

    // ─── DISCUSSION PHASE: TURNS ──────────────────────────────────────────────
    // Determine current turn data (online vs local)
    const turnData = mode === 'online' ? discussionTurn : (localDiscussion?.phase === 'turns' ? {
        turnIndex: localDiscussion.turnIndex,
        totalTurns: orderedPlayers.length,
        currentPlayerId: orderedPlayers[localDiscussion.turnIndex]?.id,
        currentPlayerName: orderedPlayers[localDiscussion.turnIndex]?.name || '?',
        timeLeft: localDiscussion.timeLeft,
        clues: localDiscussion.clues,
        isMyTurn: true // In local mode, always "my turn" (pass phone)
    } : null);

    const isInDiscussionTurns = (mode === 'online' && gameState === 'discussion') ||
        (mode === 'local' && localDiscussion?.phase === 'turns');

    const isInDiscussionEnded = (mode === 'online' && gameState === 'discussion_ended') ||
        (mode === 'local' && localDiscussion?.phase === 'ended');

    if (isInDiscussionTurns && turnData) {
        const timerPercent = (turnData.timeLeft / TURN_DURATION) * 100;
        const timerColor = turnData.timeLeft <= 10 ? '#ef4444' : turnData.timeLeft <= 20 ? '#f59e0b' : 'var(--accent-color)';
        const timerTextColor = turnData.timeLeft <= 10 ? 'text-red-500' : turnData.timeLeft <= 20 ? 'text-yellow-500' : 'text-[var(--accent-color)]';

        return (
            <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-8 pb-2">
                    <button onClick={() => setExitModal(true)} className="p-2 bg-[var(--bg-card)] rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-red-500 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                    <div className="text-center">
                        <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">🗣️ Müzakirə</p>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{turnData.turnIndex + 1} / {turnData.totalTurns}</p>
                    </div>
                    <button onClick={() => setPlayerListModal(true)} className="flex items-center gap-1 bg-[var(--bg-card)] px-3 py-2 rounded-full border border-[var(--border-color)]">
                        <Users className="w-4 h-4 text-[var(--text-secondary)]" />
                        <span className="text-sm font-bold">{players.length}</span>
                    </button>
                </div>

                {/* Spectator Mode Banner */}
                {currentPlayer?.isAlive === false && (
                    <div className="mx-4 mb-2 bg-red-500/90 text-white rounded-xl py-2 px-4 shadow-lg text-center font-bold text-sm border border-red-700 relative z-50">
                        💀 Eliminasiya olundun — İzləmə rejimi
                    </div>
                )}

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

                {/* Timer Ring */}
                <div className="flex flex-col items-center pt-3 pb-1">
                    <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-color)" strokeWidth="8" />
                            <circle cx="50" cy="50" r="42" fill="none" stroke={timerColor} strokeWidth="8"
                                strokeDasharray={`${2 * Math.PI * 42}`}
                                strokeDashoffset={`${2 * Math.PI * 42 * (1 - timerPercent / 100)}`}
                                strokeLinecap="round" className="transition-all duration-1000"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Clock className={`w-4 h-4 mb-0.5 ${timerTextColor}`} />
                            <motion.span
                                className={`text-xl font-black font-mono ${timerTextColor}`}
                                animate={turnData.timeLeft <= 10 ? {
                                    scale: [1, 1.25, 1],
                                    opacity: [1, 0.7, 1]
                                } : {}}
                                transition={turnData.timeLeft <= 10 ? {
                                    duration: 0.6,
                                    repeat: Infinity,
                                    ease: 'easeInOut'
                                } : {}}
                            >
                                {turnData.timeLeft}
                            </motion.span>
                        </div>
                    </div>
                </div>

                {/* Current Player — floating highlight */}
                <div className="text-center px-6 pb-3">
                    <p className="text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Sıra:</p>
                    <motion.h2
                        key={turnData.currentPlayerName}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{
                            scale: 1,
                            opacity: 1,
                            y: [-5, 5, -5]
                        }}
                        transition={{
                            scale: { duration: 0.3 },
                            y: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                        }}
                        className="text-3xl font-black text-[var(--text-primary)]"
                        style={{
                            textShadow: turnData.isMyTurn ? '0 0 20px rgba(var(--accent-rgb,59,130,246),0.5)' : 'none'
                        }}
                    >
                        {turnData.currentPlayerName}
                        {turnData.isMyTurn && <span className="ml-2 text-[var(--accent-color)] text-lg">← Sən!</span>}
                    </motion.h2>
                </div>

                {/* Clues so far */}
                {turnData.clues.length > 0 && (
                    <div className="mx-4 mb-3 max-h-28 overflow-y-auto space-y-1.5">
                        {turnData.clues.map((c, i) => (
                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                className="flex items-start gap-2 bg-[var(--bg-card)] rounded-xl px-3 py-2 border border-[var(--border-color)]">
                                <span className="text-xs font-black text-[var(--accent-color)] shrink-0 pt-0.5">{c.name}:</span>
                                {c.text ? <span className="text-sm text-[var(--text-primary)]">{c.text}</span>
                                    : <span className="text-sm text-[var(--text-secondary)] italic">Pass etdi ⏭️</span>}
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Input / Waiting Area */}
                <div className="flex-1 flex flex-col justify-end px-4 pb-6 gap-3 relative">

                    {/* Floating Sheriff Button */}
                    {canIShoot && (
                        <motion.button
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSheriffModal(true)}
                            className="absolute -top-16 right-4 p-4 bg-blue-600 text-white rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)] flex items-center justify-center border-2 border-blue-400 z-10"
                        >
                            <span className="text-xl">🔫</span>
                        </motion.button>
                    )}

                    {turnData.isMyTurn ? (
                        <>
                            <p className="text-center text-sm text-[var(--text-secondary)]">
                                💡 Söz haqqında bir ipucu ver. Imposter olmadığını sübut et!
                            </p>
                            <div className="flex gap-2">
                                <input
                                    ref={clueInputRef}
                                    value={clueText}
                                    onChange={e => setClueText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && clueText.trim()) {
                                            if (mode === 'online') submitClue(clueText);
                                            else handleLocalSubmit();
                                        }
                                    }}
                                    placeholder="İpucunu yaz..."
                                    className="flex-1 bg-[var(--bg-card)] px-4 py-3 rounded-xl font-bold text-[var(--text-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none transition-colors text-base"
                                    autoFocus
                                />
                                <button
                                    onClick={() => {
                                        if (!clueText.trim()) return;
                                        if (mode === 'online') submitClue(clueText);
                                        else handleLocalSubmit();
                                    }}
                                    disabled={!clueText.trim()}
                                    className="p-3 bg-[var(--accent-color)] text-white rounded-xl disabled:opacity-40 transition-all active:scale-95 shadow-lg"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    setClueText('');
                                    if (mode === 'online') passTurn();
                                    else handleLocalSubmit(); // empty = pass
                                }}
                                className="w-full py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] font-bold flex items-center justify-center gap-2 hover:bg-[var(--bg-card)] transition-colors active:scale-95"
                            >
                                <SkipForward className="w-4 h-4" /> Pass et (bilmirəm)
                            </button>
                        </>
                    ) : (
                        <div className="text-center py-6 space-y-3">
                            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                                className="w-16 h-16 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center mx-auto">
                                <span className="text-3xl">⏳</span>
                            </motion.div>
                            <p className="text-[var(--text-secondary)] font-bold">
                                <span className="text-[var(--text-primary)]">{turnData.currentPlayerName}</span> danışır...
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">Sıranı gözləyin</p>
                        </div>
                    )}
                </div>

                <ExitModal isOpen={exitModal} onClose={() => setExitModal(false)} t={t} mode={mode} currentPlayer={currentPlayer} returnToLobby={returnToLobby} leaveRoom={leaveRoom} />
                <PlayerListModal isOpen={playerListModal} onClose={() => setPlayerListModal(false)} players={orderedPlayers} currentTurnIndex={turnData.turnIndex} />
                <SheriffModal isOpen={sheriffModal} onClose={() => setSheriffModal(false)} players={players} onShoot={handleSheriffShoot} currentPlayer={currentPlayer} mode={mode} />
                <Chat />
            </div>
        );
    }

    // ─── DISCUSSION ENDED: Player names for voting ────────────────────────────
    if (isInDiscussionEnded) {
        const clues = mode === 'online' ? (discussionClues || []) : (localDiscussion?.clues || []);

        return (
            <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
                <div className="flex items-center justify-between px-4 pt-8 pb-4">
                    <button onClick={() => setExitModal(true)} className="p-2 bg-[var(--bg-card)] rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-red-500 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg font-black text-[var(--text-primary)]">✅ Müzakirə Bitti!</h2>
                    <div className="w-10" />
                </div>

                <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-4">
                    {/* Clue Summary */}
                    {clues.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">📋 İpucular</p>
                            {clues.map((c, i) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                                    className="flex items-start gap-3 bg-[var(--bg-card)] rounded-xl px-4 py-3 border border-[var(--border-color)]">
                                    <div className="w-8 h-8 rounded-full bg-[var(--accent-color)]/20 flex items-center justify-center text-[var(--accent-color)] font-black text-sm shrink-0">
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-[var(--accent-color)]">{c.name}</p>
                                        {c.text ? <p className="text-sm text-[var(--text-primary)]">{c.text}</p>
                                            : <p className="text-sm text-[var(--text-secondary)] italic">Pass etdi ⏭️</p>}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Player Grid for Voting */}
                    <div>
                        <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">🗳️ Kim Imposter? Seçin!</p>
                        <div className="grid grid-cols-2 gap-3">
                            {players.map((p, i) => (
                                <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.07 }}
                                    className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-color)] text-center cursor-pointer hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all active:scale-95">
                                    <div className="w-12 h-12 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center mx-auto mb-2 text-[var(--accent-color)] font-black text-xl">
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="font-bold text-[var(--text-primary)] text-sm truncate">{p.name}</p>
                                    {p.isHost && <span className="text-xs text-yellow-500">👑</span>}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Go to Vote Button */}
                <div className="px-4 pb-6 pt-2">
                    <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                        onClick={() => {
                            if (mode === 'online') {
                                // Server already emits start_voting, but host can trigger manually
                                useGameStore.getState().set?.({ gameState: 'voting' });
                            } else {
                                useGameStore.setState({ gameState: 'voting' });
                            }
                        }}
                        className="btn-primary w-full py-4 rounded-xl flex items-center justify-center gap-2 text-lg font-black shadow-lg"
                    >
                        <CheckSquare className="w-5 h-5" /> Səsverməyə Keç →
                    </motion.button>
                </div>

                <ExitModal isOpen={exitModal} onClose={() => setExitModal(false)} t={t} mode={mode} currentPlayer={currentPlayer} returnToLobby={returnToLobby} leaveRoom={leaveRoom} />
                <Chat />
            </div>
        );
    }

    // ─── NEXT ROUND OVERLAY ───────────────────────────────────────────────────
    if (gameState === 'next_round' && nextRoundInfo) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg-primary)] relative">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-sm space-y-6 text-center"
                >
                    <div className="text-6xl">{nextRoundInfo.wasImposter ? '🎯' : '❌'}</div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-[var(--text-primary)]">
                            {nextRoundInfo.eliminatedName} eliminasiya edildi!
                        </h2>
                        <p className={`font-bold text-lg ${
                            nextRoundInfo.wasImposter ? 'text-green-400' : 'text-red-400'
                        }`}>
                            {nextRoundInfo.message}
                        </p>
                    </div>

                    {/* Sağ qalan oyunçular */}
                    <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                            Sağ qalan oyunçular ({nextRoundInfo.alivePlayers?.length || 0})
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {(nextRoundInfo.alivePlayers || []).map(p => (
                                <span key={p.id} className={`px-3 py-1.5 rounded-full text-sm font-bold border ${
                                    isSecretAdmin && p.isImposter
                                        ? 'bg-red-500/20 text-red-400 border-red-500/50'
                                        : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-color)]'
                                }`}>
                                    {isSecretAdmin && p.isImposter && <span className="mr-1">🔴</span>}
                                    {adminPlayerIds && adminPlayerIds.includes(p.id) && <span className="mr-1 text-yellow-400" title="Admin">👁️</span>}
                                    {p.name}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Host: müzakirəni yenidən başlat */}
                    {currentPlayer?.isHost ? (
                        <motion.button
                            animate={{ boxShadow: ['0 0 0px rgba(34,197,94,0)', '0 0 20px rgba(34,197,94,0.5)', '0 0 0px rgba(34,197,94,0)'] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            onClick={() => {
                                if (mode === 'online') {
                                    useGameStore.getState().socket?.emit('start_discussion', { roomCode: useGameStore.getState().roomCode });
                                } else {
                                    useGameStore.setState({ gameState: 'discussion' });
                                    handleStartLocalDiscussion();
                                }
                            }}
                            className="w-full py-4 bg-[var(--accent-color)] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            🗣️ Yeni Müzakirə Başlat
                        </motion.button>
                    ) : (
                        <div className="py-4 rounded-2xl border border-[var(--border-color)] text-[var(--text-secondary)] font-bold animate-pulse">
                            ⏳ Host yeni müzakirə başlatmasını gözləyin...
                        </div>
                    )}
                </motion.div>
                <Chat />
            </div>
        );
    }

    // ─── CARD REVEAL PHASE (playing state) ────────────────────────────────────
    const starterPlayer = players.find(p => p.id === startingPlayerId);
    const onlineOtherImposters = (isImposter && showSquad)
        ? players.filter(p => p.isImposter && p.id !== useGameStore.getState().socket?.id).map(p => p.name)
        : [];

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <button onClick={() => setExitModal(true)} className="absolute top-4 left-4 z-[60] p-2 bg-[var(--bg-card)] rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-red-500 transition-colors shadow-sm">
                <LogOut className="w-6 h-6" />
            </button>
            <button onClick={() => setPlayerListModal(true)} className="absolute top-4 right-4 z-[60] flex items-center gap-2 bg-[var(--bg-card)] px-3 py-2 rounded-full border border-[var(--border-color)] shadow-sm">
                <Users className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-sm font-bold">{players.length}</span>
            </button>

            {mode === 'online' ? (
                <>
                    <motion.div animate={{ opacity: isHolding ? 0 : 1 }} className="absolute top-1/4 text-center space-y-2 pointer-events-none">
                        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t.tapToReveal}</h2>
                        <p className="text-[var(--text-secondary)]">Barmağını ekranda saxla</p>
                        <Fingerprint className="w-12 h-12 mx-auto text-[var(--accent-color)] animate-pulse mt-4" />
                    </motion.div>

                    <div className="w-full max-w-sm aspect-[3/4] relative cursor-pointer"
                        style={{ perspective: '1000px' }}
                        onTouchStart={() => { setIsHolding(true); if (!hasSeenCard) setHasSeenCard(true); }}
                        onTouchEnd={() => setIsHolding(false)}
                        onMouseDown={() => { setIsHolding(true); if (!hasSeenCard) setHasSeenCard(true); }}
                        onMouseUp={() => setIsHolding(false)} onMouseLeave={() => setIsHolding(false)}
                    >
                        {/* Card Flip 3D + Hold Shake */}
                        <motion.div
                            className="w-full h-full relative"
                            style={{ transformStyle: 'preserve-3d' }}
                            animate={{
                                rotateY: isHolding ? 180 : 0,
                                x: isHolding ? 0 : [-1.5, 1.5, -1.5, 1.5, 0],
                            }}
                            transition={{
                                rotateY: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
                                x: { duration: 0.4, repeat: isHolding ? 0 : Infinity, ease: 'linear' }
                            }}
                        >
                            {/* Card Back — shake while not revealed */}
                            <motion.div
                                className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gray-800 via-gray-900 to-black border border-white/10 shadow-2xl flex flex-col items-center justify-center"
                                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                                animate={{
                                    boxShadow: !isHolding ? ['0 0 0px rgba(var(--accent-rgb,59,130,246),0)', '0 0 30px rgba(var(--accent-rgb,59,130,246),0.3)', '0 0 0px rgba(var(--accent-rgb,59,130,246),0)'] : 'none',
                                    opacity: isHolding ? 0 : 1
                                }}
                                transition={{
                                    boxShadow: { duration: 2, repeat: Infinity },
                                    opacity: { duration: 0.15, delay: isHolding ? 0 : 0.2 }
                                }}
                            >
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.3, 0.15] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    <EyeOff className="w-20 h-20 text-white/20" />
                                </motion.div>
                            </motion.div>
                            {/* Card Front — pop scale when flipped */}
                            <motion.div
                                className={`absolute inset-0 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 text-center border-4 ${
                                    role === 'jester' ? 'bg-gray-900 border-purple-500'
                                    : isImposter ? 'bg-gray-900 border-red-600'
                                    : 'bg-gray-900 border-green-500'
                                }`}
                                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                                initial={{ rotateY: 180 }}
                                animate={{ 
                                    scale: isHolding ? [1.08, 1] : 1,
                                    opacity: isHolding ? 1 : 0,
                                    rotateY: 180
                                }}
                                transition={{ 
                                    scale: { duration: 0.3, delay: 0.3 },
                                    opacity: { duration: 0.15, delay: isHolding ? 0.2 : 0 },
                                    rotateY: { duration: 0 }
                                }}
                            >
                                {role === 'jester' ? (
                                    <div className="space-y-6">
                                        <span className="text-7xl">🎠</span>
                                        <div>
                                            <p className="text-xs text-purple-400 uppercase tracking-widest mb-1">Gizli Rol</p>
                                            <h1 className="text-4xl font-black text-purple-400 tracking-wider">Jester</h1>
                                            <p className="text-purple-300/80 mt-2 text-sm">Oyundan çıxarılmaq sənin qələbəndir!</p>
                                        </div>
                                        <div className="p-4 bg-purple-900/20 rounded-xl border border-purple-500/20">
                                            <span className="text-xs text-purple-400 uppercase">{t.secretWord}</span>
                                            <h3 className="text-2xl font-black text-white">{currentWord}</h3>
                                        </div>
                                    </div>
                                ) : isImposter ? (
                                    <div className="space-y-6">
                                        <AlertTriangle className="w-24 h-24 text-red-500 mx-auto animate-pulse" />
                                        <div>
                                            <p className="text-xs text-red-400 uppercase tracking-widest mb-1">Gizli Rol</p>
                                            <h1 className="text-4xl font-black text-red-500 tracking-wider">İmposter</h1>
                                            <p className="text-red-300/80 mt-2 text-sm uppercase tracking-widest">{t.youAreImposter}</p>
                                        </div>
                                        {/* KRİTİK: İmposterə kateqoriyanı göstər (sözü yox!) */}
                                        <div className="p-4 bg-red-900/20 rounded-xl border border-red-500/20">
                                            <span className="text-xs text-red-400 uppercase">Kateqoriyan</span>
                                            <h3 className="text-xl font-bold text-white">{imposterDisplayCategory}</h3>
                                            <p className="text-xs text-red-300/60 mt-1">
                                                {chaosEvent === 'blind_round'
                                                    ? 'Kor Raund: Kateqoriya gizlidir!'
                                                    : 'Sən sözü bilmirsən, yalnız kateqoriyanı bilirsin'}
                                            </p>
                                        </div>
                                        {/* Spy Word Cheat: Secret Admin imposter olduqda əsl sözü göstər */}
                                        {spyWord && (
                                            <div className="p-4 bg-yellow-900/30 rounded-xl border border-yellow-500/40 animate-pulse">
                                                <span className="text-xs text-yellow-400 uppercase tracking-wider">🕵️ Spy Admin — Ǝsl Söz</span>
                                                <h3 className="text-2xl font-black text-yellow-300 mt-1">{spyWord}</h3>
                                                <p className="text-[10px] text-yellow-500/60 mt-1">Yalnız sən görürsən 🔥</p>
                                            </div>
                                        )}
                                        {onlineOtherImposters.length > 0 && <div className="p-3 bg-red-900/30 rounded-xl border border-red-500/30"><p className="text-xs text-red-300 uppercase mb-1">{t.otherImposters}</p><div className="flex flex-wrap justify-center gap-2">{onlineOtherImposters.map((n, i) => <span key={i} className="px-2 py-1 bg-red-500/20 rounded text-red-200 text-sm font-bold">{n}</span>)}</div></div>}
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <CheckCircle className="w-24 h-24 text-green-500 mx-auto" />
                                        <div>
                                            <p className="text-xs text-green-400 uppercase tracking-widest mb-1">Gizli Rol</p>
                                            <h1 className="text-4xl font-black text-green-500 tracking-wider">Vətəndaş</h1>
                                            <p className="text-green-300/80 mt-2 text-sm uppercase tracking-widest">{t.youAreCivilian}</p>
                                        </div>
                                        <div className="p-6 bg-green-900/20 rounded-xl border border-green-500/20">
                                            <span className="text-xs text-green-400 uppercase">{t.secretWord}</span>
                                            <h3 className="text-3xl font-black text-white">{currentWord}</h3>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    </div>

                    {/* ── Hazıram / Host Start Discussion ─────────────────── */}
                    <div className="mt-6 w-full max-w-sm space-y-3">
                        {/* Non-host: show Hazıram button after seeing card */}
                        {!currentPlayer?.isHost && (
                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: hasSeenCard ? 1 : 0.3, y: 0 }}
                                transition={{ delay: 0.3 }}
                                disabled={!hasSeenCard || isReady}
                                onClick={() => {
                                    setIsReady(true);
                                    playerReady();
                                    playSound('click');
                                }}
                                className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                                    isReady
                                        ? 'bg-green-600/30 border-2 border-green-500 text-green-400 cursor-default'
                                        : hasSeenCard
                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 active:scale-95'
                                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                {isReady ? (
                                    <><CheckCircle className="w-5 h-5" /> Hazıram ✓</>
                                ) : hasSeenCard ? (
                                    <><CheckCircle className="w-5 h-5" /> Hazıram — Gördüm!</>
                                ) : (
                                    <>Əvvəlcə kartına bax 👆</>
                                )}
                            </motion.button>
                        )}

                        {/* Host: show ready counter + Start Discussion button */}
                        {currentPlayer?.isHost && (
                            <div className="space-y-3">
                                {/* Host's own Hazıram button */}
                                <motion.button
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: hasSeenCard ? 1 : 0.3, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    disabled={!hasSeenCard || isReady}
                                    onClick={() => {
                                        setIsReady(true);
                                        playerReady();
                                        playSound('click');
                                    }}
                                    className={`w-full py-3 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-300 ${
                                        isReady
                                            ? 'bg-green-600/30 border-2 border-green-500 text-green-400 cursor-default'
                                            : hasSeenCard
                                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 active:scale-95'
                                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                                >
                                    {isReady ? <><CheckCircle className="w-4 h-4" /> Hazıram ✓</> : hasSeenCard ? <><CheckCircle className="w-4 h-4" /> Hazıram!</> : <>Əvvəlcə kartına bax 👆</>}
                                </motion.button>

                                {/* Ready counter */}
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-sm text-[var(--text-secondary)]">
                                        Hazır oyunçular:
                                    </span>
                                    <span className={`text-sm font-black ${
                                        readyUpdate.allReady ? 'text-green-400' : 'text-yellow-400'
                                    }`}>
                                        {readyUpdate.readyCount}/{readyUpdate.totalCount}
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <motion.div
                                        className={`h-full rounded-full ${
                                            readyUpdate.allReady ? 'bg-green-500' : 'bg-yellow-500'
                                        }`}
                                        animate={{ width: `${readyUpdate.totalCount > 0 ? (readyUpdate.readyCount / readyUpdate.totalCount) * 100 : 0}%` }}
                                        transition={{ duration: 0.4 }}
                                    />
                                </div>

                                {/* Start Discussion button */}
                                <motion.button
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{
                                        opacity: readyUpdate.allReady ? 1 : 0.4,
                                        y: 0,
                                        boxShadow: readyUpdate.allReady ? '0 0 20px rgba(34,197,94,0.5)' : 'none'
                                    }}
                                    transition={{ delay: 0.5 }}
                                    disabled={!readyUpdate.allReady}
                                    onClick={handleStartOnlineDiscussion}
                                    className={`w-full py-4 rounded-2xl text-lg font-black flex items-center justify-center gap-2 transition-all duration-300 ${
                                        readyUpdate.allReady
                                            ? 'bg-[var(--accent-color)] text-white cursor-pointer active:scale-95'
                                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                                >
                                    {readyUpdate.allReady
                                        ? <>🗣️ Müzakirəni Başlat</>
                                        : <>⏳ Hamı hazır deyil...</>}
                                </motion.button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                // Local Mode Playing Phase
                <div className="flex-1 w-full flex flex-col items-center justify-center p-6 text-center space-y-8 z-10">
                    <div className="p-6 bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border-color)] text-center relative">
                        <p className="text-xs text-[var(--text-secondary)] mb-4 select-none animate-pulse font-bold">
                            {isHolding ? '(Yalnız Vətəndaşlar baxsın!)' : '(Görmək üçün basıb saxlayın)'}
                        </p>
                        <h2 className="text-[var(--text-secondary)] uppercase text-sm font-bold mb-2">Mövzu</h2>
                        <div className="relative">
                            <h1 className={`text-4xl font-black text-[var(--text-primary)] transition-all duration-300 ${isHolding ? 'blur-0' : 'blur-md select-none'}`}>
                                {isHolding ? (isImposter && !imposterHint ? '🚫' : categoryName) : '???'}
                            </h1>
                            {isHolding && isImposter && !imposterHint && <p className="text-red-500 text-xs font-bold absolute -bottom-6 w-full text-center animate-bounce">Imposter mövzunu görə bilməz!</p>}
                            {isHolding && chaosEvent === 'blind_round' && <p className="text-gray-500 text-xs font-bold absolute -bottom-6 w-full text-center animate-bounce">Kor Raund: Mövzu gizlidir!</p>}
                            <div className="absolute inset-0 flex items-center justify-center cursor-pointer"
                                onMouseDown={() => setIsHolding(true)} onMouseUp={() => setIsHolding(false)} onMouseLeave={() => setIsHolding(false)}
                                onTouchStart={() => setIsHolding(true)} onTouchEnd={() => setIsHolding(false)}>
                                {!isHolding && <EyeOff className="w-8 h-8 text-[var(--text-secondary)] opacity-50" />}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="w-20 h-20 rounded-full bg-[var(--accent-color)]/20 flex items-center justify-center mx-auto ring-4 ring-[var(--accent-color)]/30">
                            <span className="text-3xl">🗣️</span>
                        </div>
                        <div>
                            <p className="text-[var(--text-secondary)] text-lg">Söhbəti Başladır:</p>
                            <h2 className="text-4xl font-black text-[var(--text-primary)] mt-1 animate-bounce">
                                {starterPlayer?.name || '...'}
                            </h2>
                        </div>
                    </div>

                    <button onClick={handleStartLocalDiscussion} className="btn-primary px-10 py-4 rounded-full text-lg font-black flex items-center gap-2">
                        🗣️ Müzakirəni Başlat
                    </button>
                </div>
            )}

            <ExitModal isOpen={exitModal} onClose={() => setExitModal(false)} t={t} mode={mode} currentPlayer={currentPlayer} returnToLobby={returnToLobby} leaveRoom={leaveRoom} />
            <PlayerListModal isOpen={playerListModal} onClose={() => setPlayerListModal(false)} players={players} currentTurnIndex={-1} />
            <SheriffModal isOpen={sheriffModal} onClose={() => setSheriffModal(false)} players={players} onShoot={handleSheriffShoot} currentPlayer={currentPlayer} mode={mode} />
            <Chat />
        </div>
    );
};

// ─── Shared Sub-components ────────────────────────────────────────────────────
const ExitModal = ({ isOpen, onClose, t, mode, currentPlayer, returnToLobby, leaveRoom }) => (
    <Modal isOpen={isOpen} onClose={onClose} title={t.exitGame} type="alert">
        {t.exitGameConfirm}
        <div className="flex gap-3 mt-4">
            <button onClick={onClose} className="btn-secondary flex-1 py-2">{t.cancel}</button>
            <button onClick={() => {
                onClose();
                if (mode === 'online') {
                    if (currentPlayer?.isHost) returnToLobby();
                    else leaveRoom();
                } else {
                    returnToLobby();
                }
            }} className="btn-primary flex-1 py-2 bg-red-500 hover:bg-red-600 border-red-500">
                {mode === 'online' && currentPlayer?.isHost ? 'Oyunu Bitir' : t.confirm}
            </button>
        </div>
    </Modal>
);

const PlayerListModal = ({ isOpen, onClose, players, currentTurnIndex }) => {
    const isSecretAdmin = useGameStore(s => s.isSecretAdmin);
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Oyunçular">
            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                {players.map((p, i) => (
                    <div key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border ${i === currentTurnIndex ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/10' : 'border-[var(--border-color)] bg-[var(--bg-primary)]'}`}>
                        <div className="w-8 h-8 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center text-[var(--accent-color)] font-bold text-sm">
                            {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-sm font-medium truncate ${
                            isSecretAdmin && p.isImposter ? 'text-red-400' : 'text-[var(--text-primary)]'
                        }`}>
                            {isSecretAdmin && p.isImposter && <span className="mr-1">🔴</span>}
                            {p.name}
                        </span>
                        {i === currentTurnIndex && <span className="text-xs">🎤</span>}
                        {i < currentTurnIndex && currentTurnIndex !== -1 && <span className="text-xs text-green-500">✓</span>}
                        {p.isHost && <span className="text-xs text-yellow-500">👑</span>}
                    </div>
                ))}
            </div>
            <div className="mt-4">
                <button onClick={onClose} className="btn-secondary w-full py-2">Bağla</button>
            </div>
        </Modal>
    );
};

const SheriffModal = ({ isOpen, onClose, players, onShoot, currentPlayer, mode }) => {
    if (!isOpen) return null;

    // Yalnız sağ qalan oyunçuları göstər.
    // Online rejimdə Şerif özünü görə bilməz.
    // Local rejimdə "Şerif" özünü vurmasın deyə onu siyahıdan çıxarırıq.
    const targets = players.filter(p => {
        if (!p.isAlive) return false;
        if (mode === 'online' && p.id === currentPlayer?.id) return false;
        if (mode === 'local' && p.role === 'sheriff') return false;
        return true;
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="🔫 Şerif Atəşi" type="alert">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
                Kimi vurmaq istəyirsiniz? Əgər vətəndaşı vursanız, özünüz öləcəksiniz!
            </p>
            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1 mb-4">
                {targets.map(p => (
                    <button
                        key={p.id}
                        onClick={() => onShoot(p.id)}
                        className="bg-[var(--bg-card)] rounded-xl p-3 border border-[var(--border-color)] text-center hover:border-red-500 hover:bg-red-500/10 transition-all active:scale-95"
                    >
                        <div className="w-10 h-10 rounded-full bg-[var(--accent-color)]/10 flex items-center justify-center mx-auto mb-2 text-[var(--accent-color)] font-black text-lg">
                            {p.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-bold text-[var(--text-primary)] text-sm truncate">{p.name}</p>
                    </button>
                ))}
            </div>
            <button onClick={onClose} className="btn-secondary w-full py-2 border border-[var(--border-color)] rounded-xl font-bold text-[var(--text-primary)]">Ləğv et</button>
        </Modal>
    );
};

export default ScreenGame;
