import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Calendar, Trophy, Skull } from 'lucide-react';
import useGameStore from '../store/useGameStore';
import { UI_TEXTS } from '../translations';

const HistoryModal = ({ isOpen, onClose }) => {
    const { history, language } = useGameStore();
    const t = UI_TEXTS[language] || UI_TEXTS['az'];

    if (!isOpen) return null;

    // Helper to format date
    const formatDate = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleDateString('az-AZ', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[var(--bg-card)] w-full max-w-md rounded-3xl border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-card)] z-10">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-[var(--accent-color)]" />
                            <h2 className="text-xl font-bold text-[var(--text-primary)]">{t.history || 'Tarixçə'}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto p-4 space-y-3">
                        {history.length === 0 ? (
                            <div className="text-center py-10 text-[var(--text-secondary)]">
                                <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>{t.noHistory || 'Hələ ki oyun tarixçəsi yoxdur.'}</p>
                            </div>
                        ) : (
                            history.map((game, index) => {
                                const isCrewWin = game.winner === 'crew';
                                return (
                                    <div 
                                        key={index}
                                        className={`p-4 rounded-xl border ${isCrewWin ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'} relative overflow-hidden`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                {isCrewWin ? (
                                                    <Trophy className="w-5 h-5 text-green-500" />
                                                ) : (
                                                    <Skull className="w-5 h-5 text-red-500" />
                                                )}
                                                <span className={`font-bold ${isCrewWin ? 'text-green-500' : 'text-red-500'}`}>
                                                    {isCrewWin ? (t.civilianWin || 'Vətəndaşlar') : (t.imposterWin || 'Imposter')}
                                                </span>
                                            </div>
                                            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                                                {formatDate(game.date)}
                                            </span>
                                        </div>
                                        
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-xs text-[var(--text-secondary)] uppercase">Söz</p>
                                                <p className="text-lg font-bold text-[var(--text-primary)]">{game.word}</p>
                                            </div>
                                            <div className="text-right">
                                                 <span className="text-xs px-2 py-1 rounded-md bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                                                     {game.playerCount} oyunçu
                                                 </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default HistoryModal;
