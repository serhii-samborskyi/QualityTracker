import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImageItem = {
  title: string;
  url: string | null | undefined;
};

export default function ImageViewer({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
}: {
  isOpen: boolean;
  onClose: () => void;
  images: ImageItem[];
  initialIndex?: number;
}) {
  const availableImages = images.filter((image) => image.url);
  const [index, setIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, isOpen]);

  if (!isOpen || availableImages.length === 0) return null;

  const image = availableImages[Math.min(index, availableImages.length - 1)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <Button variant="ghost" size="icon" className="absolute right-4 top-4 text-white" onClick={onClose}>
        <X className="h-6 w-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 text-white"
        onClick={() => setIndex((current) => (current - 1 + availableImages.length) % availableImages.length)}
      >
        <ChevronLeft className="h-8 w-8" />
      </Button>
      <div className="max-h-[88vh] max-w-[88vw] text-center">
        <p className="mb-3 text-white">{image.title}</p>
        <img src={image.url ?? ""} alt={image.title} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 text-white"
        onClick={() => setIndex((current) => (current + 1) % availableImages.length)}
      >
        <ChevronRight className="h-8 w-8" />
      </Button>
    </div>
  );
}
