"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  children,
  className,
  hideClose,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  hideClose?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={cn(
              "relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-card border border-border shadow-xl",
              className
            )}
            initial={{ y: 30, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {!hideClose && (
              <button
                onClick={onClose}
                className="absolute right-3 top-3 z-10 h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
