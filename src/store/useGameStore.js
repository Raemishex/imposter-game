import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import io from 'socket.io-client';
import { CATEGORIES } from '../data';
import { UI_TEXTS } from '../translations';

// ─── Sound helper (works outside React hooks) ─────────────────────────────────
import { playStoreSound } from '../hooks/useSoundManager';
export { playStoreSound };

// ─── Socket Connection ────────────────────────────────────────────────────────
const isProduction = import.meta.env.PROD;
const productionUrl = 'https://imposter-server-h8u6.onrender.com';
const socketUrl = isProduction
    ? productionUrl
    : `${window.location.protocol}//${window.location.hostname}:3001`;

const socket = io(socketUrl, {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
});

// ─── Store ────────────────────────────────────────────────────────────────────
const useGameStore = create(
    persist(
        (set, get) => ({
            // ── State ─────────────────────────────────────────────────────────
            socket,
            isConnected: false,
            roomCode: null,
            gameState: 'lobby',
            players: [],
            currentPlayer: null,
            currentWord: '',
            selectedCategories: [],
            currentCategory: null,
            isImposter: false,
            gameResult: null,
            error: null,
            mode: 'local',
            localRevealIndex: 0,
            timeLimit: false,
            imposterHint: false,
            startingPlayerId: null,
            isTrollActive: false,

            // Persisted
            history: (() => {
                try { return JSON.parse(localStorage.getItem('game_history') || '[]'); } catch { return []; }
            })(),
            language: 'az',
            theme: 'light',
            imposterSquad: false,

            // Chat
            messages: [],

            // Discussion
            discussionTurn: null,
            discussionClues: [],

            // Voting
            voteUpdate: null,
            voteResult: null,

            // Advanced features
            role: 'crew',        // 'crew' | 'imposter' | 'jester'
            chaosEvent: null,    // 'blind_round' | 'double_trouble' | 'speed_run' | null
            toastMessage: null,  // host migration / player left notifications

            // Ready system
            readyUpdate: { readyCount: 0, totalCount: 0, allReady: false },

            // ── Actions ───────────────────────────────────────────────────────

            addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),

            setTheme: (theme) => set({ theme }),
            setLanguage: (language) => set({ language }),
            toggleTheme: () => set(s => {
                const themes = ['light', 'dark', 'neon', 'orange'];
                return { theme: themes[(themes.indexOf(s.theme) + 1) % themes.length] };
            }),

            addToHistory: (result) => set(s => {
                const newHistory = [result, ...s.history].slice(0, 50);
                localStorage.setItem('game_history', JSON.stringify(newHistory));
                return { history: newHistory };
            }),

            setError: (msg) => set({ error: msg }),
            setGameMode: (mode) => set({ mode }),

            // ── Room Actions ──────────────────────────────────────────────────

            createRoom: (playerName) => {
                if (get().mode === 'local') {
                    set({
                        gameState: 'lobby',
                        roomCode: 'LOCAL',
                        players: [{ id: 'local-1', name: playerName, isHost: true, isAlive: true, votes: 0 }],
                        currentPlayer: { id: 'local-1', name: playerName, isHost: true },
                        mode: 'local'
                    });
                    return;
                }
                socket.emit('create_room', { playerName });
            },

            joinRoom: (roomCode, playerName) => {
                socket.emit('join_room', { roomCode, playerName });
            },

            leaveRoom: () => {
                const { roomCode } = get();
                if (roomCode) socket.emit('leave_room', { roomCode });
                // Clear session storage for rejoin
                localStorage.removeItem('rejoin_roomCode');
                localStorage.removeItem('rejoin_playerName');
                set({
                    roomCode: null,
                    players: [],
                    gameState: 'lobby',
                    currentPlayer: null,
                    error: null,
                    discussionTurn: null,
                    discussionClues: [],
                    voteUpdate: null,
                    voteResult: null,
                    messages: []
                });
            },

            // ── Game Actions ──────────────────────────────────────────────────

            startGame: (categoryIds, words, settings) => {
                const { roomCode } = get();
                // Send categoryIds as array (server picks one randomly)
                socket.emit('start_game', { roomCode, categoryIds, words, settings });
            },

            startDiscussion: () => {
                const { roomCode } = get();
                if (roomCode) socket.emit('start_discussion', { roomCode });
            },

            playerReady: () => {
                const { roomCode } = get();
                if (roomCode) socket.emit('player_ready', { roomCode });
            },

            submitClue: (clue) => {
                const { roomCode } = get();
                if (roomCode) socket.emit('submit_clue', { roomCode, clue });
            },

            passTurn: () => {
                const { roomCode } = get();
                if (roomCode) socket.emit('pass_turn', { roomCode });
            },

            castVote: (targetId) => {
                const { roomCode, mode, players } = get();

                if (mode === 'local') {
                    // Local mode: immediate result
                    const target = players.find(p => p.id === targetId);
                    if (!target) return;
                    const wasImposter = target.isImposter;
                    const result = {
                        winner: wasImposter ? 'crew' : 'imposter',
                        reason: wasImposter ? 'Imposter tapıldı! 🎉' : 'Səhv seçim! Imposter qazandı! 😈',
                        eliminatedName: target.name,
                        wasImposter,
                        word: get().currentWord,
                        imposters: players.filter(p => p.isImposter).map(p => p.name)
                    };
                    set({ gameState: 'result', gameResult: result });
                    return;
                }

                // Online mode: emit to server
                socket.emit('vote', { roomCode, targetId });
            },

            submitImposterGuess: (guess) => {
                const { roomCode } = get();
                socket.emit('imposter_guess', { roomCode, guess });
            },

            returnToLobby: () => {
                const { mode, roomCode } = get();
                if (mode === 'online' && roomCode) {
                    socket.emit('return_to_lobby', { roomCode });
                } else {
                    set({
                        gameState: 'lobby',
                        currentWord: '',
                        isImposter: false,
                        gameResult: null,
                        discussionTurn: null,
                        discussionClues: [],
                        voteUpdate: null,
                        voteResult: null
                    });
                }
            },

            playAgain: () => {
                const { mode, roomCode } = get();
                if (mode === 'online' && roomCode) {
                    // Emit reset_game: server clears game data, keeps players, broadcasts game_reset
                    socket.emit('reset_game', { roomCode });
                } else {
                    set({ gameState: 'lobby', gameResult: null });
                }
            },

            // ── Local Mode Actions ────────────────────────────────────────────

            addLocalPlayer: (name) => {
                const { players } = get();
                if (players.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())) {
                    const t = UI_TEXTS[get().language] || UI_TEXTS['az'];
                    return { success: false, error: t.nameTaken };
                }
                set({ players: [...players, { id: `local-${Date.now()}`, name: name.trim(), isHost: false, isAlive: true, votes: 0 }] });
                return { success: true };
            },

            startLocalGame: (categoryId, words, settings) => {
                const { players } = get();
                const lang = get().language;

                const isTrollActive = settings.trollMode && Math.random() < 0.5;
                const newPlayers = players.map(p => ({ ...p, isImposter: false, votes: 0 }));

                if (isTrollActive) {
                    newPlayers.forEach(p => p.isImposter = true);
                } else {
                    let imposterCount = Math.min(settings.imposterCount || 1, Math.max(1, newPlayers.length - 1));
                    const indices = Array.from({ length: newPlayers.length }, (_, i) => i);
                    for (let i = indices.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [indices[i], indices[j]] = [indices[j], indices[i]];
                    }
                    const imposterSet = new Set(indices.slice(0, imposterCount));
                    newPlayers.forEach((p, i) => p.isImposter = imposterSet.has(i));
                }

                // Find word category
                const catArray = Array.isArray(categoryId) ? categoryId : [categoryId];
                const chosenCat = catArray[Math.floor(Math.random() * catArray.length)];

                const crew = newPlayers.filter(p => !p.isImposter);
                const imposters = newPlayers.filter(p => p.isImposter);
                let startingPlayerId;
                if (Math.random() < 0.8 && crew.length) startingPlayerId = crew[Math.floor(Math.random() * crew.length)].id;
                else if (imposters.length) startingPlayerId = imposters[Math.floor(Math.random() * imposters.length)].id;
                else startingPlayerId = newPlayers[0].id;

                set({
                    mode: 'local',
                    gameState: 'local_reveal',
                    players: newPlayers,
                    selectedCategories: catArray,
                    currentWord: words[Math.floor(Math.random() * words.length)],
                    currentCategory: chosenCat,
                    startingPlayerId,
                    isTrollActive,
                    timeLimit: settings.timeLimit,
                    imposterHint: settings.imposterHint,
                    imposterSquad: settings.imposterSquad,
                    localRevealIndex: 0,
                });
            },

            nextLocalReveal: () => {
                const { localRevealIndex, players } = get();
                const next = localRevealIndex + 1;
                if (next >= players.length) set({ gameState: 'playing' });
                else set({ localRevealIndex: next });
            },

            // ── Socket Listeners ──────────────────────────────────────────────
            initSockets: () => {

                socket.on('connect', () => {
                    set({ isConnected: true });

                    // Auto-rejoin if we have stored session
                    const storedRoom = localStorage.getItem('rejoin_roomCode');
                    const storedName = localStorage.getItem('rejoin_playerName');
                    const state = get();

                    if (state.mode === 'online' && storedRoom && storedName) {
                        socket.emit('rejoin_room', { roomCode: storedRoom, playerName: storedName });
                    }
                });

                socket.on('disconnect', () => {
                    set({ isConnected: false });
                });

                // ── Room Events ───────────────────────────────────────────────

                socket.on('room_created', ({ roomCode, players }) => {
                    const myPlayer = players.find(p => p.id === socket.id);
                    // Save for rejoin
                    localStorage.setItem('rejoin_roomCode', roomCode);
                    localStorage.setItem('rejoin_playerName', myPlayer?.name || '');
                    set({ gameState: 'lobby', roomCode, players, currentPlayer: myPlayer, error: null });
                });

                socket.on('joined_room', ({ roomCode, players }) => {
                    const myPlayer = players.find(p => p.id === socket.id);
                    // Save for rejoin
                    localStorage.setItem('rejoin_roomCode', roomCode);
                    localStorage.setItem('rejoin_playerName', myPlayer?.name || '');
                    set({ gameState: 'lobby', roomCode, players, currentPlayer: myPlayer, error: null });
                });

                socket.on('rejoined_room', ({ roomCode, players, gameState, currentWord, currentCategory, isImposter, isHost, role, chaosEvent, discussionTurn }) => {
                    const myPlayer = players.find(p => p.name === localStorage.getItem('rejoin_playerName'));
                    set({
                        roomCode,
                        players,
                        gameState: gameState || 'lobby',
                        currentWord: currentWord || '',
                        currentCategory,
                        isImposter,
                        role: role || 'crew',
                        chaosEvent: chaosEvent || null,
                        currentPlayer: myPlayer ? { ...myPlayer, isHost } : null,
                        discussionTurn: discussionTurn || null,
                        error: null
                    });
                });

                socket.on('update_players', (players) => {
                    const prev = get().players;
                    // Play join sound when a NEW player enters
                    if (players.length > prev.length) playStoreSound('join');
                    set({ players });
                    // Update currentPlayer reference too
                    const { currentPlayer } = get();
                    if (currentPlayer) {
                        const updated = players.find(p => p.name === currentPlayer.name);
                        if (updated) set({ currentPlayer: updated });
                    }
                });

                socket.on('player_left', ({ name, wasHost, newHostName }) => {
                    if (wasHost && newHostName) {
                        // Show a brief notification (store it as a toast)
                        set({ toastMessage: `${name} ayrıldı. Yeni host: ${newHostName} 👑` });
                        setTimeout(() => set({ toastMessage: null }), 4000);
                    }
                });

                // ── Host Migration ────────────────────────────────────────────
                socket.on('host_migrated', ({ message, players }) => {
                    set({
                        players,
                        toastMessage: message
                    });
                    // Update currentPlayer to reflect new host status
                    const { currentPlayer } = get();
                    if (currentPlayer) {
                        const updated = players.find(p => p.name === currentPlayer.name);
                        if (updated) set({ currentPlayer: updated });
                    }
                    setTimeout(() => set({ toastMessage: null }), 5000);
                });

                // ── Game Events ───────────────────────────────────────────────

                socket.on('game_started', ({ players, category, word, startingPlayerId, isTrollActive, isImposter, role, chaosEvent, settings }) => {
                    playStoreSound('start');
                    set({
                        gameState: 'playing',
                        players,
                        isImposter: isImposter || false,
                        role: role || 'crew',
                        chaosEvent: chaosEvent || null,
                        currentCategory: category,
                        currentWord: word || '',
                        startingPlayerId,
                        isTrollActive,
                        timeLimit: settings?.timeLimit || false,
                        imposterHint: settings?.imposterHint || false,
                        imposterSquad: settings?.imposterSquad || false,
                        discussionTurn: null,
                        discussionClues: [],
                        voteUpdate: null,
                        voteResult: null,
                        messages: [],
                        readyUpdate: { readyCount: 0, totalCount: players.length, allReady: false }
                    });
                });

                // ── Ready System ──────────────────────────────────────────────
                socket.on('ready_update', ({ readyCount, totalCount, allReady }) => {
                    set({ readyUpdate: { readyCount, totalCount, allReady } });
                });

                // ── Discussion Events ─────────────────────────────────────────

                socket.on('discussion_turn', ({ turnIndex, totalTurns, currentPlayerId, currentPlayerName, timeLeft, clues }) => {
                    set({
                        gameState: 'discussion',
                        discussionTurn: {
                            turnIndex,
                            totalTurns,
                            currentPlayerId,
                            currentPlayerName,
                            timeLeft,
                            clues,
                            isMyTurn: currentPlayerId === socket.id
                        }
                    });
                });

                socket.on('discussion_ended', ({ clues }) => {
                    set({ gameState: 'discussion_ended', discussionClues: clues });
                });

                socket.on('start_voting', () => {
                    set({ gameState: 'voting' });
                });

                // ── Vote Events ───────────────────────────────────────────────

                socket.on('vote_update', ({ votes, votedCount, totalVoters }) => {
                    playStoreSound('vote');
                    set({ voteUpdate: { votes, votedCount, totalVoters } });
                });

                socket.on('vote_result', (result) => {
                    // vote_result comes before game_over, use it to show result
                    set({ voteResult: result });
                });

                socket.on('game_over', (result) => {
                    // Play win or lose sound
                    if (result.winner === 'crew') playStoreSound('win');
                    else if (result.winner === 'imposter') playStoreSound('lose');
                    else playStoreSound('win'); // jester win = fun
                    // Transition to result screen and save to history
                    set({ gameState: 'result', gameResult: result });
                    if (result.word) {
                        get().addToHistory({
                            winner: result.winner,
                            word: result.word,
                            date: Date.now(),
                            reason: result.reason
                        });
                    }
                    localStorage.removeItem('rejoin_roomCode');
                    localStorage.removeItem('rejoin_playerName');
                });

                // ── Misc Events ───────────────────────────────────────────────

                socket.on('error', (msg) => {
                    set({ error: msg });
                    setTimeout(() => set({ error: null }), 4000);
                });

                socket.on('game_reset', ({ gameState, players }) => {
                    set({
                        gameState,
                        players,
                        messages: [],
                        discussionTurn: null,
                        discussionClues: [],
                        voteUpdate: null,
                        voteResult: null,
                        gameResult: null,
                        currentWord: '',
                        isImposter: false
                    });
                });

                socket.on('receive_message', (msg) => {
                    get().addMessage(msg);
                });
            },

            sendMessage: (text, senderName = null) => {
                const { roomCode, currentPlayer } = get();
                if (!roomCode) return;
                const name = senderName || currentPlayer?.name || 'Anonymous';
                socket.emit('send_message', { roomCode, playerName: name, text });
            },

            resetGame: () => {
                set({
                    gameState: 'lobby',
                    roomCode: null,
                    players: [],
                    currentPlayer: null,
                    gameResult: null,
                    error: null,
                    discussionTurn: null,
                    discussionClues: [],
                    voteUpdate: null,
                    voteResult: null,
                    messages: []
                });
            }
        }),
        {
            name: 'game-storage',
            storage: createJSONStorage(() => localStorage),
            // Only persist UI preferences, NOT game state (to avoid stale state on refresh)
            partialize: (state) => ({
                theme: state.theme,
                language: state.language,
                history: state.history,
                imposterSquad: state.imposterSquad
            }),
        }
    )
);

// Initialize socket listeners on store creation
useGameStore.getState().initSockets();

export default useGameStore;
