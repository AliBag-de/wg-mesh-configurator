"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
    children: React.ReactNode;
    sidebarProps: React.ComponentProps<typeof Sidebar>;
}

export function DashboardLayout({ children, sidebarProps }: DashboardLayoutProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-background text-foreground overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden lg:block w-72 shrink-0 border-r">
                <Sidebar {...sidebarProps} className="fixed w-72 h-full top-0 left-0" />
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    <div
                        className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r shadow-2xl animate-in slide-in-from-left duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute right-4 top-4">
                            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <Sidebar {...sidebarProps} className="w-full h-full" />
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-hidden relative flex flex-col">
                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between p-4 border-b bg-background/50 backdrop-blur-md shrink-0 z-40">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                            <Menu className="h-5 w-5" />
                        </Button>
                        <span className="font-bold tracking-tight">Mesh Config</span>
                    </div>
                </header>

                <div className="flex-1 min-h-0 relative flex flex-col p-4 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
