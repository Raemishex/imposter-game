import { useState, useCallback } from 'react';
import { CATEGORIES } from '../data';

export const useGame = () => {
    const [gameState, setGameState] = useState('menu'); // menu, setup, pass, reveal, discussion, voting, result
    const [players, setPlayers] = useState([]);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const [imposterIndex, setImposterIndex] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [currentWord, setCurrentWord] = useState('');
    const [timerEnabled, setTimerEnabled] = useState(true);
    const [gameResult, setGameResult] = useState(null); // 'crew' or 'imposter'

    const startGame = (playerNames, categoryId, isTimerEnabled) => {
        const category = CATEGORIES.find(c => c.id === categoryId);
        const word = category.words[Math.floor(Math.random() * category.words.length)];
        const imposterIdx = Math.floor(Math.random() * playerNames.length);

        setPlayers(playerNames.map((name, index) => ({
            id: index,
            name,
            isImposter: index === imposterIdx,
            isAlive: true,
            votes: 0
        })));
        setImposterIndex(imposterIdx);
        setSelectedCategory(category);
        setCurrentWord(word);
        setTimerEnabled(isTimerEnabled);
        setCurrentPlayerIndex(0);
        setGameState('pass');
    };

    const nextPlayer = () => {
        if (currentPlayerIndex < players.length - 1) {
            setCurrentPlayerIndex(prev => prev + 1);
            setGameState('pass');
        } else {
            setGameState('discussion');
        }
    };

    const handleVote = (votedPlayerId) => {
        if (votedPlayerId === -1) { // Skip vote
             setGameResult('imposter'); // Imposter wins if skipped (simplified for now)
             setGameState('result');
             return;
        }

        const isImposterFound = players[votedPlayerId].isImposter;
        setGameResult(isImposterFound ? 'crew' : 'imposter');
        setGameState('result');
    };

    const resetGame = () => {
        setGameState('menu');
        setPlayers([]);
        setCurrentPlayerIndex(0);
    };
    
    const playAgain = () => {
         startGame(players.map(p => p.name), selectedCategory.id, timerEnabled);
    };


    return {
        gameState,
        setGameState,
        players,
        currentPlayer: players[currentPlayerIndex],
        nextPlayer,
        startGame,
        currentWord,
        selectedCategory,
        handleVote,
        gameResult,
        resetGame,
        playAgain,
        timerEnabled
    };
};
