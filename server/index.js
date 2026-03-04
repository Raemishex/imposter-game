const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Admin şifrəsi ────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ramazan2003';

// ─── In-memory storage ────────────────────────────────────────────────────────
const rooms = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Özəl otaqlar üçün 4 rəqəmli random kod (ör: 5921)
const generateNumericCode = () => {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    return rooms[code] ? generateNumericCode() : code;
};

// Açıq otaqlar üçün köhnə A-Z kod (fallback)
const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return rooms[code] ? generateRoomCode() : code;
};

// ─── Discussion Turn Manager ──────────────────────────────────────────────────
const discussionTimers = {}; // roomCode -> { timer, afkTimer, turnIndex, clues, duration }
const DEFAULT_TURN_DURATION = 60; // seconds
const AFK_MAX_DURATION = 300;     // 5 dəqiqə AFK limiti (timeLimit olmasa belə keçir)

function startDiscussionTurn(roomCode) {
    const room = rooms[roomCode];
    const state = discussionTimers[roomCode];
    if (!room || !state || !room.discussionOrder.length) return;

    // Köhnə timer-ləri təmizlə
    if (state.timer) clearTimeout(state.timer);
    if (state.afkTimer) clearTimeout(state.afkTimer);

    const { turnIndex, duration } = state;
    const currentPlayerId = room.discussionOrder[turnIndex];
    const currentPlayer = room.players.find(p => p.id === currentPlayerId);

    io.to(roomCode).emit('discussion_turn', {
        turnIndex,
        totalTurns: room.discussionOrder.length,
        currentPlayerId,
        currentPlayerName: currentPlayer?.name || '?',
        timeLeft: duration,
        clues: state.clues
    });

    console.log(`[${roomCode}] Turn ${turnIndex + 1}/${room.discussionOrder.length}: ${currentPlayer?.name} (${duration}s)`);

    // Vaxt limiti aktivdirsə → turn vaxtı bitdikdə auto-pass
    if (duration) {
        state.timer = setTimeout(() => {
            advanceDiscussionTurn(roomCode, null);
        }, duration * 1000);
    }

    // AFK auto-pass: hər halda max AFK_MAX_DURATION saniyə sonra keçir
    state.afkTimer = setTimeout(() => {
        if (discussionTimers[roomCode] && discussionTimers[roomCode].turnIndex === turnIndex) {
            console.log(`[${roomCode}] AFK auto-pass: ${currentPlayer?.name}`);
            advanceDiscussionTurn(roomCode, null);
        }
    }, AFK_MAX_DURATION * 1000);
}

function advanceDiscussionTurn(roomCode, clue) {
    const room = rooms[roomCode];
    const state = discussionTimers[roomCode];
    if (!room || !state) return;

    if (state.timer) clearTimeout(state.timer);
    if (state.afkTimer) clearTimeout(state.afkTimer);
    state.timer = null;
    state.afkTimer = null;

    const currentPlayerId = room.discussionOrder[state.turnIndex];
    const currentPlayer = room.players.find(p => p.id === currentPlayerId);
    state.clues.push({
        name: currentPlayer?.name || '?',
        playerId: currentPlayerId,
        text: clue || null,
        passed: !clue
    });

    const nextIndex = state.turnIndex + 1;

    if (nextIndex >= room.discussionOrder.length) {
        io.to(roomCode).emit('discussion_ended', { clues: state.clues });

        setTimeout(() => {
            io.to(roomCode).emit('start_voting');
        }, 3000);

        delete discussionTimers[roomCode];
        console.log(`[${roomCode}] Discussion ended. Transitioning to voting.`);
    } else {
        state.turnIndex = nextIndex;
        startDiscussionTurn(roomCode);
    }
}

// ─── Win Condition Checker ────────────────────────────────────────────────────
function checkWinCondition(room) {
    const alive = room.players.filter(p => p.isAlive);
    const aliveImposters = alive.filter(p => p.isImposter);
    const aliveCrew = alive.filter(p => !p.isImposter && p.role !== 'jester'); // jester dahil DEĞİL

    if (aliveImposters.length === 0) {
        return { over: true, winner: 'crew', reason: 'Bütün imposterlar tapıldı! Vətəndaşlar qazandı! 🎉' };
    }
    if (aliveImposters.length >= aliveCrew.length) {
        return { over: true, winner: 'imposter', reason: 'İmposterlar üstünlük qazandı! 😈' };
    }
    return { over: false };
}

function processVotesIfComplete(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'voting') return;

    const alivePlayers = room.players.filter(p => p.isAlive);
    const votedCount = Object.keys(room.votes).length;

    // Send the vote update
    io.to(roomCode).emit('vote_update', {
        votes: room.votes,
        votedCount,
        totalVoters: alivePlayers.length
    });

    // Check if everyone has voted
    if (votedCount >= alivePlayers.length && alivePlayers.length > 0) {
        // Səs sayımı
        const tally = {};
        Object.values(room.votes).forEach(tid => {
            if (tid !== null && tid !== -1) {
                tally[tid] = (tally[tid] || 0) + 1;
            }
        });

        // Ən çox səs alan oyunçunu tap
        let maxVotes = 0;
        let eliminatedId = null;
        let isTie = false;

        for (const [pid, count] of Object.entries(tally)) {
            if (count > maxVotes) {
                maxVotes = count;
                eliminatedId = pid;
                isTie = false;
            } else if (count === maxVotes) {
                isTie = true;
            }
        }

        if (isTie || maxVotes === 0) {
            // Bərabərlik və ya heç kim səs verməyib
            room.votes = {};

            const voteResultPayload = {
                eliminatedName: 'Heç kim',
                wasImposter: false,
                isJester: false,
                word: room.currentWord,
                category: room.currentCategory,
                imposters: room.players.filter(p => p.isImposter).map(p => p.name),
                jester: room.players.find(p => p.role === 'jester')?.name || null,
                players: room.players
            };

            io.to(roomCode).emit('vote_result', voteResultPayload);

            room.gameState = 'next_round';
            room.discussionOrder = room.players.filter(p => p.isAlive).map(p => p.id);

            io.to(roomCode).emit('next_round', {
                eliminatedName: 'Heç kim',
                wasImposter: false,
                players: room.players,
                alivePlayers: room.players.filter(p => p.isAlive),
                message: 'Səslər bərabərdir. Heç kim atılmadı!'
            });
            console.log(`[VOTE] ${roomCode}: Səslər bərabərdir və ya səs verilmədi. Oyun davam edir.`);
            return;
        }

        const eliminated = room.players.find(p => p.id === eliminatedId);
        const wasImposter = eliminated?.isImposter || false;
        const isJester = eliminated?.role === 'jester';

        // Oyunçunu öldür
        if (eliminated) eliminated.isAlive = false;

        // Votes sıfırla
        room.votes = {};

        // vote_result: kim atıldı
        const voteResultPayload = {
            eliminatedName: eliminated?.name || 'Naməlum',
            wasImposter,
            isJester,
            word: room.currentWord,
            category: room.currentCategory,
            imposters: room.players.filter(p => p.isImposter).map(p => p.name),
            jester: room.players.find(p => p.role === 'jester')?.name || null,
            players: room.players
        };

        io.to(roomCode).emit('vote_result', voteResultPayload);

        // ── Win Condition Yoxlaması ───────────────────────────────────────
        if (isJester) {
            // Jester atılıb → Jester qazanır
            const result = {
                ...voteResultPayload,
                winner: 'jester',
                reason: `${eliminated?.name} Jester idi! Jester qazandı! 🎠`
            };
            room.gameState = 'result';
            io.to(roomCode).emit('game_over', result);
            console.log(`[VOTE] ${roomCode}: Jester wins. Eliminated: ${eliminated?.name}`);

        } else {
            const winCheck = checkWinCondition(room);

            if (winCheck.over) {
                // Oyun bitir
                const result = {
                    ...voteResultPayload,
                    winner: winCheck.winner,
                    reason: wasImposter
                        ? (winCheck.winner === 'crew'
                            ? `${eliminated?.name} imposter idi! Vətəndaşlar qazandı! 🎉`
                            : winCheck.reason)
                        : (winCheck.winner === 'imposter'
                            ? `${eliminated?.name} vətəndaş idi! İmposterlar üstünlük qazandı! 😈`
                            : winCheck.reason)
                };
                room.gameState = 'result';
                io.to(roomCode).emit('game_over', result);
                console.log(`[VOTE] ${roomCode}: ${winCheck.winner} wins. Eliminated: ${eliminated?.name}`);

            } else {
                // Oyun davam edir → next_round
                room.gameState = 'next_round';

                // Yeni discussion order: yalnız alive oyunçular
                room.discussionOrder = room.players
                    .filter(p => p.isAlive)
                    .map(p => p.id);

                io.to(roomCode).emit('next_round', {
                    eliminatedName: eliminated?.name || 'Naməlum',
                    wasImposter,
                    players: room.players,
                    alivePlayers: room.players.filter(p => p.isAlive),
                    message: wasImposter
                        ? `${eliminated?.name} imposter idi! Oyun davam edir...`
                        : `${eliminated?.name} vətəndaş idi! Oyun davam edir...`
                });

                console.log(`[VOTE] ${roomCode}: Round continues. Eliminated: ${eliminated?.name} (${wasImposter ? 'imposter' : 'crew'})`);
            }
        }
    }
}

// ─── Socket Handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

    // ── Create Room ──────────────────────────────────────────────────────────
    socket.on('create_room', ({ playerName, isPrivate = false, roomName = '', region = 'Global' }) => {
        let roomCode;
        if (isPrivate) {
            // Özəl otaq → 4 rəqəmli avto-kod
            roomCode = generateNumericCode();
        } else {
            // Açıq otaq → host-un verdiyi ad (boşsa avto-kod)
            const sanitized = (roomName || '').trim().toUpperCase().replace(/[^A-Z0-9 ÇƏĞIİÖÜŞ]/gi, '').slice(0, 20);
            if (sanitized && !rooms[sanitized]) {
                roomCode = sanitized;
            } else {
                roomCode = generateRoomCode();
            }
        }

        rooms[roomCode] = {
            id: roomCode,
            roomName: isPrivate ? `Özəl #${roomCode}` : (roomName.trim() || roomCode),
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true,
                isImposter: false,
                isAlive: true,
                votes: 0,
                frame
            }],
            gameState: 'lobby',
            isPrivate: !!isPrivate,
            region: region || 'Global',
            settings: { imposterCount: 1, timeLimit: false, imposterHint: false, imposterSquad: false },
            currentWordObj: null,
            currentWord: '',
            currentCategory: '',
            discussionOrder: [],
            votes: {},
            usedWords: [],
            round: 0
        };
        socket.join(roomCode);
        socket.emit('room_created', { roomCode, players: rooms[roomCode].players });
        console.log(`[ROOM] "${roomCode}" created by ${playerName} (${isPrivate ? 'özəl' : 'açıq'}, region: ${region})`);
        broadcastGlobalRooms();
    });


    // ── Join Room ────────────────────────────────────────────────────────────
    socket.on('join_room', ({ roomCode, playerName }) => {
        const input = (roomCode || '').trim().toUpperCase();
        // Əvvəlcə dəqiq roomCode ilə axtar
        let code = input;
        let room = rooms[code];
        // Tapılmadısa → roomName ilə axtar (açıq otaqlar üçün)
        if (!room) {
            const found = Object.entries(rooms).find(([, r]) =>
                (r.roomName || '').toUpperCase() === input && !r.isPrivate
            );
            if (found) { code = found[0]; room = found[1]; }
        }
        if (!room) { socket.emit('error', 'Otaq tapılmadı!'); return; }
        if (room.gameState !== 'lobby') { socket.emit('error', 'Oyun artıq başlayıb!'); return; }
        if (room.players.find(p => p.name === playerName)) { socket.emit('error', 'Bu ad artıq istifadə olunur!'); return; }

        const newPlayer = { id: socket.id, name: playerName, isHost: false, isImposter: false, isAlive: true, votes: 0 };
        room.players.push(newPlayer);
        socket.join(code);
        io.to(code).emit('update_players', room.players);
        socket.emit('joined_room', { roomCode: code, players: room.players });
        console.log(`[JOIN] ${playerName} -> ${code}`);
    });

    // ── Rejoin Room ──────────────────────────────────────────────────────────
    socket.on('rejoin_room', ({ roomCode, playerName }) => {
        const code = roomCode?.toUpperCase();
        const room = rooms[code];
        if (!room) { socket.emit('error', 'Otaq artıq mövcud deyil.'); return; }

        const existingPlayer = room.players.find(p => p.name === playerName);
        if (!existingPlayer) { socket.emit('error', 'Oyunçu tapılmadı.'); return; }

        const oldId = existingPlayer.id;
        existingPlayer.id = socket.id;

        if (room.discussionOrder) {
            const idx = room.discussionOrder.indexOf(oldId);
            if (idx !== -1) room.discussionOrder[idx] = socket.id;
        }

        socket.join(code);

        socket.emit('rejoined_room', {
            roomCode: code,
            players: room.players,
            gameState: room.gameState,
            currentWord: existingPlayer.isImposter ? room.currentCategory : room.currentWord,
            currentCategory: room.currentCategory,
            isImposter: existingPlayer.isImposter,
            isHost: existingPlayer.isHost,
            role: existingPlayer.role || 'crew',
            chaosEvent: room.chaosEvent || null,
            discussionTurn: discussionTimers[code] ? {
                turnIndex: discussionTimers[code].turnIndex,
                totalTurns: room.discussionOrder.length,
                currentPlayerId: room.discussionOrder[discussionTimers[code].turnIndex],
                clues: discussionTimers[code].clues
            } : null
        });

        io.to(code).emit('update_players', room.players);
        console.log(`[REJOIN] ${playerName} rejoined ${code} (old: ${oldId} -> new: ${socket.id})`);
    });

    // ── Get Global Rooms ─────────────────────────────────────────────────────
    socket.on('get_global_rooms', ({ region } = {}) => {
        const publicRooms = Object.values(rooms)
            .filter(r => {
                if (r.isPrivate || r.gameState !== 'lobby') return false;
                if (region && region !== 'Global' && r.region !== region) return false;
                return true;
            })
            .map(r => ({
                roomCode: r.id,
                roomName: r.roomName || r.id,
                playerCount: r.players.length,
                hostName: r.players.find(p => p.isHost)?.name || '?',
                region: r.region || 'Global'
            }));
        socket.emit('global_rooms', publicRooms);
    });

    // ── Check Admin Password ─────────────────────────────────────────────────
    socket.on('check_admin_password', ({ password, roomCode }) => {
        const valid = password === ADMIN_PASSWORD;
        socket.emit('admin_password_result', { valid });
        // Otaq varsa, bu socket-i admin kimi qeyd et (Admin Radar + Spy Word üçün)
        if (valid && roomCode && rooms[roomCode]) {
            if (!rooms[roomCode].adminSocketIds) rooms[roomCode].adminSocketIds = new Set();
            rooms[roomCode].adminSocketIds.add(socket.id);
            console.log(`[ADMIN] ${socket.id} admin olaraq qeydiyyatdan keçdi (${roomCode})`);
        }
    });

    // ── Start Game ───────────────────────────────────────────────────────────
    // wordObjects: [{word: string, category: string}]
    socket.on('start_game', ({ roomCode, categoryIds, wordObjects, settings }) => {
        const room = rooms[roomCode];
        if (!room) return;

        if (discussionTimers[roomCode]?.timer) {
            clearTimeout(discussionTimers[roomCode].timer);
            delete discussionTimers[roomCode];
        }

        const host = room.players.find(p => p.id === socket.id);
        if (!host?.isHost) { socket.emit('error', 'Yalnız host oyunu başlada bilər!'); return; }

        if (settings) room.settings = { ...room.settings, ...settings };

        // Kateqoriya seçimi (geri uyğunluq: əgər wordObjects yoxdursa categoryIds istifadə et)
        const catArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds];

        // Söz seçimi: wordObjects formatında [{word, category}]
        let availableWords = Array.isArray(wordObjects) ? wordObjects : [];

        // Əgər köhnə format (yalnız stringlər) göndərilibsə, dönüştür
        if (availableWords.length > 0 && typeof availableWords[0] === 'string') {
            const chosenCat = catArray[Math.floor(Math.random() * catArray.length)];
            availableWords = availableWords.map(w => ({ word: w, category: chosenCat }));
        }

        // Təkrarlanan söz önləmə: usedWords-u filtrə et
        let filtered = availableWords.filter(w => !room.usedWords.includes(w.word));
        if (filtered.length === 0) {
            // Hamısı işlənilib — sıfırla
            room.usedWords = [];
            filtered = availableWords;
        }

        // Söz seç
        const wordObj = filtered[Math.floor(Math.random() * filtered.length)];
        room.currentWordObj = wordObj;
        room.currentWord = wordObj?.word || '';
        room.currentCategory = wordObj?.category || '';
        room.usedWords.push(wordObj?.word || '');
        room.gameState = 'playing';
        room.votes = {};
        room.readyPlayers = new Set();
        room.round = (room.round || 0) + 1;

        // ── Chaos Mode ────────────────────────────────────────────────────────
        let chaosEvent = null;
        if (room.settings.chaosMode) {
            const events = ['blind_round', 'speed_run'];
            if (room.players.length > 5) events.push('double_trouble');
            chaosEvent = events[Math.floor(Math.random() * events.length)];
            room.chaosEvent = chaosEvent;
        } else {
            room.chaosEvent = null;
        }

        // ── Rol Təyin Etmə ────────────────────────────────────────────────────
        const playerCount = room.players.length;
        const isTrollActive = room.settings.trollMode && Math.random() < 0.5;

        // Bütün oyunçuları sıfırla: isAlive = true
        room.players.forEach(p => { p.isImposter = false; p.role = 'crew'; p.votes = 0; p.isAlive = true; });

        if (isTrollActive) {
            room.players.forEach(p => { p.isImposter = true; p.role = 'imposter'; });
        } else {
            let imposterCount = chaosEvent === 'double_trouble'
                ? Math.min(2, Math.max(1, playerCount - 1))
                : Math.min(room.settings.imposterCount || 1, Math.max(1, playerCount - 1));

            const indices = Array.from({ length: playerCount }, (_, i) => i);
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }

            const imposterSet = new Set(indices.slice(0, imposterCount));
            room.players.forEach((p, i) => {
                if (imposterSet.has(i)) { p.isImposter = true; p.role = 'imposter'; }
            });

            let specialRolesAssigned = 0;

            if (room.settings.includeJester && playerCount > imposterCount + specialRolesAssigned + 1) {
                const crewIndices = indices.slice(imposterCount + specialRolesAssigned);
                if (crewIndices.length > 0) {
                    const jesterIdx = crewIndices[Math.floor(Math.random() * crewIndices.length)];
                    room.players[jesterIdx].role = 'jester';
                    room.players[jesterIdx].isImposter = false;
                    specialRolesAssigned++;
                    // Remove assigned index to avoid overlap
                    const indexToRemove = indices.indexOf(jesterIdx);
                    if (indexToRemove > -1) indices.splice(indexToRemove, 1);
                }
            }

            if (room.settings.includeSheriff && playerCount > imposterCount + specialRolesAssigned + 1) {
                const crewIndices = indices.slice(imposterCount + specialRolesAssigned);
                if (crewIndices.length > 0) {
                    const sheriffIdx = crewIndices[Math.floor(Math.random() * crewIndices.length)];
                    room.players[sheriffIdx].role = 'sheriff';
                    room.players[sheriffIdx].isImposter = false;
                    room.players[sheriffIdx].hasShot = false; // Initialize hasShot property
                    specialRolesAssigned++;
                }
            }
        }

        // Başlanğıc oyunçu
        const crew = room.players.filter(p => !p.isImposter);
        const imposters = room.players.filter(p => p.isImposter);
        let startingPlayerId;
        if (Math.random() < 0.8 && crew.length > 0) startingPlayerId = crew[Math.floor(Math.random() * crew.length)].id;
        else if (imposters.length > 0) startingPlayerId = imposters[Math.floor(Math.random() * imposters.length)].id;
        else startingPlayerId = room.players[0].id;

        const startIdx = room.players.findIndex(p => p.id === startingPlayerId);
        room.discussionOrder = [
            ...room.players.slice(startIdx),
            ...room.players.slice(0, startIdx)
        ].map(p => p.id);

        // ── Hər oyunçuya ayrı-ayrı emit ──────────────────────────────────────
        // Admin socket id-lərini topla (Spy Word + Admin Radar üçün)
        const adminIds = room.adminSocketIds ? [...room.adminSocketIds] : [];

        room.players.forEach(player => {
            const targetSocket = io.sockets.sockets.get(player.id);
            if (targetSocket) {
                const visibleCategory = chaosEvent === 'blind_round' ? null : room.currentCategory;
                const isAdmin = adminIds.includes(player.id);

                // KRİTİK: Crew → sözü görür, Imposter → yalnız kateqoriyanı görür
                const wordForPlayer = (player.isImposter && player.role !== 'jester')
                    ? null
                    : room.currentWord;

                // Spy Word Cheat: Secret Admin + Imposter → əsl sözü bilir
                const spyWord = (isAdmin && player.isImposter && player.role !== 'jester')
                    ? room.currentWord
                    : null;

                // Admin Radar: digər admin oyunçuların id-lərini göndər
                const adminPlayerIds = isAdmin
                    ? adminIds.filter(id => id !== player.id)
                    : null;

                targetSocket.emit('game_started', {
                    players: room.players,
                    category: visibleCategory,
                    word: wordForPlayer,
                    imposterCategory: (player.isImposter && player.role !== 'jester') ? room.currentCategory : null,
                    spyWord,           // Spy Word Cheat (null if not admin imposter)
                    adminPlayerIds,    // Admin Radar (null if not admin)
                    startingPlayerId,
                    isTrollActive,
                    isImposter: player.isImposter,
                    role: player.role || 'crew',
                    chaosEvent,
                    settings: room.settings
                });
            }
        });

        console.log(`[GAME] ${roomCode} round ${room.round} started. Word: ${room.currentWord}, Cat: ${room.currentCategory}`);
        broadcastGlobalRooms();
    });

    // ── WebRTC Signaling ──────────────────────────────────────────────────────
    socket.on('webrtc_offer', ({ targetId, offer }) => {
        io.to(targetId).emit('webrtc_offer', { offer, senderId: socket.id });
    });

    socket.on('webrtc_answer', ({ targetId, answer }) => {
        io.to(targetId).emit('webrtc_answer', { answer, senderId: socket.id });
    });

    socket.on('webrtc_ice_candidate', ({ targetId, candidate }) => {
        io.to(targetId).emit('webrtc_ice_candidate', { candidate, senderId: socket.id });
    });

    // ── Player Ready ─────────────────────────────────────────────────────────
    socket.on('player_ready', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        if (!room.readyPlayers) room.readyPlayers = new Set();
        room.readyPlayers.add(socket.id);

        const readyCount = room.readyPlayers.size;
        const totalCount = room.players.length;

        io.to(roomCode).emit('ready_update', {
            readyCount,
            totalCount,
            allReady: readyCount >= totalCount
        });

        console.log(`[READY] ${roomCode}: ${readyCount}/${totalCount} hazır`);
    });

    // ── Start Discussion ──────────────────────────────────────────────────────
    socket.on('start_discussion', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const host = room.players.find(p => p.id === socket.id);
        if (!host?.isHost) { socket.emit('error', 'Yalnız host müzakirəni başlada bilər!'); return; }

        if (room.gameState === 'lobby' || room.gameState === 'playing') {
            const readyCount = room.readyPlayers?.size || 0;
            const totalCount = room.players.length;
            if (readyCount < totalCount) {
                socket.emit('error', `Hələ ${totalCount - readyCount} oyunçu hazır deyil!`);
                return;
            }
        }

        let duration = room.settings.timeLimit ? parseInt(room.settings.timeLimit) : DEFAULT_TURN_DURATION;
        if (room.chaosEvent === 'speed_run') duration = Math.max(15, Math.floor(duration / 2));

        discussionTimers[roomCode] = { turnIndex: 0, clues: [], timer: null, duration };
        room.gameState = 'discussion';

        startDiscussionTurn(roomCode);
    });

    // ── Submit Clue ──────────────────────────────────────────────────────────
    socket.on('submit_clue', ({ roomCode, clue }) => {
        const room = rooms[roomCode];
        const state = discussionTimers[roomCode];
        if (!room || !state) return;

        const currentPlayerId = room.discussionOrder[state.turnIndex];
        if (socket.id !== currentPlayerId) {
            socket.emit('error', 'Sıra sizin deyil!');
            return;
        }

        advanceDiscussionTurn(roomCode, clue?.trim() || null);
    });

    // ── Pass Turn ────────────────────────────────────────────────────────────
    socket.on('pass_turn', ({ roomCode }) => {
        const room = rooms[roomCode];
        const state = discussionTimers[roomCode];
        if (!room || !state) return;

        const currentPlayerId = room.discussionOrder[state.turnIndex];
        if (socket.id !== currentPlayerId) {
            socket.emit('error', 'Sıra sizin deyil!');
            return;
        }

        advanceDiscussionTurn(roomCode, null);
    });

    // ── Vote ─────────────────────────────────────────────────────────────────
    socket.on('vote', ({ roomCode, targetId }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const voter = room.players.find(p => p.id === socket.id);
        if (!voter || !voter.isAlive) return;

        room.votes[socket.id] = targetId;

        processVotesIfComplete(roomCode);
    });

    // ── Sheriff Shoot ────────────────────────────────────────────────────────
    socket.on('sheriff_shoot', ({ roomCode, targetId }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const sheriff = room.players.find(p => p.id === socket.id);
        // Ensure sheriff has not already shot someone (only one shot allowed)
        if (!sheriff || sheriff.role !== 'sheriff' || !sheriff.isAlive || sheriff.hasShot) return;

        const target = room.players.find(p => p.id === targetId);
        if (!target || !target.isAlive) return;

        sheriff.hasShot = true;

        let eliminatedName = '';
        let message = '';
        let wasImposter = false;

        if (target.isImposter) {
            // Sheriff vurur imposter-i -> Imposter ölür
            target.isAlive = false;
            eliminatedName = target.name;
            message = `Şerif düzgün vurdu! ${target.name} imposter idi.`;
            wasImposter = true;
        } else {
            // Sheriff vurur vətəndaşı -> Sheriff özü ölür
            sheriff.isAlive = false;
            eliminatedName = sheriff.name;
            message = `Şerif səhv adamı vurdu! Şerif ${sheriff.name} öldü.`;
        }

        // Yeni discussion order: yalnız alive oyunçular
        room.discussionOrder = room.players
            .filter(p => p.isAlive)
            .map(p => p.id);

        const payload = {
            eliminatedName,
            wasImposter,
            word: room.currentWord,
            category: room.currentCategory,
            imposters: room.players.filter(p => p.isImposter).map(p => p.name),
            jester: room.players.find(p => p.role === 'jester')?.name || null,
            sheriff: sheriff.name,
            players: room.players
        };

        const winCheck = checkWinCondition(room);

        if (winCheck.over) {
            const result = {
                ...payload,
                winner: winCheck.winner,
                reason: winCheck.reason
            };
            room.gameState = 'result';
            io.to(roomCode).emit('game_over', result);
            console.log(`[SHERIFF] ${roomCode}: ${winCheck.winner} wins. Shot result: ${message}`);
        } else {
            room.gameState = 'next_round';
            io.to(roomCode).emit('next_round', {
                ...payload,
                alivePlayers: room.players.filter(p => p.isAlive),
                message
            });
            console.log(`[SHERIFF] ${roomCode}: Round continues. Shot result: ${message}`);
        }
    });

    // ── Imposter Last Guess ──────────────────────────────────────────────────
    socket.on('imposter_guess', ({ roomCode, guess }) => {
        const room = rooms[roomCode];
        if (!room) return;
        const correct = guess.trim().toLowerCase() === room.currentWord.toLowerCase();
        const result = {
            winner: correct ? 'imposter' : 'crew',
            reason: correct ? 'Imposter sözü tapdı! 🎯' : 'Imposter sözü tapa bilmədi!',
            word: room.currentWord,
            imposters: room.players.filter(p => p.isImposter).map(p => p.name)
        };
        room.gameState = 'result';
        io.to(roomCode).emit('game_over', result);
    });

    // ── Reset Game ────────────────────────────────────────────────────────────
    socket.on('reset_game', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const host = room.players.find(p => p.id === socket.id);
        if (!host?.isHost) { socket.emit('error', 'Yalnız host yenidən başlada bilər!'); return; }

        if (discussionTimers[roomCode]?.timer) {
            clearTimeout(discussionTimers[roomCode].timer);
            delete discussionTimers[roomCode];
        }

        room.gameState = 'lobby';
        room.currentWord = '';
        room.currentWordObj = null;
        room.currentCategory = '';
        room.votes = {};
        room.discussionOrder = [];
        room.players.forEach(p => {
            p.isAlive = true;
            p.isImposter = false;
            p.votes = 0;
        });

        io.to(roomCode).emit('game_reset', {
            gameState: 'lobby',
            players: room.players
        });

        broadcastGlobalRooms();
        console.log(`[RESET] ${roomCode} reset by host. Players: ${room.players.map(p => p.name).join(', ')}`);
    });

    // ── Leave Room ────────────────────────────────────────────────────────────
    socket.on('leave_room', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        room.players = room.players.filter(p => p.id !== socket.id);
        socket.leave(roomCode);

        if (room.players.length === 0) {
            if (discussionTimers[roomCode]?.timer) clearTimeout(discussionTimers[roomCode].timer);
            delete discussionTimers[roomCode];
            delete rooms[roomCode];
        } else {
            if (!room.players.some(p => p.isHost)) room.players[0].isHost = true;
            io.to(roomCode).emit('update_players', room.players);
        }

        broadcastGlobalRooms();
    });

    // ── Chat ──────────────────────────────────────────────────────────────────
    socket.on('send_message', ({ roomCode, playerName, text }) => {
        const room = rooms[roomCode];
        if (!room) return;
        io.to(roomCode).emit('receive_message', { playerName, text, timestamp: Date.now() });
    });

    // ── Return to Lobby ───────────────────────────────────────────────────────
    socket.on('return_to_lobby', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const host = room.players.find(p => p.id === socket.id);
        if (!host?.isHost) { socket.emit('error', 'Yalnız host lobbyə qayıda bilər!'); return; }

        room.gameState = 'lobby';
        room.currentWord = '';
        room.currentWordObj = null;
        room.currentCategory = '';
        room.votes = {};
        room.discussionOrder = [];
        room.players.forEach(p => { p.isAlive = true; p.isImposter = false; p.votes = 0; });

        if (discussionTimers[roomCode]?.timer) clearTimeout(discussionTimers[roomCode].timer);
        delete discussionTimers[roomCode];

        io.to(roomCode).emit('game_reset', { gameState: 'lobby', players: room.players });

        broadcastGlobalRooms();
        console.log(`[RESET] ${roomCode} returned to lobby`);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] ${socket.id}`);

        // Oyun fazasında dərhal update et (ghost player önlə)
        for (const code in rooms) {
            const room = rooms[code];
            const player = room.players.find(p => p.id === socket.id);
            if (!player) continue;

            const activeGameStates = ['playing', 'discussion', 'voting', 'discussion_ended'];
            if (activeGameStates.includes(room.gameState)) {
                // Aktiv oyunda: dərhal update göndər (grace period yoxdur)
                console.log(`[DISCONNECT] ${player.name} oyun zamanı ayrıldı (${code})`);

                // Discussion order-dan çıxar
                room.discussionOrder = room.discussionOrder.filter(id => id !== socket.id);

                // Həmin oyunçunun votunu sil
                delete room.votes[socket.id];

                io.to(code).emit('player_left', {
                    name: player.name,
                    wasHost: player.isHost,
                    newHostName: null,
                    message: `${player.name} oyundan ayrıldı.`
                });

                // Əgər aktiv voting varsa, vote sayını yenidən yoxla
                if (room.gameState === 'voting') {
                    processVotesIfComplete(code);
                }
            }
            break;
        }

        // 15 saniiyəlik grace period: reconnect imkanı ver
        setTimeout(() => {
            for (const code in rooms) {
                const room = rooms[code];
                const idx = room.players.findIndex(p => p.id === socket.id);
                if (idx === -1) continue;

                const leavingPlayer = room.players[idx];
                const wasHost = leavingPlayer.isHost;

                room.players.splice(idx, 1);

                if (room.players.length === 0) {
                    if (discussionTimers[code]?.timer) clearTimeout(discussionTimers[code].timer);
                    delete discussionTimers[code];
                    delete rooms[code];
                    console.log(`[ROOM] ${code} silindi (boş)`);
                    broadcastGlobalRooms();
                    break;
                }

                if (wasHost) {
                    const newHost = room.players[0];
                    newHost.isHost = true;
                    io.to(newHost.id).emit('host_migrated', {
                        message: `${leavingPlayer.name} ayrıldı. Siz yeni host oldunuz! 👑`,
                        players: room.players
                    });
                    console.log(`[HOST] ${code}: ${leavingPlayer.name} ayrıldı → ${newHost.name} yeni host`);
                }

                io.to(code).emit('update_players', room.players);

                // Oyun fazasında alive win condition yenidən yoxla
                const activeGameStates = ['playing', 'discussion', 'voting'];
                if (activeGameStates.includes(room.gameState)) {
                    const winCheck = checkWinCondition(room);
                    if (winCheck.over) {
                        room.gameState = 'result';
                        io.to(code).emit('game_over', {
                            winner: winCheck.winner,
                            reason: winCheck.reason + ` (${leavingPlayer.name} ayrıldı)`,
                            word: room.currentWord,
                            imposters: room.players.filter(p => p.isImposter).map(p => p.name)
                        });
                    }
                }

                broadcastGlobalRooms();
                break;
            }
        }, 15000);
    });
});

// ─── Qlobal Otaq Yayımı ────────────────────────────────────────────────────────
function broadcastGlobalRooms() {
    const publicRooms = Object.values(rooms)
        .filter(r => !r.isPrivate && r.gameState === 'lobby')
        .map(r => ({
            roomCode: r.id,
            roomName: r.roomName || r.id,
            playerCount: r.players.length,
            hostName: r.players.find(p => p.isHost)?.name || '?',
            region: r.region || 'Global'
        }));
    io.emit('global_rooms', publicRooms);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
