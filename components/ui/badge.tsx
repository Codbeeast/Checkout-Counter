import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline"
}

function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors"

  const variants: Record<string, string> = {
    default: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20",
    outline: "border border-slate-700 text-slate-300",
  }

  return <div className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export { Badge }
