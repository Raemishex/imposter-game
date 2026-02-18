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

// ─── In-memory storage ────────────────────────────────────────────────────────
const rooms = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return rooms[code] ? generateRoomCode() : code;
};

// ─── Discussion Turn Manager ──────────────────────────────────────────────────
const discussionTimers = {}; // roomCode -> { timer, turnIndex, clues, duration }
const DEFAULT_TURN_DURATION = 60; // seconds

function startDiscussionTurn(roomCode) {
    const room = rooms[roomCode];
    const state = discussionTimers[roomCode];
    if (!room || !state || !room.discussionOrder.length) return;

    // Clear any existing timer
    if (state.timer) clearTimeout(state.timer);

    const { turnIndex, duration } = state;
    const currentPlayerId = room.discussionOrder[turnIndex];
    const currentPlayer = room.players.find(p => p.id === currentPlayerId);

    // Broadcast turn info to ALL players in room
    io.to(roomCode).emit('discussion_turn', {
        turnIndex,
        totalTurns: room.discussionOrder.length,
        currentPlayerId,
        currentPlayerName: currentPlayer?.name || '?',
        timeLeft: duration,
        clues: state.clues
    });

    console.log(`[${roomCode}] Turn ${turnIndex + 1}/${room.discussionOrder.length}: ${currentPlayer?.name} (${duration}s)`);

    // Auto-advance when time runs out
    state.timer = setTimeout(() => {
        advanceDiscussionTurn(roomCode, null);
    }, duration * 1000);
}

function advanceDiscussionTurn(roomCode, clue) {
    const room = rooms[roomCode];
    const state = discussionTimers[roomCode];
    if (!room || !state) return;

    // Clear timer
    if (state.timer) clearTimeout(state.timer);

    // Save this player's clue
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
        // All players done → emit summary, then transition to voting
        io.to(roomCode).emit('discussion_ended', { clues: state.clues });

        // Give players 3s to see the summary before voting starts
        setTimeout(() => {
            io.to(roomCode).emit('start_voting');
        }, 3000);

        delete discussionTimers[roomCode];
        console.log(`[${roomCode}] Discussion ended. Transitioning to voting.`);
    } else {
        // Move to next player
        state.turnIndex = nextIndex;
        startDiscussionTurn(roomCode);
    }
}

// ─── Socket Handlers ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

    // ── Create Room ──────────────────────────────────────────────────────────
    socket.on('create_room', ({ playerName }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            id: roomCode,
            players: [{
                id: socket.id,
                name: playerName,
                isHost: true,
                isImposter: false,
                isAlive: true,
                votes: 0
            }],
            gameState: 'lobby',
            settings: { imposterCount: 1, timeLimit: false, imposterHint: false, imposterSquad: false },
            currentWord: '',
            currentCategory: '',
            discussionOrder: [],
            votes: {}
        };
        socket.join(roomCode);
        socket.emit('room_created', { roomCode, players: rooms[roomCode].players });
        console.log(`[ROOM] ${roomCode} created by ${playerName}`);
    });

    // ── Join Room ────────────────────────────────────────────────────────────
    socket.on('join_room', ({ roomCode, playerName }) => {
        const code = roomCode.toUpperCase();
        const room = rooms[code];
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

    // ── Rejoin Room (after refresh/reconnect) ────────────────────────────────
    socket.on('rejoin_room', ({ roomCode, playerName }) => {
        const code = roomCode?.toUpperCase();
        const room = rooms[code];
        if (!room) { socket.emit('error', 'Otaq artıq mövcud deyil.'); return; }

        // Find the player by name (since socket.id changed after refresh)
        const existingPlayer = room.players.find(p => p.name === playerName);
        if (!existingPlayer) { socket.emit('error', 'Oyunçu tapılmadı.'); return; }

        // Update the player's socket ID to the new one
        const oldId = existingPlayer.id;
        existingPlayer.id = socket.id;

        // Also update discussionOrder if it contains the old ID
        if (room.discussionOrder) {
            const idx = room.discussionOrder.indexOf(oldId);
            if (idx !== -1) room.discussionOrder[idx] = socket.id;
        }

        socket.join(code);

        // Send full game state back to the rejoining player
        socket.emit('rejoined_room', {
            roomCode: code,
            players: room.players,
            gameState: room.gameState,
            currentWord: existingPlayer.isImposter ? null : room.currentWord,
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

        // Notify others
        io.to(code).emit('update_players', room.players);
        console.log(`[REJOIN] ${playerName} rejoined ${code} (old: ${oldId} -> new: ${socket.id})`);
    });

    // ── Start Game ───────────────────────────────────────────────────────────
    socket.on('start_game', ({ roomCode, categoryIds, words, settings }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Clear any leftover discussion timer from previous game
        if (discussionTimers[roomCode]?.timer) {
            clearTimeout(discussionTimers[roomCode].timer);
            delete discussionTimers[roomCode];
        }

        // Only host can start
        const host = room.players.find(p => p.id === socket.id);
        if (!host?.isHost) { socket.emit('error', 'Yalnız host oyunu başlada bilər!'); return; }

        // Merge settings
        if (settings) room.settings = { ...room.settings, ...settings };

        // Pick category: handle array or single value
        const catArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
        const chosenCategory = catArray[Math.floor(Math.random() * catArray.length)];
        room.currentCategory = chosenCategory;
        room.gameState = 'playing';

        // Pick random word
        const word = words[Math.floor(Math.random() * words.length)];
        room.currentWord = word;
        room.votes = {};
        room.readyPlayers = new Set(); // reset for new game

        // ── Chaos Mode: pick random event ────────────────────────────────────
        let chaosEvent = null;
        if (room.settings.chaosMode) {
            const events = ['blind_round', 'speed_run'];
            if (room.players.length > 5) events.push('double_trouble');
            chaosEvent = events[Math.floor(Math.random() * events.length)];
            room.chaosEvent = chaosEvent;
        } else {
            room.chaosEvent = null;
        }

        // ── Assign roles ─────────────────────────────────────────────────────
        const playerCount = room.players.length;
        const isTrollActive = room.settings.trollMode && Math.random() < 0.5;

        // Reset all roles
        room.players.forEach(p => { p.isImposter = false; p.role = 'crew'; p.votes = 0; });

        if (isTrollActive) {
            room.players.forEach(p => { p.isImposter = true; p.role = 'imposter'; });
        } else {
            // Determine imposter count (double_trouble forces 2)
            let imposterCount = chaosEvent === 'double_trouble'
                ? Math.min(2, Math.max(1, playerCount - 1))
                : Math.min(room.settings.imposterCount || 1, Math.max(1, playerCount - 1));

            // Fisher-Yates shuffle for role selection
            const indices = Array.from({ length: playerCount }, (_, i) => i);
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }

            // Assign imposters
            const imposterSet = new Set(indices.slice(0, imposterCount));
            room.players.forEach((p, i) => {
                if (imposterSet.has(i)) { p.isImposter = true; p.role = 'imposter'; }
            });

            // Assign Jester (if enabled and enough players, pick from remaining crew)
            if (room.settings.includeJester && playerCount > imposterCount + 1) {
                const crewIndices = indices.slice(imposterCount);
                const jesterIdx = crewIndices[Math.floor(Math.random() * crewIndices.length)];
                room.players[jesterIdx].role = 'jester';
                room.players[jesterIdx].isImposter = false; // jester is NOT imposter
            }
        }

        // Determine starting player (80% crew, 20% imposter)
        const crew = room.players.filter(p => !p.isImposter);
        const imposters = room.players.filter(p => p.isImposter);
        let startingPlayerId;
        if (Math.random() < 0.8 && crew.length > 0) startingPlayerId = crew[Math.floor(Math.random() * crew.length)].id;
        else if (imposters.length > 0) startingPlayerId = imposters[Math.floor(Math.random() * imposters.length)].id;
        else startingPlayerId = room.players[0].id;

        // Build discussion order starting from startingPlayer
        const startIdx = room.players.findIndex(p => p.id === startingPlayerId);
        room.discussionOrder = [
            ...room.players.slice(startIdx),
            ...room.players.slice(0, startIdx)
        ].map(p => p.id);

        // Emit game_started to each player individually (so word is hidden from imposters)
        room.players.forEach(player => {
            const targetSocket = io.sockets.sockets.get(player.id);
            if (targetSocket) {
                // blind_round: hide category from everyone
                const visibleCategory = chaosEvent === 'blind_round' ? null : chosenCategory;
                // double_trouble: imposters don't know each other
                const isImposterForPlayer = player.isImposter;

                targetSocket.emit('game_started', {
                    players: room.players,
                    category: visibleCategory,
                    word: (player.isImposter && player.role !== 'jester') ? null : word,
                    startingPlayerId,
                    isTrollActive,
                    isImposter: isImposterForPlayer,
                    role: player.role || 'crew',
                    chaosEvent,
                    settings: room.settings
                });
            }
        });

        console.log(`[GAME] ${roomCode} started. Word: ${word}, Category: ${chosenCategory}, Chaos: ${chaosEvent}, Starter: ${startingPlayerId}`);
    });

    // ── Player Ready (seen their card) ───────────────────────────────────────
    socket.on('player_ready', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Initialize ready set for this game if needed
        if (!room.readyPlayers) room.readyPlayers = new Set();
        room.readyPlayers.add(socket.id);

        const readyCount = room.readyPlayers.size;
        const totalCount = room.players.length;

        // Broadcast ready count to all players in room
        io.to(roomCode).emit('ready_update', {
            readyCount,
            totalCount,
            allReady: readyCount >= totalCount
        });

        console.log(`[READY] ${roomCode}: ${readyCount}/${totalCount} hazır`);
    });

    // ── Start Discussion (HOST ONLY) ─────────────────────────────────────────
    socket.on('start_discussion', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Only host can trigger discussion start
        const host = room.players.find(p => p.id === socket.id);
        if (!host?.isHost) { socket.emit('error', 'Yalnız host müzakirəni başlada bilər!'); return; }

        // Guard: all players must be ready
        const readyCount = room.readyPlayers?.size || 0;
        const totalCount = room.players.length;
        if (readyCount < totalCount) {
            socket.emit('error', `Hələ ${totalCount - readyCount} oyunçu hazır deyil!`);
            return;
        }

        // Use timeLimit setting if set, speed_run halves it
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

        // Only the current turn's player can submit
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
        if (!voter) return;

        // Record vote (one vote per player, overwrite if re-voted)
        room.votes[socket.id] = targetId;

        const alivePlayers = room.players.filter(p => p.isAlive);
        const votedCount = Object.keys(room.votes).length;

        // Broadcast vote progress to all
        io.to(roomCode).emit('vote_update', {
            votes: room.votes,
            votedCount,
            totalVoters: alivePlayers.length
        });

        // Check if all alive players have voted
        if (votedCount >= alivePlayers.length) {
            // Tally votes
            const tally = {};
            Object.values(room.votes).forEach(tid => {
                if (tid !== null && tid !== -1) {
                    tally[tid] = (tally[tid] || 0) + 1;
                }
            });

            // Find most-voted player
            let maxVotes = 0;
            let eliminatedId = null;
            for (const [pid, count] of Object.entries(tally)) {
                if (count > maxVotes) { maxVotes = count; eliminatedId = pid; }
            }

            // Find eliminated player object
            const eliminated = room.players.find(p => p.id === eliminatedId);
            const wasImposter = eliminated?.isImposter || false;
            const isJester = eliminated?.role === 'jester';

            // ── Mark eliminated player as dead ──────────────────────────────
            if (eliminated) eliminated.isAlive = false;

            // ── Check imposter parity win BEFORE declaring result ────────────
            // Standard rule: if imposters >= crew (alive), imposters win immediately
            const aliveAfter = room.players.filter(p => p.isAlive);
            const aliveImposters = aliveAfter.filter(p => p.isImposter);
            const aliveCrew = aliveAfter.filter(p => !p.isImposter); // includes jester

            let winner, reason;

            if (isJester) {
                // Jester voted out → Jester wins regardless of parity
                winner = 'jester';
                reason = `${eliminated?.name} Jester idi! Jester qazandı! 🎠`;
            } else if (wasImposter && aliveImposters.length === 0) {
                // Last imposter eliminated → crew wins
                winner = 'crew';
                reason = `${eliminated?.name} imposter idi! Vətəndaşlar qazandı! 🎉`;
            } else if (!wasImposter && aliveImposters.length >= aliveCrew.length) {
                // Crew voted out wrong person AND now imposters >= crew → imposter wins
                winner = 'imposter';
                reason = `${eliminated?.name} vətəndaş idi! İmposterlar üstünlük qazandı! 😈`;
            } else if (wasImposter && aliveImposters.length >= aliveCrew.length) {
                // Imposter eliminated but remaining imposters still >= crew → imposter wins
                winner = 'imposter';
                reason = `İmposterlar hələ üstündür! Onlar qazandı! 😈`;
            } else if (wasImposter) {
                // Imposter eliminated, game continues (more imposters remain but crew > imposters)
                winner = 'crew';
                reason = `${eliminated?.name} imposter idi! Vətəndaşlar qazandı! 🎉`;
            } else {
                // Crew eliminated, but imposters still < crew → imposter wins
                winner = 'imposter';
                reason = `${eliminated?.name} vətəndaş idi! Imposter qazandı! 😈`;
            }

            const result = {
                winner,
                reason,
                eliminatedName: eliminated?.name || 'Naməlum',
                wasImposter,
                isJester,
                word: room.currentWord,
                imposters: room.players.filter(p => p.isImposter).map(p => p.name),
                jester: room.players.find(p => p.role === 'jester')?.name || null,
                votes: room.votes
            };

            // Reset votes for potential next round
            room.votes = {};
            room.gameState = 'result';

            // Emit result to all
            io.to(roomCode).emit('vote_result', result);
            io.to(roomCode).emit('game_over', result);

            console.log(`[VOTE] ${roomCode} result: ${winner} wins. Eliminated: ${eliminated?.name}`);
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
        io.to(roomCode).emit('game_over', result);
    });

    // ── Reset Game / Play Again (HOST ONLY) ────────────────────────────────
    socket.on('reset_game', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Only host can reset
        const host = room.players.find(p => p.id === socket.id);
        if (!host?.isHost) { socket.emit('error', 'Yalnız host yenidən başlada bilər!'); return; }

        // Clear discussion timer if active
        if (discussionTimers[roomCode]?.timer) {
            clearTimeout(discussionTimers[roomCode].timer);
            delete discussionTimers[roomCode];
        }

        // Reset room state but KEEP players and roomCode
        room.gameState = 'lobby';
        room.currentWord = '';
        room.currentCategory = '';
        room.votes = {};
        room.discussionOrder = [];
        room.players.forEach(p => {
            p.isAlive = true;
            p.isImposter = false;
            p.votes = 0;
        });

        // Broadcast to all: go back to lobby
        io.to(roomCode).emit('game_reset', {
            gameState: 'lobby',
            players: room.players
        });

        console.log(`[RESET] ${roomCode} reset by host. Players kept: ${room.players.map(p => p.name).join(', ')}`);
    });

    // ── Leave Room ───────────────────────────────────────────────────────────
    socket.on('leave_room', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        room.players = room.players.filter(p => p.id !== socket.id);
        socket.leave(roomCode);

        if (room.players.length === 0) {
            // Cleanup empty room
            if (discussionTimers[roomCode]?.timer) clearTimeout(discussionTimers[roomCode].timer);
            delete discussionTimers[roomCode];
            delete rooms[roomCode];
        } else {
            // Reassign host if needed
            if (!room.players.some(p => p.isHost)) room.players[0].isHost = true;
            io.to(roomCode).emit('update_players', room.players);
        }
    });

    // ── Chat ─────────────────────────────────────────────────────────────────
    socket.on('send_message', ({ roomCode, playerName, text }) => {
        const room = rooms[roomCode];
        if (!room) return;
        io.to(roomCode).emit('receive_message', { playerName, text, timestamp: Date.now() });
    });

    // ── Return to Lobby ──────────────────────────────────────────────────────
    socket.on('return_to_lobby', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Only host can reset
        const host = room.players.find(p => p.id === socket.id);
        if (!host?.isHost) { socket.emit('error', 'Yalnız host lobbyə qayıda bilər!'); return; }

        room.gameState = 'lobby';
        room.currentWord = '';
        room.currentCategory = '';
        room.votes = {};
        room.discussionOrder = [];
        room.players.forEach(p => { p.isAlive = true; p.isImposter = false; p.votes = 0; });

        if (discussionTimers[roomCode]?.timer) clearTimeout(discussionTimers[roomCode].timer);
        delete discussionTimers[roomCode];

        io.to(roomCode).emit('game_reset', { gameState: 'lobby', players: room.players });
        console.log(`[RESET] ${roomCode} returned to lobby`);
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] ${socket.id}`);

        // Grace period: 15s before removing player (allows reconnect via rejoin_room)
        setTimeout(() => {
            for (const code in rooms) {
                const room = rooms[code];
                const idx = room.players.findIndex(p => p.id === socket.id);
                if (idx === -1) continue;

                const leavingPlayer = room.players[idx];
                const wasHost = leavingPlayer.isHost;

                // Remove player from room
                room.players.splice(idx, 1);

                // ── Empty room: clean up ──────────────────────────────────────
                if (room.players.length === 0) {
                    if (discussionTimers[code]?.timer) clearTimeout(discussionTimers[code].timer);
                    delete discussionTimers[code];
                    delete rooms[code];
                    console.log(`[ROOM] ${code} deleted (empty)`);
                    break;
                }

                // ── Host Migration ────────────────────────────────────────────
                if (wasHost) {
                    // Promote the first remaining player to host
                    const newHost = room.players[0];
                    newHost.isHost = true;

                    // Notify the new host specifically
                    io.to(newHost.id).emit('host_migrated', {
                        message: `${leavingPlayer.name} ayrıldı. Siz yeni host oldunuz! 👑`,
                        players: room.players
                    });

                    console.log(`[HOST] ${code}: ${leavingPlayer.name} left → ${newHost.name} is new host`);
                }

                // Notify all remaining players
                io.to(code).emit('update_players', room.players);
                io.to(code).emit('player_left', {
                    name: leavingPlayer.name,
                    wasHost,
                    newHostName: wasHost ? room.players[0]?.name : null
                });

                break;
            }
        }, 15000); // 15 second grace period for reconnection
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
