"use client";

import { Modal } from "./Modal";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  loading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="flex flex-col items-center text-center pb-1">
        <div 
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-sm ${
            isDestructive 
              ? 'bg-rose-50 border border-rose-100/80 text-rose-600 shadow-rose-100/50' 
              : 'bg-indigo-50 border border-indigo-100/80 text-indigo-600 shadow-indigo-100/50'
          }`}
        >
          <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
        </div>
        
        <h3 className="text-lg font-bold text-slate-900 mb-1.5">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-500 mb-4 px-2 leading-relaxed">{description}</p>
        
        {children && (
          <div className="w-full mb-4 text-left">
            {children}
          </div>
        )}
        
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:flex-1 h-12 px-4 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] rounded-2xl transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`w-full sm:flex-1 h-12 px-4 text-sm font-bold text-white rounded-2xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
              isDestructive 
                ? "bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/20" 
                : "bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20"
            }`}
          >
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
