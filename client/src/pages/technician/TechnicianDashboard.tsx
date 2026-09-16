import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Camera,
  FileImage,
  Hash,
  ImagePlus,
  Loader2,
  RotateCcw,
  Send,
  Trash2,
  VideoOff,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/StatusBadge";
import { getTechnicianProgress, getTechnicianQCSubmissions, submitQC } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const MIN_ONSITE_PHOTOS = 3;
const MAX_ONSITE_PHOTOS = 7;

type PreparedImage = {
  id: string;
  file: File;
  previewUrl: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  isCompressing: boolean;
  error?: string;
};

function createImageId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function revokeImage(image?: PreparedImage | null) {
  if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
}

function createPreparedImage(file: File, previewUrl: string, isCompressing: boolean, id = createImageId()): PreparedImage {
  return {
    id,
    file,
    previewUrl,
    originalName: file.name,
    originalSize: file.size,
    compressedSize: file.size,
    isCompressing,
  };
}

async function compressImage(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || file.size < 450 * 1024) {
    return file;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image"));
    img.src = dataUrl;
  });

  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.78);
  });

  if (!blob || blob.size >= file.size) return file;

  const safeName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${safeName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export default function TechnicianDashboard() {
  const { toast } = useToast();
  const [jobId, setJobId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [jobScreenshot, setJobScreenshot] = useState<PreparedImage | null>(null);
  const [onsiteImages, setOnsiteImages] = useState<PreparedImage[]>([]);
  const [formKey, setFormKey] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenshotRef = useRef<PreparedImage | null>(null);
  const onsiteImagesRef = useRef<PreparedImage[]>([]);

  const progressQuery = useQuery({
    queryKey: ["/api/technicians/my-progress"],
    queryFn: getTechnicianProgress,
  });

  const submissionsQuery = useQuery({
    queryKey: ["/api/qc-submissions/technician"],
    queryFn: getTechnicianQCSubmissions,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("jobId", jobId.trim());
      formData.append("accountNumber", accountNumber.trim());

      if (jobScreenshot?.file) {
        formData.append("jobScreenshot", jobScreenshot.file);
      }

      onsiteImages.forEach((image) => {
        formData.append("onsiteImages", image.file);
      });

      return submitQC(formData);
    },
    onSuccess: () => {
      toast({
        title: "QC submitted",
        description: "Your QC is ready for supervisor review.",
      });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/qc-submissions/technician"] });
      queryClient.invalidateQueries({ queryKey: ["/api/technicians/my-progress"] });
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error?.message || "Please check the form and try again.",
        variant: "destructive",
      });
    },
  });

  const detailsReady = Boolean(jobId.trim() && accountNumber.trim());
  const screenshotReady = Boolean(jobScreenshot?.file);
  const onsiteReadyCount = onsiteImages.length;
  const maximumReached = onsiteReadyCount >= MAX_ONSITE_PHOTOS;
  const isCompressing = Boolean(jobScreenshot?.isCompressing) || onsiteImages.some((image) => image.isCompressing);
  const progress = progressQuery.data;
  const recentSubmissions = (submissionsQuery.data ?? []).slice(0, 4);

  useEffect(() => {
    screenshotRef.current = jobScreenshot;
  }, [jobScreenshot]);

  useEffect(() => {
    onsiteImagesRef.current = onsiteImages;
  }, [onsiteImages]);

  useEffect(() => {
    return () => {
      revokeImage(screenshotRef.current);
      onsiteImagesRef.current.forEach(revokeImage);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = cameraStream;
    if (cameraStream) {
      void video.play().catch(() => {
        setCameraError("Camera opened, but the preview could not start.");
      });
    }
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  const handleNeedsJobDetails = () => {
    const missing = [
      !jobId.trim() ? "job number" : null,
      !accountNumber.trim() ? "account number" : null,
    ].filter(Boolean);

    toast({
      title: "Job details needed",
      description: `Enter ${missing.join(" and ")} before uploading the screenshot.`,
    });
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
  };

  const clearOnsiteImages = () => {
    onsiteImagesRef.current.forEach(revokeImage);
    setOnsiteImages([]);
  };

  const setScreenshotFile = async (file: File) => {
    stopCamera();
    clearOnsiteImages();
    setCameraError(null);

    const id = createImageId();
    const placeholderUrl = URL.createObjectURL(file);
    const placeholder = createPreparedImage(file, placeholderUrl, true, id);

    revokeImage(screenshotRef.current);
    setJobScreenshot(placeholder);

    try {
      const compressed = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressed);
      URL.revokeObjectURL(placeholderUrl);

      setJobScreenshot((current) => {
        if (current?.id !== id) {
          URL.revokeObjectURL(previewUrl);
          return current;
        }

        return {
          ...current,
          file: compressed,
          previewUrl,
          compressedSize: compressed.size,
          isCompressing: false,
        };
      });
    } catch (error) {
      setJobScreenshot((current) => current?.id === id
        ? {
            ...current,
            isCompressing: false,
            error: "Could not compress this screenshot; original will be uploaded.",
          }
        : current,
      );
    }
  };

  const addOnsiteFile = async (file: File) => {
    if (onsiteImagesRef.current.length >= MAX_ONSITE_PHOTOS) {
      toast({
        title: "Maximum reached",
        description: `You can attach up to ${MAX_ONSITE_PHOTOS} live QC photos.`,
      });
      return;
    }

    const id = createImageId();
    const placeholderUrl = URL.createObjectURL(file);
    const placeholder = createPreparedImage(file, placeholderUrl, true, id);
    setOnsiteImages((current) => [...current, placeholder]);

    try {
      const compressed = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressed);
      URL.revokeObjectURL(placeholderUrl);

      setOnsiteImages((current) => {
        let replaced = false;
        const next = current.map((image) => {
          if (image.id !== id) return image;
          replaced = true;
          return {
            ...image,
            file: compressed,
            previewUrl,
            compressedSize: compressed.size,
            isCompressing: false,
          };
        });

        if (!replaced) URL.revokeObjectURL(previewUrl);
        return next;
      });
    } catch (error) {
      setOnsiteImages((current) => current.map((image) => image.id === id
        ? {
            ...image,
            isCompressing: false,
            error: "Could not compress this photo; original will be uploaded.",
          }
        : image,
      ));
    }
  };

  const removeOnsiteImage = (id: string) => {
    setOnsiteImages((current) => {
      const image = current.find((item) => item.id === id);
      revokeImage(image);
      return current.filter((item) => item.id !== id);
    });
  };

  const clearScreenshot = () => {
    stopCamera();
    revokeImage(jobScreenshot);
    clearOnsiteImages();
    setJobScreenshot(null);
    setCameraError(null);
    setFormKey((key) => key + 1);
  };

  function resetForm() {
    stopCamera();
    revokeImage(jobScreenshot);
    clearOnsiteImages();
    setCameraError(null);
    setJobScreenshot(null);
    setJobId("");
    setAccountNumber("");
    setFormKey((key) => key + 1);
  }

  const startCamera = async () => {
    if (!jobScreenshot) {
      toast({
        title: "Screenshot needed",
        description: "Upload the job screenshot before taking live QC photos.",
      });
      return;
    }

    if (maximumReached) {
      toast({
        title: "Maximum reached",
        description: `You can attach up to ${MAX_ONSITE_PHOTOS} live QC photos.`,
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not available in this browser.");
      return;
    }

    setIsStartingCamera(true);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      setCameraStream(stream);
    } catch (error) {
      setCameraError("Unable to open camera. Allow camera access and try again.");
    } finally {
      setIsStartingCamera(false);
    }
  };

  const captureLivePhoto = async () => {
    if (maximumReached) {
      toast({
        title: "Maximum reached",
        description: "Delete a photo first if you want to retake one.",
      });
      return;
    }

    if (!videoRef.current) return;

    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setCameraError("Camera preview is still starting. Try again in a moment.");
      return;
    }

    setIsCapturing(true);
    setCameraError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to read camera frame");

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.86);
      });

      if (!blob) throw new Error("Unable to capture image");

      const file = new File([blob], `onsite-photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      await addOnsiteFile(file);

      if (onsiteImagesRef.current.length + 1 >= MAX_ONSITE_PHOTOS) {
        stopCamera();
      }
    } catch (error) {
      setCameraError("Could not capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCameraButtonClick = () => {
    if (submitMutation.isPending || isCapturing || isStartingCamera || isCompressing) return;

    if (maximumReached) {
      toast({
        title: "Maximum reached",
        description: `You can attach up to ${MAX_ONSITE_PHOTOS} live QC photos.`,
      });
      return;
    }

    if (cameraStream) {
      void captureLivePhoto();
    } else {
      void startCamera();
    }
  };

  const handleSubmit = () => {
    if (!jobId.trim() || !accountNumber.trim()) {
      handleNeedsJobDetails();
      return;
    }

    if (!jobScreenshot) {
      toast({
        title: "Screenshot needed",
        description: "Upload the job screenshot before submitting QC.",
      });
      return;
    }

    if (onsiteReadyCount < MIN_ONSITE_PHOTOS) {
      toast({
        title: "More live photos needed",
        description: `Take at least ${MIN_ONSITE_PHOTOS} live QC photos. You can add up to ${MAX_ONSITE_PHOTOS}.`,
      });
      return;
    }

    if (isCompressing) {
      toast({
        title: "Images are still preparing",
        description: "Wait a moment for compression to finish.",
      });
      return;
    }

    submitMutation.mutate();
  };

  const captureButtonLabel = maximumReached
    ? "Maximum photos added"
    : cameraStream
      ? `Take photo ${onsiteReadyCount + 1}`
      : "Open camera";

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <div className={`mx-auto ${screenshotReady ? "max-w-md space-y-3 p-3 sm:p-4" : "max-w-6xl space-y-6 p-4 sm:p-6"}`}>
        {!screenshotReady && (
          <Card className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-sm backdrop-blur">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                    <Camera className="h-4 w-4" />
                    Technician QC
                  </div>
                  <h1 className="mt-4 text-3xl font-semibold text-slate-950">New QC submission</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">
                    Paste the job details, upload the screenshot, then take 3 to 7 live photos in the camera view.
                  </p>
                </div>
                {progress ? (
                  <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-4 text-slate-900">
                    <p className="text-sm text-slate-500">Approved this period</p>
                    <p className="mt-1 text-3xl font-semibold">{progress.submittedCount} / {progress.requiredCount}</p>
                    <div className="mt-3">
                      <StatusBadge status={progress.status} statusIcon={progress.statusIcon} />
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={screenshotReady ? "border-none bg-transparent shadow-none" : "rounded-[28px] border border-white/80 bg-white/90 shadow-sm backdrop-blur"}>
          {!screenshotReady && (
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-950">
                <FileImage className="h-5 w-5 text-teal-600" />
                Job details
              </CardTitle>
              <CardDescription>Enter both numbers before uploading the screenshot.</CardDescription>
            </CardHeader>
          )}
          <CardContent className={screenshotReady ? "space-y-3 p-0" : "space-y-6"}>
            {!screenshotReady ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="jobId" className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-teal-600" />
                      Job Number
                    </Label>
                    <Input
                      id="jobId"
                      value={jobId}
                      onChange={(event) => setJobId(event.target.value)}
                      placeholder="Enter job number"
                      className="h-12 rounded-2xl bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber" className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-teal-600" />
                      Account Number
                    </Label>
                    <Input
                      id="accountNumber"
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      placeholder="Enter account number"
                      className="h-12 rounded-2xl bg-white"
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-950">Job screenshot</h3>
                        <Badge variant="default">Required</Badge>
                        <Badge variant="outline">Gallery upload</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">Upload the screenshot from the gallery.</p>
                    </div>
                  </div>

                  {detailsReady ? (
                    <label className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-3 p-6 text-center transition hover:bg-slate-50">
                      <div className="rounded-3xl bg-teal-50 p-4 text-teal-600">
                        <ImagePlus className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-950">Upload screenshot</p>
                        <p className="text-xs text-slate-500">JPG, PNG, or SVG up to 10 MB</p>
                      </div>
                      <input
                        key={`jobScreenshot-${formKey}`}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void setScreenshotFile(file);
                        }}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 p-6 text-center transition hover:bg-slate-50"
                      onClick={handleNeedsJobDetails}
                    >
                      <div className="rounded-3xl bg-amber-50 p-4 text-amber-600">
                        <AlertCircle className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-950">Upload screenshot</p>
                        <p className="text-xs text-slate-500">Enter job number and account number first</p>
                      </div>
                    </button>
                  )}
                </div>

                <div className="flex justify-between border-t border-slate-100 pt-5">
                  <Button type="button" variant="outline" onClick={resetForm} disabled={submitMutation.isPending} className="rounded-2xl">
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-[24px] border border-white/80 bg-white/95 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">Job {jobId}</p>
                      <p className="truncate text-xs text-slate-500">Account {accountNumber}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src={jobScreenshot?.previewUrl}
                        alt="Uploaded job screenshot"
                        className="h-10 w-16 rounded-2xl border border-slate-200 object-cover"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={clearScreenshot} disabled={submitMutation.isPending} className="rounded-2xl">
                        <X className="h-4 w-4" />
                        Change
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/80 bg-white/95 p-4 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg font-semibold text-teal-700">
                      3
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-slate-950">Live QC photos</h2>
                      <p className="mt-1 text-sm text-slate-500">{onsiteReadyCount} of {MIN_ONSITE_PHOTOS} required · {MAX_ONSITE_PHOTOS} maximum</p>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-slate-950">
                    <div className="relative flex h-56 items-center justify-center">
                      {cameraStream ? (
                        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
                      ) : (
                        <div className="flex flex-col items-center gap-3 px-6 text-center">
                          <div className="rounded-3xl bg-white p-4 text-teal-600 shadow-sm">
                            <VideoOff className="h-9 w-9" />
                          </div>
                          <div>
                            <p className="text-xl font-semibold">Camera is off</p>
                            <p className="mt-2 text-sm text-slate-500">Photos must be taken here in real time.</p>
                          </div>
                        </div>
                      )}
                      {isCapturing || isCompressing ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-slate-900 backdrop-blur-sm">
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {isCapturing ? "Capturing" : "Preparing"}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {cameraError ? (
                    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 h-14 w-full rounded-2xl border-slate-200 bg-white text-base font-semibold text-slate-950 hover:bg-slate-50"
                    disabled={isStartingCamera || isCapturing || isCompressing || submitMutation.isPending}
                    onClick={handleCameraButtonClick}
                  >
                    {isStartingCamera || isCapturing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                    {captureButtonLabel}
                  </Button>

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {Array.from({ length: MAX_ONSITE_PHOTOS }).map((_, index) => {
                      const image = onsiteImages[index];

                      return (
                        <div key={image?.id || index} className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          {image ? (
                            <>
                              <img src={image.previewUrl} alt={`Onsite photo ${index + 1}`} className="h-full w-full object-cover" />
                              <button
                                type="button"
                                aria-label={`Remove onsite photo ${index + 1}`}
                                onClick={() => removeOnsiteImage(image.id)}
                                className="absolute right-1 top-1 rounded-xl bg-white/95 p-1 text-rose-600 shadow-sm hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              {image.isCompressing ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-slate-900">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                              <Camera className="h-4 w-4" />
                            </div>
                          )}
                          <span className="absolute bottom-1 left-1 flex h-6 min-w-6 items-center justify-center rounded-xl bg-teal-600 px-1.5 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending}
                    className="mt-5 h-14 w-full rounded-[22px] bg-teal-600 text-base font-semibold text-white hover:bg-teal-700"
                  >
                    {submitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    {submitMutation.isPending ? "Submitting..." : "Submit QC for approval"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!screenshotReady && (
          <Card className="rounded-[28px] border border-white/80 bg-white/90 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-950">
                <FileImage className="h-5 w-5 text-teal-600" />
                Recent submissions
              </CardTitle>
              <CardDescription>Your latest QC submissions and review status.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentSubmissions.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {recentSubmissions.map((submission: any) => (
                    <div key={submission.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-950">Job {submission.jobId}</p>
                        <p className="truncate text-sm text-slate-500">Account {submission.accountNumber || submission.address}</p>
                      </div>
                      <StatusBadge status={submission.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  Submitted QCs will appear here.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
