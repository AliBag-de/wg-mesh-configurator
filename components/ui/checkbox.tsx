import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/* 
   Again, trying to avoid extra deps. 
   I will implement a custom checkbox without radix for now to keep it dependency-light as per my "standard CSS/React" mindset, 
   but since I'm already using Tailwind, I can make a nice native-like one.
   However, proper accessibility is hard. 
   If I just use a standard <input type="checkbox"> with Tailwind forms plugin or custom styling, it's easier.
   But for a "premium" feel, I usually want custom SVGs.
   Let's try a simple custom implementation wrapping a real checkbox for a11y.
*/

const Checkbox = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
    <div className="relative flex items-center">
        <input
            type="checkbox"
            ref={ref}
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none checked:bg-primary checked:text-primary-foreground",
                className
            )}
            {...props}
        />
        <Check className="absolute left-0 top-0 h-4 w-4 hidden peer-checked:block text-primary-foreground pointer-events-none" />
    </div>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }
