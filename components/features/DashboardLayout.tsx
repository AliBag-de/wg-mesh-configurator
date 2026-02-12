"use client";

import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
    children: React.ReactNode;
    sidebarProps: React.ComponentProps<typeof Sidebar>;
}

export function DashboardLayout({ children, sidebarProps }: DashboardLayoutProps) {
    return (
        <div className="flex min-h-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar - Hidden on mobile, fixed on desktop */}
            <div className="hidden lg:block w-72 shrink-0">
                <Sidebar {...sidebarProps} className="fixed w-72 h-full top-0 left-0" />
            </div>

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-hidden relative flex flex-col">
                <div className="h-full w-full p-4 lg:p-8 max-w-7xl mx-auto flex flex-col space-y-4">
                    {children}
                </div>
            </main>

            {/* Mobile Header / Sidebar Toggle would go here */}
        </div>
    );
}
