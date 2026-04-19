"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Receipt, ImagePlus, Loader2, AlertTriangle } from "lucide-react";
import { postReceipt } from "@/lib/api-client";

interface PaymentReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName: string;
  month: string;
  onReceiptCreated: () => void;
}

export function PaymentReceiptDialog({
  open,
  onOpenChange,
  personName,
  month,
  onReceiptCreated,
}: PaymentReceiptDialogProps) {
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("personName", personName);
      formData.append("month", month);
      formData.append("notes", notes);
      formData.append("description", description);
      if (imageFile) {
        formData.append("image", imageFile);
      }

      await postReceipt(formData);
      onReceiptCreated();
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear el recibo"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setNotes("");
    setDescription("");
    setImageFile(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-green-600" />
            Recibo de Pago
          </DialogTitle>
          <DialogDescription>
            Crear recibo de pago para <strong>{personName}</strong> — {month}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receipt-notes">Notas</Label>
            <Textarea
              id="receipt-notes"
              placeholder="Notas del recibo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt-description">Descripción</Label>
            <Input
              id="receipt-description"
              placeholder="Descripción del pago"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receipt-image">Imagen adjunta</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <ImagePlus className="h-4 w-4" />
                {imageFile ? "Cambiar imagen" : "Seleccionar imagen"}
              </Button>
              {imageFile && (
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {imageFile.name}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="receipt-image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Recibo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
