import { useState, useEffect, useRef } from 'react';
import useGameStore from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send } from 'lucide-react';
import { UI_TEXTS } from '../translations';

const Chat = () => {
    const { messages, sendMessage, language, mode, currentPlayer, players } = useGameStore();
    const [isOpen, setIsOpen] = useState(false);
    const [text, setText] = useState('');
    const [hasUnread, setHasUnread] = useState(false);
    const inputRef = useRef(null);
    const messagesEndRef = useRef(null);
    
    const t = UI_TEXTS[language] || UI_TEXTS['az'];

    // Predefined vibrant colors for better visibility
    const getUserColor = (name) => {
        if (!name) return '#ccc'; // Fallback color
        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#84cc16', 
            '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', 
            '#d946ef', '#f43f5e'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Auto-focus input when chat opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
            scrollToBottom();
            setHasUnread(false);
        }
    }, [isOpen]);

    // Handle new messages (Unread & Scroll)
    useEffect(() => {
        if (mode === 'online') {
            if (isOpen) {
                scrollToBottom();
            } else if (messages?.length > 0) {
                setHasUnread(true);
            }
        }
    }, [messages, isOpen, mode]);

    // Only show in online mode
    if (mode !== 'online') return null;   

    const handleSend = (e) => {
        e.preventDefault();
        if (text.trim()) {
            // Təhlükəsiz senderName
            const senderName = currentPlayer?.name || 'Guest';
            sendMessage(text, senderName);
            setText('');
            setTimeout(scrollToBottom, 100);
            inputRef.current?.focus();
        }
    };

    return (
        <div className="fixed bottom-16 sm:bottom-24 right-4 sm:right-6 z-[70] flex flex-col items-end pointer-events-none">
            {/* Chat Drawer */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="bg-[var(--bg-card)] w-80 max-w-[calc(100vw-2rem)] h-96 rounded-2xl shadow-2xl border border-[var(--border-color)] flex flex-col pointer-events-auto overflow-hidden mb-4 mr-2 origin-bottom-right"
                    >
                        {/* Header */}
                        <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-primary)]">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-[var(--accent-color)]" />
                                <span className="font-bold text-[var(--text-primary)]">Chat</span>
                            </div>
                            <button onClick={toggleChat} className="p-1 hover:bg-[var(--bg-card)] rounded-lg transition-colors">
                                <X className="w-5 h-5 text-[var(--text-secondary)]" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-primary)]/50 scroll-smooth">
                            {(!messages || messages.length === 0) ? (
                                <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)] opacity-50">
                                    <MessageCircle className="w-12 h-12 mb-2" />
                                    <p className="text-sm">Hələ ki, mesaj yoxdur...</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const isMe = msg.playerName === (currentPlayer?.name || localStorage.getItem('playerName'));
                                    const sender = players.find(p => p.name === msg.playerName);
                                    const isHost = sender ? sender.isHost : false;

                                    return (
                                        <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            <span 
                                                className="text-[10px] font-black mb-1 px-1 flex items-center gap-1" 
                                                style={{ color: getUserColor(msg.playerName) }}
                                            >
                                                {msg.playerName}
                                                {isHost && <span title="Otaq Lideri" className="text-yellow-500 text-xs">👑</span>}
                                            </span>
                                            <div 
                                                className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm font-medium shadow-sm ${
                                                    isMe 
                                                        ? 'bg-[var(--accent-color)] text-white rounded-tr-none' 
                                                        : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-tl-none'
                                                }`}
                                            >
                                                {msg.text}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} className="p-3 bg-[var(--bg-primary)] border-t border-[var(--border-color)] flex gap-2">
                            <input 
                                ref={inputRef}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Mesaj yaz..."
                                className="flex-1 bg-[var(--bg-card)] px-4 py-2 rounded-xl text-sm border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none transition-colors"
                            />
                            <button 
                                type="submit" 
                                disabled={!text.trim()}
                                className="p-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Button */}
            <button
                onClick={toggleChat}
                className="pointer-events-auto bg-[var(--bg-card)] text-[var(--text-primary)] p-4 rounded-full shadow-lg border border-[var(--border-color)] hover:border-[var(--accent-color)] transition-all active:scale-95 relative group"
            >
                <MessageCircle className="w-6 h-6 group-hover:text-[var(--accent-color)] transition-colors" />
                {hasUnread && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-bounce" />
                )}
            </button>
        </div>
    );
};

export default Chat;
