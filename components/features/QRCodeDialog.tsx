import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, QrCode as QrIcon } from "lucide-react";
import QRCode from "react-qr-code"; // Ensure this matches the installed package export
import { useState } from "react";
import { toast } from "sonner";

interface QRCodeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    clientName: string;
    config: string;
}

export function QRCodeDialog({ isOpen, onClose, clientName, config }: QRCodeDialogProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(config);
            setCopied(true);
            toast.success("Configuration copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Failed to copy configuration");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrIcon className="h-5 w-5" />
                        {clientName}
                    </DialogTitle>
                    <DialogDescription>
                        Scan this QR code with the WireGuard mobile app.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border">
                    <div className="bg-white p-2">
                        <QRCode value={config} size={200} />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCopy} className="gap-2">
                        <Copy className="h-4 w-4" />
                        {copied ? "Copied" : "Copy Config"}
                    </Button>
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
