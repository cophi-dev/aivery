"use client"

import {
  ToastProvider,
  useToast,
} from "@/components/ui/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <div key={id} {...props} className="fixed top-4 right-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg p-4 min-w-[300px]">
            {title && <div className="font-semibold">{title}</div>}
            {description && <div className="text-sm mt-1">{description}</div>}
            {action && <div className="mt-2">{action}</div>}
          </div>
        </div>
      ))}
    </ToastProvider>
  )
} 