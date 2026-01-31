import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToastProps {
  message: string
  type?: 'error' | 'success' | 'info'
  onClose: () => void
}

export function Toast({ message, type = 'info', onClose }: ToastProps) {
  const typeStyles = {
    error: 'bg-destructive text-destructive-foreground',
    success: 'bg-green-600 text-white',
    info: 'bg-primary text-primary-foreground',
  }

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg max-w-md',
        typeStyles[type]
      )}
      role="alert"
    >
      <p className="flex-1 text-sm">{message}</p>
      <button
        onClick={onClose}
        className="hover:opacity-70 transition-opacity"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

