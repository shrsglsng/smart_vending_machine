import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const DialogContext = React.createContext(null)

function Dialog({ open, onOpenChange, children }) {
  const [isOpen, setIsOpen] = React.useState(open || false)

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open)
    }
  }, [open])

  const handleOpenChange = React.useCallback((val) => {
    setIsOpen(val)
    if (onOpenChange) {
      onOpenChange(val)
    }
  }, [onOpenChange])

  return (
    <DialogContext.Provider value={{ isOpen, handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({ asChild, children, ...props }) {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error("DialogTrigger must be used within Dialog")

  const handleClick = (e) => {
    context.handleOpenChange(true)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        if (children.props.onClick) children.props.onClick(e)
        handleClick(e)
      }
    })
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

function DialogPortal({ children }) {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error("DialogPortal must be used within Dialog")
  if (!context.isOpen) return null

  return createPortal(children, document.body)
}

function DialogOverlay({ className, ...props }) {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error("DialogOverlay must be used within Dialog")

  return (
    <div
      onClick={() => context.handleOpenChange(false)}
      className={cn(
        "fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({ className, children, ...props }) {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error("DialogContent must be used within Dialog")

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-6 border border-border bg-card text-card-foreground p-6 shadow-2xl rounded-2xl focus:outline-none sm:max-w-[425px]",
          className
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          onClick={() => context.handleOpenChange(false)}
          className="absolute right-4 top-4 rounded-xl p-1 text-muted-foreground opacity-70 transition-all hover:opacity-100 hover:bg-muted focus:outline-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 sm:gap-0",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }) {
  return (
    <h3
      className={cn("text-lg font-bold leading-none tracking-tight text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
