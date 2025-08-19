"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  if (!mounted) {
    return (
      <button
        className="relative inline-flex h-9 w-16 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted disabled:opacity-50"
        disabled
      >
        <Sun className="h-4 w-4 text-muted-foreground" />
      </button>
    )
  }

  const isDark = theme === "dark"

  return (
    <button
      onClick={toggleTheme}
      className="group relative inline-flex h-9 w-16 items-center rounded-full border bg-background hover:bg-muted/50 p-0.5 transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {/* Sliding Circle */}
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-foreground shadow-sm transition-all duration-300 ease-out ${
          isDark ? 'translate-x-7' : 'translate-x-0'
        }`}
      >
        {/* Sun Icon */}
        <Sun
          className={`h-3.5 w-3.5 text-background transition-all duration-300 ${
            isDark ? 'scale-0 rotate-180 opacity-0' : 'scale-100 rotate-0 opacity-100'
          }`}
        />

        {/* Moon Icon */}
        <Moon
          className={`absolute h-3.5 w-3.5 text-background transition-all duration-300 ${
            isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-180 opacity-0'
          }`}
        />
      </div>

      <span className="sr-only">
        {isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      </span>
    </button>
  )
}
