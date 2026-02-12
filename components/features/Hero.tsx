import { Badge } from "@/components/ui/badge";

export function Hero() {
    return (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] mb-8">
            <div className="bg-card/50 backdrop-blur-xl border rounded-xl p-6 shadow-2xl">
                <Badge variant="secondary" className="mb-4">
                    WG Mesh + Babel Generator
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight mb-4 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
                    Mesh Topolojisi için Konfig Paneli
                </h1>
                <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                    Node ve client sayısını yönet, endpoint IP tipini seç ve her peer için
                    PSK ile otomatik konfig üret. Çıktı: <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">wg0.conf</code>, <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">babeld.conf</code>, zip, JSON.
                </p>
                <div className="h-px bg-border my-6" />
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Ring + i±1/i±3</Badge>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">IPv4 CIDR destekli</Badge>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Babel routing</Badge>
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">Per-peer PSK</Badge>
                </div>
            </div>

            {/* Quick stats placeholder or secondary hero content could go here if needed. 
          For now, mimicking the original layout's second column which was the "Quick Status" card.
          That will be handled by the Sidebar or a separate component if we want it in the hero row.
          Actually, the original design had "Hizli Durum" here. Let's keep it separate or pass it in. 
          I'll leave this empty or remove the grid col if I move stats to sidebar only.
          Original design: .hero { grid-template-columns: 1.2fr 0.8fr; }
          Let's just implement the left part here and let the parent handle the layout or include the stats.
          I will make this component just the left card.
      */}
        </section>
    );
}
