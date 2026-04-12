"use client";

import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, MessageSquare, X, Upload, Loader2, Check, SkipForward } from "lucide-react";
import { uploadPhoto } from "@/lib/api-client";

interface PostClockOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName: string;
  onDone: () => void;
}

export function PostClockOutDialog({ open, onOpenChange, personName, onDone }: PostClockOutDialogProps) {
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (photos.length === 0 && !comment.trim()) {
      handleSkip();
      return;
    }
    setUploading(true);
    try {
      for (const photo of photos) {
        await uploadPhoto(photo, personName, comment);
      }
      setUploaded(true);
      setTimeout(() => { handleClose(); }, 1200);
    } catch (err) {
      console.error("Error uploading:", err);
      // Still close — photos are optional
      handleClose();
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleClose = () => {
    previews.forEach((p) => URL.revokeObjectURL(p));
    setComment("");
    setPhotos([]);
    setPreviews([]);
    setUploading(false);
    setUploaded(false);
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Camera className="h-6 w-6 text-blue-600" />
            ¿Algo que reportar?
          </DialogTitle>
          <DialogDescription className="text-base">
            Puedes agregar fotos o un comentario sobre tu turno. Esto es opcional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Comment */}
          <div>
            <Label className="text-base font-medium flex items-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-gray-600" />
              Comentario (opcional)
            </Label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej: Todo bien, la paciente comió bien..."
              className="w-full min-h-[100px] p-4 border rounded-xl text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              disabled={uploading}
            />
          </div>

          {/* Photos */}
          <div>
            <Label className="text-base font-medium flex items-center gap-2 mb-2">
              <Camera className="h-5 w-5 text-gray-600" />
              Fotos (opcional)
            </Label>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200">
                    <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    {!uploading && (
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full h-7 w-7 flex items-center justify-center"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleAddPhotos}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-14 text-base rounded-xl border-dashed border-2"
            >
              <Camera className="h-5 w-5 mr-2" />
              {previews.length > 0 ? "Agregar más fotos" : "Tomar o elegir foto"}
            </Button>
          </div>

          {uploaded && (
            <div className="flex items-center justify-center gap-2 text-green-700 bg-green-50 p-3 rounded-xl">
              <Check className="h-5 w-5" />
              <span className="text-base font-medium">Guardado correctamente</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-3">
          {(photos.length > 0 || comment.trim()) && (
            <Button
              onClick={handleSubmit}
              disabled={uploading}
              className="w-full h-14 text-base font-semibold bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              {uploading ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Subiendo...</>
              ) : (
                <><Upload className="h-5 w-5 mr-2" />Guardar</>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={uploading}
            className="w-full h-12 text-base text-gray-600"
          >
            <SkipForward className="h-5 w-5 mr-2" />
            Omitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
