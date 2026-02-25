# FIX: Imposter Word Game — Core Game Loop & Spectator Mode

## Current Problem

The game flow is broken after the voting/elimination phase. Here's what's wrong:

1. **After a player is eliminated by vote**, the game goes to `next_round` state, where the host clicks "Yeni Müzakirə Başlat" — but this sets `gameState: 'playing'`, which shows the **card reveal phase again** (tap-to-reveal). This is WRONG. Players already know their roles and the secret word. They should NOT see the card reveal screen again.

2. **There is no spectator/watch mode.** Eliminated (dead) players currently disappear from the game. They should still be able to watch the ongoing game but not participate.

3. **The game ends too early or restarts instead of continuing.** After one vote, the game should CONTINUE with the remaining alive players — not restart.

---

## Correct Game Flow (Imposter Word Game Rules)

The game is a social deduction word game. Here's how it should work:

```
ROUND START
  → Card Reveal Phase (each player sees their role + word — ONLY ONCE at game start)
  → All players press "Hazıram" (Ready)
  
DISCUSSION LOOP (repeats until game ends):
  → Discussion Phase: alive players take turns giving clues
  → Voting Phase: alive players vote on who they think is the imposter
  → Elimination: the player with most votes is eliminated
  → Check Win Condition:
      • If eliminated player WAS the imposter → CREW WINS → go to Result screen
      • If eliminated player was NOT the imposter → check if imposters >= civilians
          - If imposters >= remaining civilians → IMPOSTER WINS → go to Result screen  
          - If civilians still outnumber imposters → CONTINUE (next discussion round)
  → Show elimination result briefly (who was eliminated, were they imposter?)
  → Go back to Discussion Phase (NOT card reveal!) with remaining alive players

GAME END
  → Result screen shows winner, word, imposters, etc.
  → Host can start a NEW game (completely new word, new roles, new round)
```

**Key rule: The card reveal (tap-to-hold to see your role) happens ONLY ONCE at the very beginning of the game. After that, the game loops through Discussion → Vote → Eliminate → Check → Discussion... until a win condition is met.**

---

## What Needs to Change

### 1. Fix `next_round` state in `ScreenGame.jsx`

Currently (WRONG):
```jsx
// In next_round state, host button does:
onClick={() => {
    useGameStore.setState({ gameState: 'playing' }); // ← WRONG! Goes back to card reveal
}}
```

Should be:
```jsx
// After elimination, if game continues, go DIRECTLY to discussion phase
onClick={() => {
    useGameStore.setState({ gameState: 'discussion' }); // ← Skip card reveal, go to discussion
    // OR trigger startDiscussion() which handles the discussion setup
}}
```

The `next_round` screen should:
- Show who was eliminated and whether they were the imposter
- Show remaining alive players
- If game should continue: host clicks "Müzakirəni Davam Et" → goes to discussion (NOT playing/card reveal)
- If game should end (win condition met): automatically go to `result` screen

### 2. Add Spectator Mode for Eliminated Players

When a player is eliminated (`isAlive === false`), they should:
- **Still see the game** (discussion, voting, results) but in READ-ONLY mode
- **NOT be able to submit clues** during discussion
- **NOT be able to vote** during voting
- **See a "Spectator" banner** at the top of their screen
- **Still have access to chat** (optional — your choice)

Implementation approach:
- In `ScreenGame.jsx` discussion phase: check `if (currentPlayer?.isAlive === false)` → show spectator UI (can see clues, timer, turns but no input)
- In `ScreenVote.jsx`: check `if (currentPlayer?.isAlive === false)` → show vote progress but disable all vote buttons, show "You are eliminated — watching" message
- Add a `isSpectator` derived state: `const isSpectator = currentPlayer?.isAlive === false;`

### 3. Fix Discussion Phase to Work with Alive Players Only

The discussion turn order should SKIP eliminated players:
- `orderedPlayers` should be filtered: `players.filter(p => p.isAlive !== false)`
- The turn system should only cycle through alive players
- Eliminated players see the discussion as spectators

### 4. Fix Voting to Work with Alive Players Only

- Only alive players can vote
- Only alive players can be voted for
- The `alivePlayers` filter already exists in `ScreenVote.jsx` — good. But make sure eliminated players who are still connected see a spectator view.

### 5. Game State Flow Diagram

```
lobby → playing (card reveal, ONCE) → discussion → voting → elimination_result
                                            ↑                      ↓
                                            ←←←← (if game continues, no card reveal)
                                                                   ↓
                                                            (if win condition met)
                                                                   ↓
                                                                result → lobby
```

### 6. Specific File Changes Needed

**`ScreenGame.jsx`:**
- In the `next_round` block: change the host button to go to `discussion` state instead of `playing`
- Add spectator overlay/banner for eliminated players in discussion phase
- Filter discussion turns to only include alive players
- When game continues after elimination, preserve the same word/category/roles (do NOT reassign)

**`ScreenVote.jsx`:**
- Add spectator view for eliminated players (show votes happening, but disable input)
- Add "Sən eliminasiya olundun — İzləyirsən" banner for dead players

**`useGameStore` (Zustand store):**
- Make sure the `next_round` → `discussion` transition does NOT reset word/category/roles
- Make sure `isAlive` flag persists correctly across state transitions
- The `startDiscussion` action should work without requiring a new card reveal
- Win condition check should happen after each elimination

**Server-side (if online mode):**
- After vote results, server should check win condition
- If game continues: emit `next_discussion` event (not `new_game`)
- If game ends: emit `game_result` event
- Eliminated player's socket should receive a `spectator_mode` flag

---

## Spectator UI Design Suggestion

For eliminated players, wrap the existing UI with a spectator overlay:

```jsx
{isSpectator && (
    <div className="sticky top-0 z-50 bg-red-500/90 text-white text-center py-2 px-4 font-bold text-sm">
        💀 Eliminasiya olundun — İzləmə rejimi
    </div>
)}
```

And disable all interactive elements:

```jsx
<button 
    disabled={isSpectator || hasVoted} 
    className={isSpectator ? 'opacity-50 cursor-not-allowed' : ''}
>
```

---

## Summary of Changes (Priority Order)

1. **CRITICAL:** `next_round` host button → go to `discussion` NOT `playing`
2. **CRITICAL:** Don't re-show card reveal after first round — preserve roles/word
3. **HIGH:** Add spectator mode for eliminated players (banner + disabled inputs)
4. **HIGH:** Filter discussion turns to alive players only
5. **MEDIUM:** Win condition check after each elimination
6. **MEDIUM:** Server-side changes for online mode (if applicable)

Please implement these changes across `ScreenGame.jsx`, `ScreenVote.jsx`, `ScreenResult.jsx`, and the Zustand store (`useGameStore`). Do NOT change `Chat.jsx`, `Modal.jsx`, or `HistoryModal.jsx` — they are fine.
