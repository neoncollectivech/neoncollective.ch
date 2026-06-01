import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { EventImageFocalPreview } from "@/components/event-image-focal-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/hooks/use-admin-api";
import { getApiErrorMessage } from "@/lib/api-error";
import { createEventImage, presignEventImage } from "@/lib/admin-api";
import { queryClient } from "@/lib/query-client";
import { adminKeys } from "@/hooks/use-admin-api/keys";

const MAX_EVENT_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

type EventImageManagerProps = {
  eventId: string;
};

export function EventImageManager({ eventId }: EventImageManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const imagesQuery = useQuery(adminApi.event.images(eventId));
  const deleteMutation = useMutation(adminApi.event.deleteImage(eventId));
  const reorderMutation = useMutation(adminApi.event.reorderImages(eventId));
  const focalMutation = useMutation(adminApi.event.patchImageFocal(eventId));

  const images = imagesQuery.data ?? [];
  const busy =
    uploading ||
    deleteMutation.isPending ||
    reorderMutation.isPending ||
    focalMutation.isPending ||
    imagesQuery.isFetching;

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    e.target.value = "";
    if (!file) {
      return;
    }

    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      toast.error("Use JPEG, PNG, WebP, or AVIF images.");

      return;
    }
    if (file.size <= 0 || file.size > MAX_EVENT_IMAGE_BYTES) {
      toast.error("Image must be 8 MB or smaller.");

      return;
    }

    setUploading(true);
    try {
      const presign = await presignEventImage(eventId, {
        filename: file.name,
        contentType: file.type,
        byteSize: file.size,
      });

      const uploadRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed (${uploadRes.status})`);
      }

      await createEventImage(eventId, {
        storageKey: presign.storageKey,
        contentType: presign.contentType,
        byteSize: file.size,
      });

      await queryClient.invalidateQueries({
        queryKey: adminKeys.eventImages.forEvent(eventId),
      });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to upload image"));
    } finally {
      setUploading(false);
    }
  };

  const saveFocal = (
    imageId: string,
    focal: { x: number; y: number } | null,
  ) => {
    focalMutation.mutate(
      {
        imageId,
        focalX: focal?.x ?? null,
        focalY: focal?.y ?? null,
      },
      {
        onSuccess: () => toast.success("Crop focus saved"),
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to save crop point")),
      },
    );
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;

    if (target < 0 || target >= images.length) {
      return;
    }
    const next = [...images];
    const [item] = next.splice(index, 1);

    next.splice(target, 0, item!);
    reorderMutation.mutate(
      { imageIds: next.map((img) => img.id) },
      {
        onSuccess: () => toast.success("Image order updated"),
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Failed to reorder images")),
      },
    );
  };

  const handleDelete = (imageId: string) => {
    if (!confirm("Delete this image?")) {
      return;
    }
    deleteMutation.mutate(imageId, {
      onSuccess: () => toast.success("Image deleted"),
      onError: (err) =>
        toast.error(getApiErrorMessage(err, "Failed to delete image")),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button disabled={busy} type="button" onClick={handlePickFile}>
          {uploading ? "Uploading…" : "Upload image"}
        </Button>
        <Input
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          type="file"
          onChange={(e) => void handleFileChange(e)}
        />
        <p className="text-xs text-muted-foreground">
          First image is the hero. Max 8 MB; JPEG, PNG, WebP, or AVIF.
        </p>
      </div>

      {imagesQuery.isError ? (
        <p className="text-sm text-red-400">
          {getApiErrorMessage(imagesQuery.error, "Failed to load images")}
        </p>
      ) : null}

      {images.length === 0 && !imagesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">No images yet.</p>
      ) : null}

      {images.length > 0 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="border border-border rounded-md overflow-hidden bg-muted/20"
            >
              <EventImageFocalPreview
                disabled={busy}
                image={image}
                isHero={index === 0}
                onFocalChange={(focal) => saveFocal(image.id, focal)}
                onFocalReset={() => saveFocal(image.id, null)}
              />
              <div className="flex flex-wrap gap-1 p-2">
                <Button
                  disabled={busy || index === 0}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => moveImage(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  disabled={busy || index === images.length - 1}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => moveImage(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  disabled={busy}
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(image.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
