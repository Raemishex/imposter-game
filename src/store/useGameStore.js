import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import io from 'socket.io-client';
import { CATEGORIES } from '../data';
import { UI_TEXTS } from '../translations';

// ─── Sound helper ─────────────────────────────────────────────────────────────
import { playStoreSound } from '../hooks/useSoundManager';
export { playStoreSound };

// ─── Socket Connection ────────────────────────────────────────────────────────
const isProduction = import.meta.env.PROD;
const productionUrl = 'https://imposter-game-backend-1tv8.onrender.com';
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
            voiceEnabled: false,
            peerStreams: {},
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
            points: 0,
            unlockedFrames: ['basic'],
            activeFrame: 'basic',

            // Chat
            messages: [],

            // Discussion
            discussionTurn: null,
            discussionClues: [],

            // Voting
            voteUpdate: null,
            voteResult: null,

            // Rol & Xüsusi modlar
            role: 'crew',
            chaosEvent: null,
            toastMessage: null,

            // Ready system
            readyUpdate: { readyCount: 0, totalCount: 0, allReady: false },

            // ── Gizli Admin Modu ──────────────────────────────────────────────
            isSecretAdmin: false,

            // ── Qlobal Otaqlar ────────────────────────────────────────────────
            globalRooms: [],

            // ── Tarixçə qoruması (bir dəfə yazılmasını təmin edir) ────────────
            historyRecorded: false,

            // ── Next Round state ──────────────────────────────────────────────
            nextRoundInfo: null,

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

            addPoints: (amount) => set(s => ({ points: s.points + amount })),
            unlockFrame: (frameId, cost) => set(s => {
                if (s.points >= cost && !s.unlockedFrames.includes(frameId)) {
                    return { points: s.points - cost, unlockedFrames: [...s.unlockedFrames, frameId], activeFrame: frameId };
                }
                return s;
            }),
            setActiveFrame: (frameId) => set(s => {
                if (s.unlockedFrames.includes(frameId)) return { activeFrame: frameId };
                return s;
            }),

            setError: (msg) => set({ error: msg }),
            setGameMode: (mode) => set({ mode }),

            // ── Admin Modu ───────────────────────────────────────────────────
            activateSecretAdmin: (password) => {
                // Şifrə kodu github-da birbaşa görünməsin deyə base64 formatında saxlanılıb.
                const encodedAdmin = 'cmFtYXphbjIwMDM=';
                let isMatch = false;
                try { isMatch = btoa(password) === encodedAdmin; } catch (e) { isMatch = false; }

                if (isMatch) {
                    set({ isSecretAdmin: true });
                    // Server-ə de bildir ki, bu admin-dir (Admin Radar + Spy Word)
                    const { roomCode } = get();
                    socket.emit('check_admin_password', { password, roomCode });
                    return true;
                }
                return false;
            },

            deactivateSecretAdmin: () => set({ isSecretAdmin: false }),

            // ── Room Actions ──────────────────────────────────────────────────

            createRoom: (playerName, isPrivate = false, roomName = '', region = 'Global') => {
                const activeFrame = get().activeFrame;
                if (get().mode === 'local') {
                    set({
                        gameState: 'lobby',
                        roomCode: 'LOCAL',
                        players: [{ id: 'local-1', name: playerName, isHost: true, isAlive: true, votes: 0, frame: activeFrame }],
                        currentPlayer: { id: 'local-1', name: playerName, isHost: true, frame: activeFrame },
                        mode: 'local'
                    });
                    return;
                }
                socket.emit('create_room', { playerName, isPrivate, roomName, region, frame: activeFrame });
            },

            joinRoom: (roomCode, playerName) => {
                const activeFrame = get().activeFrame;
                socket.emit('join_room', { roomCode, playerName, frame: activeFrame });
            },

            leaveRoom: () => {
                const { roomCode } = get();
                if (roomCode) socket.emit('leave_room', { roomCode });
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
                    messages: [],
                    globalRooms: []
                });
            },

            fetchGlobalRooms: (region) => {
                socket.emit('get_global_rooms', region ? { region } : {});
            },

            // ── Game Actions ──────────────────────────────────────────────────

            // KRİTİK: wordObjects = [{word, category}] formatında göndərilir
            startGame: (categoryIds, wordObjects, settings) => {
                const { roomCode } = get();
                socket.emit('start_game', { roomCode, categoryIds, wordObjects, settings });
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
                    const target = players.find(p => p.id === targetId);
                    
                    if (target) {
                        target.isAlive = false;
                    }

                    const alivePlayers = players.filter(p => p.isAlive);
                    const aliveImposters = alivePlayers.filter(p => p.isImposter);
                    const aliveCrew = alivePlayers.filter(p => !p.isImposter && p.role !== 'jester');
                    
                    const isJester = target?.role === 'jester';
                    let over = false;
                    let winner = null;
                    let reason = null;

                    if (isJester) {
                        over = true;
                        winner = 'jester';
                        reason = `${target.name} Jester idi! Jester qazandı! 🎠`;
                    } else if (aliveImposters.length === 0) {
                        over = true;
                        winner = 'crew';
                        reason = target ? `${target.name} imposter idi! Vətəndaşlar qazandı! 🎉` : 'Bütün imposterlər tapıldı! 🎉';
                    } else if (aliveImposters.length >= aliveCrew.length) {
                        over = true;
                        winner = 'imposter';
                        reason = target && !target.isImposter 
                            ? `${target.name} vətəndaş idi! İmposterlar qazandı! 😈`
                            : 'İmposterlar qazandı! 😈';
                    }

                    const resultPayload = {
                        eliminatedName: target?.name || 'Heç kim',
                        wasImposter: target?.isImposter || false,
                        isJester,
                        word: get().currentWord,
                        imposters: players.filter(p => p.isImposter).map(p => p.name),
                        jester: players.find(p => p.role === 'jester')?.name || null,
                        players
                    };

                    if (over) {
                        set({ 
                            gameState: 'result', 
                            gameResult: { ...resultPayload, winner, reason }
                        });
                    } else {
                        set({
                            gameState: 'next_round',
                            nextRoundInfo: {
                                ...resultPayload,
                                alivePlayers,
                                message: target 
                                    ? (target.isImposter ? `${target.name} imposter idi! Oyun davam edir...` : `${target.name} vətəndaş idi! Oyun davam edir...`)
                                    : 'Heç kim atılmadı. Oyun davam edir...'
                            },
                            players: [...players]
                        });
                    }
                    return;
                }

                socket.emit('vote', { roomCode, targetId });
            },

            submitImposterGuess: (guess) => {
                const { roomCode } = get();
                socket.emit('imposter_guess', { roomCode, guess });
            },

            sheriffShootLocal: (targetId) => {
                const { players, currentWord, currentCategory } = get();

                const target = players.find(p => p.id === targetId);
                const sheriff = players.find(p => p.role === 'sheriff');
                if (!target || !sheriff || !target.isAlive || !sheriff.isAlive || sheriff.hasShot) return;

                sheriff.hasShot = true;

                let eliminatedName = '';
                let message = '';
                let wasImposter = false;

                if (target.isImposter) {
                    target.isAlive = false;
                    eliminatedName = target.name;
                    message = `Şerif düzgün vurdu! ${target.name} imposter idi.`;
                    wasImposter = true;
                } else {
                    sheriff.isAlive = false;
                    eliminatedName = sheriff.name;
                    message = `Şerif səhv adamı vurdu! Şerif ${sheriff.name} öldü.`;
                }

                const alivePlayers = players.filter(p => p.isAlive);
                const aliveImposters = alivePlayers.filter(p => p.isImposter);
                const aliveCrew = alivePlayers.filter(p => !p.isImposter && p.role !== 'jester');

                let over = false;
                let winner = null;
                let reason = null;

                if (aliveImposters.length === 0) {
                    over = true;
                    winner = 'crew';
                    reason = `Bütün imposterlər tapıldı! Vətəndaşlar qazandı! 🎉`;
                } else if (aliveImposters.length >= aliveCrew.length) {
                    over = true;
                    winner = 'imposter';
                    reason = `İmposterlar üstünlük qazandı! 😈`;
                }

                const resultPayload = {
                    eliminatedName,
                    wasImposter,
                    word: currentWord,
                    category: currentCategory,
                    imposters: players.filter(p => p.isImposter).map(p => p.name),
                    jester: players.find(p => p.role === 'jester')?.name || null,
                    sheriff: sheriff.name,
                    players
                };

                if (over) {
                    set({
                        gameState: 'result',
                        gameResult: { ...resultPayload, winner, reason }
                    });
                } else {
                    set({
                        gameState: 'next_round',
                        nextRoundInfo: {
                            ...resultPayload,
                            alivePlayers,
                            message
                        },
                        players: [...players]
                    });
                }
            },

            sheriffShootOnline: (targetId) => {
                const { roomCode } = get();
                if (roomCode) socket.emit('sheriff_shoot', { roomCode, targetId });
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
                        voteResult: null,
                        nextRoundInfo: null,
                        historyRecorded: false
                    });
                }
            },

            playAgain: () => {
                const { mode, roomCode } = get();
                if (mode === 'online' && roomCode) {
                    socket.emit('reset_game', { roomCode });
                } else {
                    set({ gameState: 'lobby', gameResult: null, historyRecorded: false });
                }
            },

            // ── Local Mode ────────────────────────────────────────────────────

            addLocalPlayer: (name) => {
                const { players, activeFrame } = get();
                if (players.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())) {
                    const t = UI_TEXTS[get().language] || UI_TEXTS['az'];
                    return { success: false, error: t.nameTaken };
                }
                // DONT set frame here globally, since local players share a phone,
                // but for simplicity we will just assign the active frame to the newly created local profile
                set({ players: [...players, { id: `local-${Date.now()}`, name: name.trim(), isHost: false, isAlive: true, votes: 0, frame: activeFrame }] });
                return { success: true };
            },

            startLocalGame: (categoryId, wordObjects, settings) => {
                const { players } = get();

                // ── Chaos Mode ────────────────────────────────────────────────────────
                let chaosEvent = null;
                if (settings.chaosMode) {
                    const events = ['blind_round'];
                    chaosEvent = events[Math.floor(Math.random() * events.length)];
                }

                const isTrollActive = settings.trollMode && Math.random() < 0.5;
                const newPlayers = players.map(p => ({ ...p, isImposter: false, role: 'crew', votes: 0, isAlive: true }));

                if (isTrollActive) {
                    newPlayers.forEach(p => { p.isImposter = true; p.role = 'imposter'; });
                } else {
                    let imposterCount = Math.min(settings.imposterCount || 1, Math.max(1, newPlayers.length - 1));
                    const indices = Array.from({ length: newPlayers.length }, (_, i) => i);
                    for (let i = indices.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [indices[i], indices[j]] = [indices[j], indices[i]];
                    }
                    const imposterSet = new Set(indices.slice(0, imposterCount));
                    newPlayers.forEach((p, i) => {
                        if (imposterSet.has(i)) { p.isImposter = true; p.role = 'imposter'; }
                    });

                    let availableCrewIndices = indices.slice(imposterCount);

                    if (settings.includeJester && availableCrewIndices.length > 0) {
                        const jesterIdx = availableCrewIndices[Math.floor(Math.random() * availableCrewIndices.length)];
                        newPlayers[jesterIdx].role = 'jester';
                        newPlayers[jesterIdx].isImposter = false;
                        availableCrewIndices = availableCrewIndices.filter(i => i !== jesterIdx);
                    }

                    if (settings.includeSheriff && availableCrewIndices.length > 0) {
                        const sheriffIdx = availableCrewIndices[Math.floor(Math.random() * availableCrewIndices.length)];
                        newPlayers[sheriffIdx].role = 'sheriff';
                        newPlayers[sheriffIdx].isImposter = false;
                    }
                }

                const catArray = Array.isArray(categoryId) ? categoryId : [categoryId];

                const crew = newPlayers.filter(p => !p.isImposter);
                const imposters = newPlayers.filter(p => p.isImposter);
                let startingPlayerId;
                if (Math.random() < 0.8 && crew.length) startingPlayerId = crew[Math.floor(Math.random() * crew.length)].id;
                else if (imposters.length) startingPlayerId = imposters[Math.floor(Math.random() * imposters.length)].id;
                else startingPlayerId = newPlayers[0].id;

                // wordObjects formatı: [{word, category}] və ya sətirlər
                let validWordObjs = Array.isArray(wordObjects) && wordObjects.length > 0
                    ? wordObjects
                    : [];

                if (validWordObjs.length > 0 && typeof validWordObjs[0] === 'string') {
                    const chosenCat = catArray[Math.floor(Math.random() * catArray.length)];
                    validWordObjs = validWordObjs.map(w => ({ word: w, category: chosenCat }));
                }

                const chosenWordObj = validWordObjs[Math.floor(Math.random() * validWordObjs.length)] || { word: '?', category: '?' };

                set({
                    mode: 'local',
                    gameState: 'local_reveal',
                    players: newPlayers,
                    selectedCategories: catArray,
                    currentWord: chosenWordObj.word,
                    currentCategory: chosenWordObj.category,
                    chaosEvent,
                    startingPlayerId,
                    isTrollActive,
                    timeLimit: settings.timeLimit,
                    imposterHint: settings.imposterHint,
                    imposterSquad: settings.imposterSquad,
                    localRevealIndex: 0,
                    historyRecorded: false
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
                    localStorage.setItem('rejoin_roomCode', roomCode);
                    localStorage.setItem('rejoin_playerName', myPlayer?.name || '');
                    set({ gameState: 'lobby', roomCode, players, currentPlayer: myPlayer, error: null });
                });

                socket.on('joined_room', ({ roomCode, players }) => {
                    const myPlayer = players.find(p => p.id === socket.id);
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
                    if (players.length > prev.length) playStoreSound('join');
                    set({ players });
                    const { currentPlayer } = get();
                    if (currentPlayer) {
                        const updated = players.find(p => p.name === currentPlayer.name);
                        if (updated) set({ currentPlayer: updated });
                    }
                });

                socket.on('player_left', ({ name, wasHost, newHostName, message }) => {
                    const notif = message || (wasHost && newHostName ? `${name} ayrıldı. Yeni host: ${newHostName} 👑` : `${name} oyundan ayrıldı.`);
                    set({ toastMessage: notif });
                    setTimeout(() => set({ toastMessage: null }), 4000);
                });

                socket.on('host_migrated', ({ message, players }) => {
                    set({ players, toastMessage: message });
                    const { currentPlayer } = get();
                    if (currentPlayer) {
                        const updated = players.find(p => p.name === currentPlayer.name);
                        if (updated) set({ currentPlayer: updated });
                    }
                    setTimeout(() => set({ toastMessage: null }), 5000);
                });

                // ── Qlobal Otaqlar ────────────────────────────────────────────

                socket.on('global_rooms', (rooms) => {
                    set({ globalRooms: rooms });
                });

                // ── Admin Şifrə ───────────────────────────────────────────────

                socket.on('admin_password_result', ({ valid }) => {
                    if (valid) set({ isSecretAdmin: true });
                });

                // ── Game Events ───────────────────────────────────────────────

                socket.on('game_started', ({
                    players, category, word, imposterCategory,
                    spyWord, adminPlayerIds,
                    startingPlayerId, isTrollActive, isImposter,
                    role, chaosEvent, settings
                }) => {
                    playStoreSound('start');

                    const myWord = isImposter ? null : (word || '');
                    const myCategory = isImposter ? (imposterCategory || category || '') : (category || '');

                    set({
                        gameState: 'playing',
                        players,
                        isImposter: isImposter || false,
                        role: role || 'crew',
                        chaosEvent: chaosEvent || null,
                        currentCategory: myCategory,
                        currentWord: myWord,
                        imposterCategory: isImposter ? (imposterCategory || category || '') : null,
                        // Spy Word Cheat: Secret Admin + Imposter olduqda əsl söz
                        spyWord: spyWord || null,
                        // Admin Radar: digər admin oyunçuların id-ləri
                        adminPlayerIds: adminPlayerIds || null,
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
                        nextRoundInfo: null,
                        historyRecorded: false,
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
                    set({ voteResult: result, players: result.players || get().players });
                });

                // ── NEXT ROUND (oyun davam edir) ──────────────────────────────
                socket.on('next_round', ({ eliminatedName, wasImposter, players, alivePlayers, message }) => {
                    set({
                        gameState: 'next_round',
                        players,
                        nextRoundInfo: {
                            eliminatedName,
                            wasImposter,
                            message,
                            alivePlayers
                        },
                        voteResult: null,
                        voteUpdate: null,
                        discussionTurn: null,
                        discussionClues: []
                    });
                });

                // ── Game Over (oyun bitir) ─────────────────────────────────────
                socket.on('game_over', (result) => {
                    if (result.winner === 'crew') playStoreSound('win');
                    else if (result.winner === 'imposter') playStoreSound('lose');
                    else playStoreSound('win');

                    set({ gameState: 'result', gameResult: result });

                    // Tarixçəyə yalnız BİR dəfə yaz
                    if (!get().historyRecorded && result.word) {
                        get().addToHistory({
                            winner: result.winner,
                            word: result.word,
                            date: Date.now(),
                            reason: result.reason
                        });

                        // Points logic (only calculate local points based on current player's role)
                        const pRole = get().currentPlayer?.role || (get().isImposter ? 'imposter' : 'crew');
                        if (result.winner === 'imposter' && pRole === 'imposter') {
                            get().addPoints(100);
                        } else if (result.winner === 'crew' && pRole === 'crew') {
                            get().addPoints(50);
                        } else if (result.winner === 'jester' && pRole === 'jester') {
                            get().addPoints(150);
                        }

                        set({ historyRecorded: true });
                    }

                    localStorage.removeItem('rejoin_roomCode');
                    localStorage.removeItem('rejoin_playerName');
                });

                // ── Misc ──────────────────────────────────────────────────────

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
                        isImposter: false,
                        nextRoundInfo: null,
                        historyRecorded: false
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
                    messages: [],
                    nextRoundInfo: null,
                    historyRecorded: false
                });
            }
        }),
        {
            name: 'game-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                theme: state.theme,
                language: state.language,
                history: state.history,
                imposterSquad: state.imposterSquad,
                points: state.points,
                unlockedFrames: state.unlockedFrames,
                activeFrame: state.activeFrame
                // isSecretAdmin persist EDİLMİR (security üçün)
            }),
        }
    )
);

useGameStore.getState().initSockets();



export const toggleVoiceChat = async () => {
    const store = useGameStore.getState();
    const { initWebRTC, startLocalStream, stopLocalStream, connectToPeers, toggleMute } = await import('./webrtc');

    if (store.voiceEnabled) {
        stopLocalStream();
        useGameStore.setState({ voiceEnabled: false, peerStreams: {} });
    } else {
        const success = await startLocalStream();
        if (success) {
            initWebRTC(socket, (peerId, stream) => {
                const updatedStreams = { ...useGameStore.getState().peerStreams, [peerId]: stream };
                useGameStore.setState({ peerStreams: updatedStreams });
            });
            const peerIds = store.players.filter(p => p.id !== socket.id).map(p => p.id);
            await connectToPeers(peerIds, (peerId, stream) => {
                const updatedStreams = { ...useGameStore.getState().peerStreams, [peerId]: stream };
                useGameStore.setState({ peerStreams: updatedStreams });
            });
            useGameStore.setState({ voiceEnabled: true });
        }
    }
};

export const setVoiceMuted = async (muted) => {
    const { toggleMute } = await import('./webrtc');
    toggleMute(muted);
};


export default useGameStore;
