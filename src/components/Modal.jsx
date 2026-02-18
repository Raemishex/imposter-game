import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, type = 'info', actions }) => {
    if (!isOpen) return null;

    const icons = {
        info: <Info className="w-6 h-6 text-blue-500" />,
        alert: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
        error: <AlertTriangle className="w-6 h-6 text-red-500" />,
        success: <CheckCircle className="w-6 h-6 text-green-500" />
    };

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }} 
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4 relative"
                    onClick={e => e.stopPropagation()}
                >
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3">
                        {icons[type]}
                        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">{title}</h2>
                    </div>
                    
                    <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {children}
                    </div>

                    {actions && (
                        <div className="flex gap-3 pt-2">
                            {actions}
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default Modal;
