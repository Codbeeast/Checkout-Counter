import * as React from "react"

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
}

function Separator({ className = "", orientation = "horizontal", ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      className={`shrink-0 bg-slate-800 ${
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]"
      } ${className}`}
      {...props}
    />
  )
}

export { Separator }
