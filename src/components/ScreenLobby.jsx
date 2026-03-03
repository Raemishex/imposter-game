import { useState, useEffect, useRef } from 'react';
import useGameStore from '../store/useGameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, Copy, Play, Plus, Settings, HelpCircle, 
    Share2, Star, ChevronRight, Check,
    LogOut, AlertCircle, History, Palette, Volume2, VolumeX, Users,
    Instagram, Github, Heart, Clock, Wifi, Globe, Lock, RefreshCw
} from 'lucide-react';
import { CATEGORIES } from '../data';
import { UI_TEXTS } from '../translations';
import Modal from './Modal';
import Chat from './Chat';
import HistoryModal from './HistoryModal';
import { useSoundManager } from '../hooks/useSoundManager';


const ScreenLobby = () => {
    const { 
        roomCode, players, currentPlayer, 
        startGame, startLocalGame, 
        createRoom, joinRoom,
        error, mode, setGameMode, 
        addLocalPlayer, theme, setTheme, history, 
        isConnected,
        language, setLanguage,
        toastMessage,
        isSecretAdmin, activateSecretAdmin,
        globalRooms, fetchGlobalRooms
    } = useGameStore();

    const [selectedCats, setSelectedCats] = useState([CATEGORIES[0].id]);
    const [trollMode, setTrollMode] = useState(false);
    const [imposterCount, setImposterCount] = useState(1);
    const [localName, setLocalName] = useState('');
    const [onlineName, setOnlineName] = useState(localStorage.getItem('playerName') || '');
    const [joinCode, setJoinCode] = useState('');
    const [imposterHint, setImposterHint] = useState(false);
    const [timeLimit, setTimeLimit] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [imposterSquad, setImposterSquad] = useState(false);
    const [includeJester, setIncludeJester] = useState(false);
    const [includeSheriff, setIncludeSheriff] = useState(false);
    const [chaosMode, setChaosMode] = useState(false);
    const [showSocialModal, setShowSocialModal] = useState(false);
    const [historyModal, setHistoryModal] = useState(false);
    // secret admin modal
    const [devModeClicks, setDevModeClicks] = useState(0);
    const devClickTimer = useRef(null);
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [adminPasswordInput, setAdminPasswordInput] = useState('');
    const [adminError, setAdminError] = useState('');
    // Otaq tipi
    const [isPrivateRoom, setIsPrivateRoom] = useState(false);
    const [roomPassword, setRoomPassword] = useState('');
    const [roomDisplayName, setRoomDisplayName] = useState(''); // açıq otaq adı
    const [selectedRegion, setSelectedRegion] = useState('Global'); // otaq regionı
    const [showGlobalRooms, setShowGlobalRooms] = useState(false);
    const [regionFilter, setRegionFilter] = useState('Global'); // qlobal filter
    const REGIONS = ['Global', 'AZ', 'EU', 'RU', 'US'];

    // Modals
    const [showHelp, setShowHelp] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showThemes, setShowThemes] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [infoModal, setInfoModal] = useState(null); // 'about', 'privacy', 'terms'

    const t = UI_TEXTS[language] || UI_TEXTS['az'];
    const { playSound, isMuted, toggleMute } = useSoundManager();
    const playClick = () => playSound('click');

    // Social Modal Logic
    useEffect(() => {
        const hasSeen = localStorage.getItem('socials_seen');
        if (!hasSeen) {
            const timer = setTimeout(() => {
                setShowSocialModal(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const closeSocialModal = () => {
        localStorage.setItem('socials_seen', 'true');
        setShowSocialModal(false);
    };

    const handleSocialClick = (url) => {
        playClick();
        window.open(url, '_blank');
        closeSocialModal();
    };

    // Sync mode with tabs
    const handleTabChange = (newMode) => {
        playClick();
        setGameMode(newMode);
    };

    // Toggle category selection
    const toggleCategory = (id) => {
        playClick();
        if (mode === 'online' && !currentPlayer?.isHost) return; // Only host can change settings
        if (selectedCats.includes(id)) {
            // Prevent deselecting the last one
            if (selectedCats.length > 1) {
                setSelectedCats(selectedCats.filter(c => c !== id));
            }
        } else {
            setSelectedCats([...selectedCats, id]);
        }
    };

    const copyCode = () => {
        playClick();
        navigator.clipboard.writeText(roomCode);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    };

    // Gizli admin modu: logo-ya 5 dəfə sürətli klik
    const handleDevClick = () => {
        const newCount = devModeClicks + 1;
        setDevModeClicks(newCount);
        // Əvvəlki timer-i ləğv et
        if (devClickTimer.current) clearTimeout(devClickTimer.current);
        if (newCount >= 5) {
            setDevModeClicks(0);
            setShowAdminModal(true);
            setAdminPasswordInput('');
            setAdminError('');
        } else {
            // 2 saniyə ərzində 5 klik olmasa sıfırla
            devClickTimer.current = setTimeout(() => setDevModeClicks(0), 2000);
        }
    };

    const handleAdminSubmit = () => {
        const ok = activateSecretAdmin(adminPasswordInput);
        if (ok) {
            setShowAdminModal(false);
            setAdminPasswordInput('');
        } else {
            setAdminError('Yanlış şifrə! Yenidən cəhd et.');
        }
    };

    const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });

    const handleAddLocal = () => {
        playClick();
        if (localName.trim()) {
            const result = addLocalPlayer(localName);
            if (result.success) {
                setLocalName('');
            } else {
                setAlertModal({ 
                    show: true, 
                    title: 'Xəta', 
                    message: result.error, 
                    type: 'error' 
                });
            }
        }
    };

    const handleCreateRoom = () => {
        playClick();
        if (!onlineName.trim()) return;
        localStorage.setItem('playerName', onlineName);
        createRoom(onlineName, isPrivateRoom, roomDisplayName, '', selectedRegion);
    };

    const handleJoinRoom = () => {
        playClick();
        if (!onlineName.trim() || !joinCode.trim()) return;
        localStorage.setItem('playerName', onlineName);
        joinRoom(joinCode, onlineName);
    };

    const handleStart = () => {
        playClick();
        const selectedCategoryObjects = CATEGORIES.filter(c => selectedCats.includes(c.id));
        
        // KRİTİK: wordObjects = [{word, category}] formatında hazırla
        const wordObjects = selectedCategoryObjects.flatMap(cat => {
            const categoryName = cat.name[language] || cat.name['az'];
            const words = cat.words[language] || cat.words['az'] || [];
            return words.map(w => ({ word: w, category: categoryName }));
        });
        // Unikal sözlər (eyni söz fərqli kateqoriyalarda ola bilməz)
        const seen = new Set();
        const uniqueWordObjects = wordObjects.filter(wo => {
            if (seen.has(wo.word)) return false;
            seen.add(wo.word);
            return true;
        });

        const settings = {
            trollMode,
            imposterCount,
            imposterHint,
            imposterSquad,
            timeLimit,
            includeJester,
            includeSheriff,
            chaosMode
        };

        if (mode === 'local') {
            startLocalGame(selectedCats, uniqueWordObjects, settings);
        } else {
            startGame(selectedCats, uniqueWordObjects, settings);
        }
    };

    // Derived state for Online connectivity
    const isOnlineConnected = mode === 'online' && roomCode;
    const isHost = mode === 'local' || (mode === 'online' && currentPlayer?.isHost);

    const themes = [
        { id: 'light', name: 'Original Light', color: '#f8fafc' },
        { id: 'dark', name: 'Midnight Dark', color: '#0f172a' },
        { id: 'neon', name: 'Cyber Neon', color: '#09090b', border: '#22c55e' },
        { id: 'orange', name: 'Sunset Orange', color: '#fff7ed', border: '#f97316' },
    ];

    const InfoContent = {
        about: { 
            title: t.aboutGame, 
            content: (
                <div className="space-y-2">
                    <p>{t.aboutContent.text}</p>
                    <p>{t.aboutContent.creator}: <strong>Ramo</strong></p>
                    <p>{t.aboutContent.version}: <strong>1.2.0</strong></p>
                </div>
            )
        },
        privacy: { 
            title: t.privacyPolicy, 
            content: (
                <div className="space-y-3 text-xs">
                    <p>{t.privacyContent.intro}</p>
                    {t.privacyContent.sections.map((section, idx) => (
                        <div key={idx}>
                            <strong>{section.title}</strong>
                            <p>{section.text}</p>
                        </div>
                    ))}
                </div>
            )
        },
        terms: { 
            title: t.termsOfService, 
            content: (
                <div className="space-y-3 text-xs">
                    {t.termsContent.sections.map((section, idx) => (
                        <div key={idx}>
                             <strong>{section.title}</strong>
                             <p>{section.text}</p>
                        </div>
                    ))}
                </div>
            )
        }
    };

    return (
        <div className="flex flex-col min-h-screen pb-24 overflow-y-auto bg-transparent transition-colors duration-300 relative">
            {/* Host Migration / System Toast */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ y: -60, opacity: 0 }}
                        animate={{ y: 20, opacity: 1 }}
                        exit={{ y: -60, opacity: 0 }}
                        className="fixed top-0 left-1/2 -translate-x-1/2 z-[110] bg-yellow-500 text-black px-5 py-2 rounded-full shadow-xl font-bold flex items-center gap-2 text-sm max-w-xs text-center"
                    >
                        👑 {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showToast && (
                    <motion.div 
                        initial={{ y: -50, opacity: 0 }} 
                        animate={{ y: 20, opacity: 1 }} 
                        exit={{ y: -50, opacity: 0 }}
                        className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] bg-green-500 text-white px-6 py-2 rounded-full shadow-lg font-bold flex items-center gap-2"
                    >
                        <Check className="w-5 h-5" /> {t.codeCopied}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <HistoryModal 
                isOpen={historyModal} 
                onClose={() => setHistoryModal(false)} 
            />

            <AnimatePresence>
                {/* Social Support Modal */}
                {showSocialModal && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                            className="bg-[var(--bg-card)] p-8 rounded-3xl max-w-sm w-full shadow-2xl border border-[var(--border-color)] relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500" />
                            
                            <div className="flex flex-col items-center text-center space-y-6">
                                <div className="p-4 bg-red-500/10 rounded-full animate-pulse">
                                    <Heart className="w-12 h-12 text-red-500 fill-current" />
                                </div>
                                
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-[var(--text-primary)]">Salam, Dost! 👋</h2>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                        Mən bu oyunu təkbaşına hazırlayıram. Yeniliklərdən xəbərdar olmaq və dəstək üçün məni izləyə bilərsən! 🚀
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 w-full">
                                    <button 
                                        onClick={() => handleSocialClick('https://www.instagram.com/ramohax?igsh=eTJqaDAwN2kyejgw')}
                                        className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform"
                                        style={{ background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}
                                    >
                                        <Instagram className="w-6 h-6" /> Instagram
                                    </button>
                                    
                                    <button 
                                        onClick={() => handleSocialClick('https://github.com/Raemishex')}
                                        className="w-full py-4 rounded-xl font-bold bg-[#24292e] text-white flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform"
                                    >
                                        <Github className="w-6 h-6" /> Github
                                    </button>
                                </div>

                                <button 
                                    onClick={closeSocialModal}
                                    className="text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    Bəlkə sonra
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Help Modal */}
                {showHelp && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowHelp(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-[var(--bg-card)] p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-black text-[var(--text-primary)]">{t.howToPlay}</h2>
                            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                                {t.howToPlayPoints.map((point, i) => (
                                    <li key={i}>{point.icon} <strong className="text-[var(--text-primary)]">{point.title}</strong> {point.text}</li>
                                ))}
                            </ul>
                            <button onClick={() => setShowHelp(false)} className="btn-primary w-full py-3">{t.understood}</button>
                        </motion.div>
                    </motion.div>
                )}
                
                {/* History Modal */}
                {showHistory && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowHistory(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-[var(--bg-card)] p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
                                <History className="w-6 h-6" /> {t.history}
                            </h2>
                            <h3 className="text-[var(--text-secondary)] font-bold text-sm tracking-wider flex items-center gap-2">
                                <Users className="w-4 h-4" /> 
                                {t.players} <span className="text-[var(--text-primary)]">({players.length})</span>
                            </h3>
                            {history && history.length > 0 ? (
                                <div className="space-y-2">
                                    {history.map((game, i) => (
                                        <div key={i} className="p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]">
                                            <div className="flex justify-between font-bold text-sm">
                                                <span className={game.winner === 'imposter' ? 'text-red-500' : 'text-green-500'}>
                                                    {game.winner === 'imposter' ? t.imposterWin : t.civilianWin}
                                                </span>
                                                <span className="text-[var(--text-secondary)]">{new Date(game.date).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-[var(--text-secondary)] mt-1">{t.wordWas}: {game.word}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-[var(--text-secondary)]">{t.noHistory}</p>
                            )}
                            <button onClick={() => setShowHistory(false)} className="btn-secondary w-full py-3">{t.close}</button>
                        </motion.div>
                    </motion.div>
                )}

                 {/* Settings Modal */}
                 {showSettings && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowSettings(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-[var(--bg-card)] p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2">
                                <Settings className="w-6 h-6" /> {t.settingsTitle}
                            </h2>
                            
                            <div className="space-y-2">
                                <div className="bg-[var(--bg-primary)] rounded-xl p-3">
                                    <p className="text-sm font-bold text-[var(--text-primary)] mb-2">{t.language}</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['az', 'tr', 'en', 'ru'].map(lang => (
                                            <button 
                                                key={lang}
                                                onClick={() => { playClick(); setLanguage(lang); }}
                                                className={`py-2 rounded-lg text-xs font-bold transition-all uppercase ${language === lang ? 'bg-[var(--accent-color)] text-black' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => setInfoModal('about')} className="w-full text-left p-3 hover:bg-[var(--bg-primary)] rounded-xl font-bold text-[var(--text-primary)] border border-transparent hover:border-[var(--border-color)] transition-colors">{t.aboutGame}</button>
                                <button onClick={() => setInfoModal('privacy')} className="w-full text-left p-3 hover:bg-[var(--bg-primary)] rounded-xl font-bold text-[var(--text-primary)] border border-transparent hover:border-[var(--border-color)] transition-colors">{t.privacyPolicy}</button>
                                <button onClick={() => setInfoModal('terms')} className="w-full text-left p-3 hover:bg-[var(--bg-primary)] rounded-xl font-bold text-[var(--text-primary)] border border-transparent hover:border-[var(--border-color)] transition-colors">{t.termsOfService}</button>
                            </div>

                            <button onClick={() => setShowSettings(false)} className="btn-secondary w-full py-3">{t.close}</button>
                        </motion.div>
                    </motion.div>
                )}

                {/* Info Modal (About, Privacy, Terms) */}
                {infoModal && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setInfoModal(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-[var(--bg-card)] p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-black text-[var(--text-primary)]">{InfoContent[infoModal].title}</h2>
                            <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                {InfoContent[infoModal].content}
                            </div>
                            <button onClick={() => setInfoModal(null)} className="btn-primary w-full py-2 sticky bottom-0">{t.close}</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Gizli Admin Şifrə Modalı */}
            <AnimatePresence>
                {showAdminModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setShowAdminModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }}
                            className="bg-zinc-900 border border-red-800 p-8 rounded-3xl max-w-xs w-full shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-center space-y-4">
                                <div className="text-4xl">🔐</div>
                                <h2 className="text-xl font-black text-white">Admin Girişi</h2>
                                <input
                                    type="password"
                                    value={adminPasswordInput}
                                    onChange={e => { setAdminPasswordInput(e.target.value); setAdminError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleAdminSubmit()}
                                    placeholder="Şifrəni daxil et..."
                                    autoFocus
                                    className="w-full bg-zinc-800 border border-zinc-600 p-3 rounded-xl text-white font-mono outline-none focus:border-red-500 transition-colors"
                                />
                                {adminError && <p className="text-red-400 text-xs">{adminError}</p>}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowAdminModal(false)}
                                        className="flex-1 py-2 rounded-xl bg-zinc-700 text-white font-bold"
                                    >İmtina</button>
                                    <button
                                        onClick={handleAdminSubmit}
                                        className="flex-1 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold transition-colors"
                                    >Daxil ol</button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex justify-between items-center p-4 pt-8">
                <button className="icon-btn" onClick={() => { playClick(); setShowSettings(true); }}><Settings className="w-6 h-6" /></button>
                <div className="flex flex-col items-center" onClick={handleDevClick}>
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)] leading-none select-none cursor-pointer">IMPOSTER</h1>
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)] leading-none select-none cursor-pointer">KİM?</h1>
                </div>
                <div className="flex gap-2">
                     <button className="icon-btn" onClick={() => { playClick(); setHistoryModal(true); }}><Clock className="w-6 h-6" /></button>
                     <button className="icon-btn" onClick={() => { playClick(); setShowHelp(true); }}><HelpCircle className="w-6 h-6" /></button>
                     <button
                        className={`icon-btn transition-all duration-200 ${isMuted ? 'text-red-400 opacity-70' : 'text-[var(--accent-color)]'}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Səsi Aç' : 'Səsi Kapat'}
                    >
                        {isMuted
                            ? <VolumeX className="w-6 h-6" />
                            : <Volume2 className="w-6 h-6" />
                        }
                    </button>
                    <div className="relative group">
                        <button className="icon-btn peer">
                            <Palette className="w-6 h-6" />
                        </button>
                        {/* Theme Dropdown with Bridge to prevent closing on gap */}
                        <div className="absolute right-0 top-full pt-2 w-48 hidden peer-hover:block hover:block z-50">
                             <div className="bg-[var(--bg-card)] rounded-xl shadow-xl border border-[var(--border-color)] p-2">
                                {themes.map(t => (
                                    <button 
                                        key={t.id}
                                        onClick={() => { playClick(); setTheme(t.id); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-[var(--bg-primary)] ${theme === t.id ? 'text-[var(--text-primary)] bg-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'}`}
                                    >
                                        <div className="w-4 h-4 rounded-full border shadow-sm" style={{ backgroundColor: t.color, borderColor: t.border || 'transparent' }}></div>
                                        {t.name}
                                    </button>
                                ))}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Gizli Admin Modu: aktiv olduqda kiçik badge */}
            {isSecretAdmin && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="mx-4 mb-1 bg-red-900/80 border border-red-500 text-red-300 px-3 py-2 rounded-xl text-xs font-mono flex items-center gap-2"
                >
                    <span className="text-red-400">👁</span>
                    Admin Modu Aktiv — İmposterlar qırmızı görünür
                    <button onClick={() => useGameStore.getState().deactivateSecretAdmin()} className="ml-auto text-red-400 hover:text-white">✕</button>
                </motion.div>
            )}

            <div className="flex flex-col gap-4 p-4 max-w-md mx-auto w-full">
                
                {/* Unified Tab Switcher */}
                <div className="bg-[var(--bg-card)] p-1 rounded-2xl flex relative shadow-sm border border-[var(--border-color)]">
                    <button 
                        onClick={() => handleTabChange('local')}
                        className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all z-10 ${mode === 'local' ? 'text-[var(--bg-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <User className="w-4 h-4" /> {t.classic}
                    </button>
                    <button 
                        onClick={() => handleTabChange('online')}
                        className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all z-10 ${mode === 'online' ? 'text-[var(--bg-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        <Wifi className="w-4 h-4" /> {t.online}
                    </button>
                    
                    {/* Sliding Background */}
                    <motion.div 
                        className="absolute top-1 bottom-1 bg-[var(--text-primary)] rounded-xl shadow-md"
                        initial={false}
                        animate={{ 
                            left: mode === 'local' ? '4px' : '50%', 
                            width: 'calc(50% - 4px)' 
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                </div>

                <p className="text-xs text-[var(--text-secondary)] px-2 leading-relaxed text-center">
                    {mode === 'local' 
                        ? t.classicDesc
                        : t.onlineDesc}
                </p>

                {/* ONLINE CONNECT FORM */}
                {mode === 'online' && !isOnlineConnected && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="card-base space-y-4 p-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase">{t.yourName}</label>
                                <input 
                                    value={onlineName}
                                    onChange={(e) => setOnlineName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                                    placeholder={t.enterName}
                                    className="w-full bg-[var(--bg-primary)] p-3 rounded-xl font-bold text-[var(--text-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none transition-colors focus:ring-2 ring-[var(--accent-color)]/20"
                                />
                            </div>

                            {/* Otaq tipi: Açıq / Özəl */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { playClick(); setIsPrivateRoom(false); }}
                                    className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 border transition-all ${!isPrivateRoom ? 'bg-[var(--accent-color)] text-black border-transparent' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                                >
                                    <Globe className="w-4 h-4" /> {t.openRoom || 'Açıq'}
                                </button>
                                <button
                                    onClick={() => { playClick(); setIsPrivateRoom(true); }}
                                    className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 border transition-all ${isPrivateRoom ? 'bg-[var(--accent-color)] text-black border-transparent' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                                >
                                    <Lock className="w-4 h-4" /> {t.privateRoom || 'Özəl'}
                                </button>
                            </div>

                            {/* Açıq otaq: ad + region */}
                            {!isPrivateRoom && (
                                <div className="space-y-2">
                                    <input
                                        value={roomDisplayName}
                                        onChange={e => setRoomDisplayName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
                                        placeholder={t.roomNamePlaceholder || 'Otaq adı (isteğe bağlı)'}
                                        maxLength={20}
                                        className="w-full bg-[var(--bg-primary)] p-3 rounded-xl font-bold text-[var(--text-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none transition-colors"
                                    />
                                    <div className="flex gap-2">
                                        {['Global','AZ','EU','RU','US'].map(r => (
                                            <button key={r}
                                                onClick={() => { playClick(); setSelectedRegion(r); }}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedRegion === r ? 'bg-[var(--accent-color)] text-black border-transparent' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                                            >{r}</button>
                                        ))}
                                    </div>
                                </div>
                            )}


                            
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button 
                                    onClick={handleCreateRoom}
                                    disabled={!onlineName.trim()}
                                    className="btn-primary py-3 rounded-xl text-sm flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:grayscale transition-transform active:scale-95"
                                >
                                    <Plus className="w-5 h-5" /> {t.createRoom}
                                </button>
                                
                                <div className="space-y-2">
                                    <input 
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                                        placeholder={t.roomCode || 'Otaq kodu'}
                                        maxLength={20}
                                        className="w-full bg-[var(--bg-primary)] p-3 rounded-xl font-black text-center text-[var(--text-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] outline-none transition-colors uppercase tracking-widest focus:ring-2 ring-[var(--accent-color)]/20"
                                    />
                                    <button 
                                        onClick={handleJoinRoom}
                                        disabled={!onlineName.trim() || !joinCode.trim()}
                                        className="w-full py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl font-bold text-[var(--text-primary)] hover:bg-[var(--bg-primary)] disabled:opacity-50 transition-colors text-xs active:scale-95"
                                    >
                                        {t.joinRoom}
                                    </button>
                                </div>
                            </div>

                            {/* Qlobal Açıq Otaqlar */}
                            <div className="border-t border-[var(--border-color)] pt-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <button
                                        onClick={() => { playClick(); setShowGlobalRooms(!showGlobalRooms); if (!showGlobalRooms) fetchGlobalRooms(regionFilter !== 'Global' ? regionFilter : undefined); }}
                                        className="flex-1 flex items-center justify-between text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-1"
                                    >
                                        <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> {t.openRoom || 'Açıq Otaqlar'} ({globalRooms.length})</span>
                                        <RefreshCw className={`w-4 h-4 transition-transform ${showGlobalRooms ? 'rotate-180' : ''}`} />
                                    </button>
                                    <button onClick={() => { fetchGlobalRooms(regionFilter !== 'Global' ? regionFilter : undefined); }} className="p-1.5 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)]">
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Region Filter */}
                                {showGlobalRooms && (
                                    <div className="flex gap-1.5 mb-2">
                                        {['Global','AZ','EU','RU','US'].map(r => (
                                            <button key={r}
                                                onClick={() => { setRegionFilter(r); fetchGlobalRooms(r !== 'Global' ? r : undefined); }}
                                                className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all ${regionFilter === r ? 'bg-[var(--accent-color)] text-black border-transparent' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                                            >{r}</button>
                                        ))}
                                    </div>
                                )}

                                <AnimatePresence>
                                    {showGlobalRooms && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden space-y-2"
                                        >
                                            {globalRooms.length === 0 ? (
                                                <p className="text-center text-xs text-[var(--text-secondary)] py-3">Açıq otaq tapılmadı</p>
                                            ) : globalRooms.map(r => (
                                                <div key={r.roomCode} className="flex items-center justify-between bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)]">
                                                    <div>
                                                        <p className="font-black text-[var(--text-primary)] tracking-wide text-sm">{r.roomName || r.roomCode}</p>
                                                        <p className="text-xs text-[var(--text-secondary)]">{r.hostName} · {r.playerCount} oyunçu · {r.region}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => { playClick(); setJoinCode(r.roomCode); }}
                                                        className="btn-primary px-3 py-1 text-xs rounded-lg active:scale-95"
                                                    >
                                                        Qoşul
                                                    </button>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            
                            {error && (
                                <p className="text-red-500 text-xs font-bold text-center flex items-center justify-center gap-1 animate-pulse">
                                    <AlertCircle className="w-3 h-3" /> {error}
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* LOBBY CONTENT (Visible if Local OR (Online AND Connected)) */}
                {(mode === 'local' || isOnlineConnected) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
                        
                        {/* Players Section */}
                        <div className="card-base space-y-3">
                            <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm font-bold uppercase tracking-wider">
                                <span className="text-yellow-500">✋</span> {t.players} <span className="text-[var(--text-primary)]">({players.length})</span>
                            </div>
                            
                            {/* Room Code Display for Online */}
                            {mode === 'online' && (
                                <div className="flex items-center justify-between bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)] mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-[var(--text-secondary)]">{t.roomCode}:</span>
                                        <span className="text-xl font-black font-mono tracking-widest text-[var(--text-primary)]">{roomCode}</span>
                                        <button onClick={copyCode}><Copy className="w-4 h-4 text-[var(--text-secondary)]" /></button>
                                    </div>
                                    <button 
                                        onClick={() => { playClick(); useGameStore.getState().leaveRoom(); }}
                                        className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 active:scale-95 transition-all"
                                        title="Otaqdan çıx"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                {players.map(p => (
                                    <div key={p.id} className="bg-[var(--bg-primary)] px-3 py-2 rounded-lg text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border border-[var(--border-color)]">
                                        {p.isHost && <span className="text-yellow-500 text-xs">👑</span>}
                                        {p.name}
                                    </div>
                                ))}
                                {mode === 'local' && (
                                    <div className="flex items-center gap-2 w-full mt-2">
                                        <input 
                                            value={localName}
                                            onChange={(e) => setLocalName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddLocal()}
                                            placeholder={t.enterName}
                                            className="flex-1 bg-[var(--bg-primary)] px-4 py-2 rounded-xl text-sm border border-[var(--border-color)] outline-none focus:border-[var(--text-secondary)] placeholder:text-[var(--text-secondary)]/50 text-[var(--text-primary)]"
                                        />
                                        <button onClick={handleAddLocal} className="p-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl active:scale-95 transition-transform">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Categories Section */}
                        <div className="card-base space-y-3">
                            <div className="flex items-center justify-between text-[var(--text-secondary)] text-sm font-bold uppercase tracking-wider">
                                <div className="flex items-center gap-2"><span className="text-red-500">🍗</span> {t.categories}</div>
                                <span className="text-xs bg-[var(--bg-primary)] px-2 py-1 rounded-md">{selectedCats.length} {t.selected}</span>
                            </div>
                            
                            <div className={`grid grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1 ${!isHost ? 'opacity-70 pointer-events-none' : ''}`}>
                                {CATEGORIES.map(cat => {
                                    const isSelected = selectedCats.includes(cat.id);
                                    return (
                                        <motion.button
                                            key={cat.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => toggleCategory(cat.id)}
                                            className={`w-full p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border-2 ${isSelected ? 'bg-[var(--bg-primary)] border-[var(--text-primary)] shadow-md' : 'bg-transparent border-transparent hover:bg-[var(--bg-primary)] hover:border-[var(--border-color)]'}`}
                                        >
                                            <div className={`p-3 rounded-xl bg-gradient-to-br ${cat.color} text-white shadow-sm relative`}>
                                                <cat.icon className="w-6 h-6" />
                                                {isSelected && (
                                                    <div className="absolute -top-2 -right-2 bg-[var(--text-primary)] rounded-full p-0.5 shadow-sm">
                                                        <Check className="w-3 h-3 text-[var(--bg-primary)]" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`text-xs font-bold ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{cat.name[language] || cat.name.az}</span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Settings Section */}
                        <div className={`card-base space-y-4 ${!isHost ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                             {/* Imposter Count */}
                            <div className="flex items-center justify-between bg-[var(--bg-primary)] p-3 rounded-2xl border border-[var(--border-color)]">
                                <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm font-bold uppercase tracking-wider">
                                    <span className="text-xl">🥷</span> {t.imposters}
                                </div>
                                <div className="flex items-center gap-4 bg-[var(--bg-card)] rounded-xl p-1 shadow-sm border border-[var(--border-color)]">
                                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => { playClick(); setImposterCount(Math.max(1, imposterCount - 1)); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] font-black text-lg">-</motion.button>
                                    <span className="text-[var(--accent-color)] font-black text-xl w-4 text-center drop-shadow-sm">{imposterCount}</span>
                                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => { playClick(); setImposterCount(Math.min(players.length - 1, imposterCount + 1)); }} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] font-black text-lg">+</motion.button>
                                </div>
                            </div>

                            {/* Toggles */}
                            <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-[var(--text-primary)] pl-7 relative">
                                        <span className="absolute left-0 top-0.5">⏰</span> {t.timeLimit}
                                    </span>
                                    <button onClick={() => { playClick(); setTimeLimit(!timeLimit); }} className={`w-11 h-6 rounded-full relative transition-colors ${timeLimit ? 'bg-[var(--accent-color)]' : 'bg-[var(--border-color)]'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${timeLimit ? 'left-6' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                 <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[var(--text-primary)] pl-7 relative">
                                            <span className="absolute left-0 top-0.5">💡</span> {t.imposterHint}
                                        </span>
                                        <span className="text-[10px] text-[var(--text-secondary)] pl-7 leading-tight max-w-[200px]">{t.imposterHintDesc}</span>
                                    </div>
                                    <button onClick={() => { playClick(); setImposterHint(!imposterHint); }} className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${imposterHint ? 'bg-[var(--accent-color)]' : 'bg-[var(--border-color)]'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${imposterHint ? 'left-6' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                 <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[var(--text-primary)] pl-7 relative">
                                            <span className="absolute left-0 top-0.5">😈</span> {t.trollMode}
                                        </span>
                                        <span className="text-[10px] text-[var(--text-secondary)] pl-7 leading-tight max-w-[200px]">{t.trollModeDesc}</span>
                                    </div>
                                    <button onClick={() => { playClick(); setTrollMode(!trollMode); }} className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${trollMode ? 'bg-[var(--accent-color)]' : 'bg-[var(--border-color)]'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${trollMode ? 'left-6' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                 <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[var(--text-primary)] pl-7 relative">
                                            <span className="absolute left-0 top-0.5">🤝</span> {t.imposterSquad}
                                        </span>
                                        <span className="text-[10px] text-[var(--text-secondary)] pl-7 leading-tight max-w-[200px]">{t.imposterSquadDesc}</span>
                                    </div>
                                    <button onClick={() => { playClick(); setImposterSquad(!imposterSquad); }} className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${imposterSquad ? 'bg-[var(--accent-color)]' : 'bg-[var(--border-color)]'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${imposterSquad ? 'left-6' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                {/* Jester Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[var(--text-primary)] pl-7 relative">
                                            <span className="absolute left-0 top-0.5">🎭</span> {t.jesterRole}
                                        </span>
                                        <span className="text-[10px] text-[var(--text-secondary)] pl-7 leading-tight max-w-[200px]">{t.jesterRoleDesc}</span>
                                    </div>
                                    <button onClick={() => { playClick(); setIncludeJester(!includeJester); }} className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${includeJester ? 'bg-purple-500' : 'bg-[var(--border-color)]'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${includeJester ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>

                                {/* Sheriff Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[var(--text-primary)] pl-7 relative">
                                            <span className="absolute left-0 top-0.5">🤠</span> {t.sheriffRole}
                                        </span>
                                        <span className="text-[10px] text-[var(--text-secondary)] pl-7 leading-tight max-w-[200px]">{t.sheriffRoleDesc}</span>
                                    </div>
                                    <button onClick={() => { playClick(); setIncludeSheriff(!includeSheriff); }} className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${includeSheriff ? 'bg-blue-500' : 'bg-[var(--border-color)]'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${includeSheriff ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>

                                {/* Chaos Mode Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[var(--text-primary)] pl-7 relative">
                                            <span className="absolute left-0 top-0.5">🌀</span> {t.chaosMode}
                                        </span>
                                        <span className="text-[10px] text-[var(--text-secondary)] pl-7 leading-tight max-w-[200px]">{t.chaosModeDesc}</span>
                                    </div>
                                    <button onClick={() => { playClick(); setChaosMode(!chaosMode); }} className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${chaosMode ? 'bg-orange-500' : 'bg-[var(--border-color)]'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${chaosMode ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                    <div className="space-y-3 pt-4">
                        <p className="text-center text-xs text-[var(--text-secondary)] font-bold tracking-widest uppercase">{t.supportTitle}</p>
                        <button 
                            onClick={() => {
                                playClick();
                                if (navigator.share) {
                                    navigator.share({
                                        title: 'Imposter Kim?',
                                        text: 'Gəl birlikdə Imposter Kim? oynayaq!',
                                        url: window.location.href
                                    }).catch(console.error);
                                } else {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert('Link kopyalandı! Dostlarına göndər.');
                                }
                            }}
                            className="w-full py-3 rounded-xl font-bold bg-[#fde047] text-slate-900 shadow-[0_4px_0_#eab308] hover:translate-y-[2px] hover:shadow-[0_2px_0_#eab308] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                             <Share2 className="w-5 h-5" /> {t.share}
                        </button>
                        <button 
                            onClick={() => {
                                playClick();
                                window.open('https://www.instagram.com/ramohax?igsh=eTJqaDAwN2kyejgw', '_blank');
                            }}
                            className="w-full py-3 rounded-xl font-bold bg-[#fde047] text-slate-900 shadow-[0_4px_0_#eab308] hover:translate-y-[2px] hover:shadow-[0_2px_0_#eab308] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                             <Star className="w-5 h-5" /> {t.feedback}
                        </button>
                    </div>
                </motion.div>
            )}
            </div>

            {/* Sticky Start Button (Only show if Local OR (Online Connected)) */}
            {(mode === 'local' || isOnlineConnected) && (
                <div className="fixed bottom-0 left-0 w-full p-4 bg-[var(--bg-primary)]/80 backdrop-blur-lg border-t border-[var(--border-color)] z-50">
                    <div className="max-w-md mx-auto">
                        {isHost ? (
                            <button 
                                onClick={handleStart}
                                disabled={players.length < 3}
                                className="btn-primary w-full disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 active:scale-95 transition-transform"
                            >
                                <Play className="w-6 h-6 fill-current" /> {t.startGame}
                            </button>
                        ) : (
                            <div className="w-full py-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl text-center">
                                <p className="text-[var(--text-secondary)] font-bold animate-pulse">
                                    {
                                        (() => {
                                            const host = players.find(p => p.isHost);
                                            return host && t.waitingHostName
                                                ? t.waitingHostName(host.name)
                                                : t.waitingHost;
                                        })()
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <Chat />
        </div>
    );
};

export default ScreenLobby;
