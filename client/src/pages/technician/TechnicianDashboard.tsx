import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { submitQC, getTechnicianProgress, getTechnicianQCSubmissions } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";

type ImageField = {
  key: "tapImage" | "groundBlockImage" | "bondingImage" | "houseImage" | "jobScreenshot";
  title: string;
  description: string;
  source: "camera" | "gallery";
};

type PreparedImage = {
  file: File;
  previewUrl: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  isCompressing: boolean;
  error?: string;
};

const imageFields: ImageField[] = [
  { key: "jobScreenshot", title: "Job screenshot", description: "Upload the screenshot from the gallery", source: "gallery" },
  { key: "tapImage", title: "Onsite photo 1", description: "Take this photo onsite with the camera", source: "camera" },
  { key: "groundBlockImage", title: "Onsite photo 2", description: "Take this photo onsite with the camera", source: "camera" },
  { key: "bondingImage", title: "Onsite photo 3", description: "Take this photo onsite with the camera", source: "camera" },
  { key: "houseImage", title: "Onsite photo 4", description: "Take this photo onsite with the camera", source: "camera" },
];

const onsiteImageFields = imageFields.filter((field) => field.source === "camera");

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [images, setImages] = useState<Partial<Record<ImageField["key"], PreparedImage>>>({});
  const [formKey, setFormKey] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imagesRef = useRef(images);

  const progressQuery = useQuery({
    queryKey: ["/api/technicians/my-progress"],
    queryFn: getTechnicianProgress,
  });

  const submissionsQuery = useQuery({
    queryKey: ["/api/qc-submissions/technician"],
    queryFn: getTechnicianQCSubmissions,
  });

  const requiredMissing = useMemo(
    () => imageFields.filter((field) => !images[field.key]?.file),
    [images],
  );

  const isCompressing = Object.values(images).some((image) => image?.isCompressing);
  const onsiteReadyCount = onsiteImageFields.filter((field) => images[field.key]?.file).length;
  const screenshotReady = Boolean(images.jobScreenshot?.file);
  const detailsReady = Boolean(jobId.trim() && accountNumber.trim());
  const nextOnsiteField = onsiteImageFields.find((field) => !images[field.key]?.file);
  const allOnsiteReady = onsiteReadyCount === onsiteImageFields.length;
  const compressionSaved = Object.values(images).reduce((total, image) => {
    if (!image) return total;
    return total + Math.max(0, image.originalSize - image.compressedSize);
  }, 0);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      Object.values(imagesRef.current).forEach((image) => {
        if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = cameraStream;
    if (cameraStream) {
      void video.play().catch(() => {
        setCameraError("Camera opened, but video preview could not start.");
      });
    }
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  const setPreparedImage = async (field: ImageField, file: File) => {
    const existing = images[field.key];
    if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl);

    const placeholderUrl = URL.createObjectURL(file);
    setImages((current) => ({
      ...current,
      [field.key]: {
        file,
        previewUrl: placeholderUrl,
        originalName: file.name,
        originalSize: file.size,
        compressedSize: file.size,
        isCompressing: true,
      },
    }));

    try {
      const compressed = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressed);
      URL.revokeObjectURL(placeholderUrl);

      setImages((current) => ({
        ...current,
        [field.key]: {
          file: compressed,
          previewUrl,
          originalName: file.name,
          originalSize: file.size,
          compressedSize: compressed.size,
          isCompressing: false,
        },
      }));
    } catch (error) {
      setImages((current) => ({
        ...current,
        [field.key]: {
          file,
          previewUrl: placeholderUrl,
          originalName: file.name,
          originalSize: file.size,
          compressedSize: file.size,
          isCompressing: false,
          error: "Could not compress this image; original will be uploaded.",
        },
      }));
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
  };

  const startCamera = async () => {
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
      setCameraError("Unable to open camera. Please allow camera access and try again.");
    } finally {
      setIsStartingCamera(false);
    }
  };

  const captureLivePhoto = async () => {
    if (!nextOnsiteField || !videoRef.current) return;

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

      const file = new File([blob], `${nextOnsiteField.key}-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      await setPreparedImage(nextOnsiteField, file);

      if (onsiteReadyCount + 1 >= onsiteImageFields.length) {
        stopCamera();
      }
    } catch (error) {
      setCameraError("Could not capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const clearImage = (field: ImageField) => {
    if (field.key === "jobScreenshot") {
      stopCamera();
    }

    setImages((current) => {
      const keysToClear = field.key === "jobScreenshot"
        ? imageFields.map((imageField) => imageField.key)
        : [field.key];
      const next = { ...current };

      keysToClear.forEach((key) => {
        const image = current[key];
        if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
        delete next[key];
      });

      return next;
    });
    setFormKey((key) => key + 1);
  };

  const resetForm = () => {
    Object.values(images).forEach((image) => {
      if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    });
    stopCamera();
    setCameraError(null);
    setJobId("");
    setAccountNumber("");
    setImages({});
    setFormKey((key) => key + 1);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("jobId", jobId.trim());
      formData.append("accountNumber", accountNumber.trim());

      imageFields.forEach((field) => {
        const image = images[field.key];
        if (image?.file) {
          formData.append(field.key, image.file);
        }
      });

      return submitQC(formData);
    },
    onSuccess: () => {
      toast({
        title: "QC submitted",
        description: "Your images were uploaded for supervisor review.",
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

  const canSubmit = jobId.trim() && accountNumber.trim() && requiredMissing.length === 0 && !isCompressing && !submitMutation.isPending;
  const progress = progressQuery.data;
  const recentSubmissions = (submissionsQuery.data ?? []).slice(0, 4);
  const screenshotImage = images.jobScreenshot;
  const captureButtonLabel = allOnsiteReady
    ? "All live photos ready"
    : cameraStream
    ? nextOnsiteField
      ? `Take photo ${onsiteReadyCount + 1}`
      : "All live photos ready"
    : "Open camera";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`mx-auto ${screenshotReady ? "max-w-xl space-y-3 p-3 sm:p-4" : "max-w-6xl space-y-6 p-4 sm:p-6"}`}>
        {!screenshotReady && (
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Card className="overflow-hidden border-none bg-[#031626] text-white shadow-xl">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-blue-300">Technician QC</p>
                    <h1 className="mt-2 text-3xl font-semibold">Submit installation photos</h1>
                    <p className="mt-2 max-w-2xl text-sm text-gray-300">
                      Paste the job details, upload the screenshot, then take the live onsite photos in one compact camera view.
                    </p>
                  </div>
                  {progress ? (
                    <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                      <p className="text-sm text-gray-300">Approved this period</p>
                      <p className="mt-1 text-3xl font-semibold">{progress.submittedCount} / {progress.requiredCount}</p>
                      <div className="mt-3">
                        <StatusBadge status={progress.status} statusIcon={progress.statusIcon} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Upload status
                </CardTitle>
                <CardDescription>{requiredMissing.length === 0 ? "Required photos are ready." : `${requiredMissing.length} required photo${requiredMissing.length === 1 ? "" : "s"} missing.`}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-md bg-gray-100 px-3 py-2 text-sm">
                  <span>Compression saved</span>
                  <span className="font-medium">{formatBytes(compressionSaved)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-gray-100 px-3 py-2 text-sm">
                  <span>Screenshot</span>
                  <Badge variant={screenshotReady ? "default" : "outline"}>{screenshotReady ? "Ready" : "Missing"}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md bg-gray-100 px-3 py-2 text-sm">
                  <span>Onsite photos</span>
                  <Badge variant="outline">{onsiteReadyCount} / {onsiteImageFields.length}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className={screenshotReady ? "border-none bg-transparent shadow-none" : "border-gray-200 shadow-sm"}>
          {!screenshotReady && (
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-blue-600" />
                New QC submission
              </CardTitle>
              <CardDescription>Job details and image evidence for this installation.</CardDescription>
            </CardHeader>
          )}
          <CardContent className={screenshotReady ? "space-y-3 p-0" : "space-y-6"}>
            {!screenshotReady ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="jobId" className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-blue-600" />
                      Job Number
                    </Label>
                    <Input
                      id="jobId"
                      value={jobId}
                      onChange={(event) => setJobId(event.target.value)}
                      placeholder="Enter job number"
                      className="h-12 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber" className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-blue-600" />
                      Account Number
                    </Label>
                    <Input
                      id="accountNumber"
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      placeholder="Enter account number"
                      className="h-12 bg-white"
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">Job screenshot</h3>
                        <Badge variant="default">Required</Badge>
                        <Badge variant="outline">Gallery upload</Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">Upload the screenshot from the gallery.</p>
                    </div>
                  </div>

                  <label className={`flex aspect-[16/9] flex-col items-center justify-center gap-3 p-6 text-center transition ${detailsReady ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed bg-gray-50 opacity-70"}`}>
                    <div className="rounded-full bg-blue-50 p-4 text-blue-600">
                      <ImagePlus className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Upload screenshot</p>
                      <p className="text-xs text-gray-500">
                        {detailsReady ? "JPG, PNG, or SVG up to 10 MB" : "Enter job number and account number first"}
                      </p>
                    </div>
                    <input
                      key={`jobScreenshot-${formKey}`}
                      type="file"
                      accept="image/*"
                      disabled={!detailsReady}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void setPreparedImage(imageFields[0], file);
                      }}
                    />
                  </label>
                </div>

                <div className="flex justify-between border-t border-gray-100 pt-5">
                  <Button type="button" variant="outline" onClick={resetForm} disabled={submitMutation.isPending}>
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">Job {jobId}</p>
                      <p className="truncate text-xs text-gray-500">Account {accountNumber}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {screenshotImage ? (
                        <img
                          src={screenshotImage.previewUrl}
                          alt="Uploaded job screenshot"
                          className="h-10 w-16 rounded-md border border-gray-200 object-cover"
                        />
                      ) : null}
                      <Button type="button" variant="outline" size="sm" onClick={() => clearImage(imageFields[0])} disabled={submitMutation.isPending}>
                        <X className="h-4 w-4" />
                        Change
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 bg-gray-50 pt-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg font-semibold text-[#16486b]">
                      3
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900">Live QC photos</h2>
                      <p className="mt-1 text-sm text-gray-500">{onsiteReadyCount} of {onsiteImageFields.length} required</p>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl bg-[#0b2a44] text-white shadow-sm">
                    <div className="relative flex h-64 items-center justify-center sm:h-80">
                      {cameraStream ? (
                        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
                      ) : (
                        <div className="flex flex-col items-center gap-4 px-6 text-center">
                          <VideoOff className="h-12 w-12 text-slate-200" />
                          <div>
                            <p className="text-2xl font-semibold">Camera is off</p>
                            <p className="mt-3 text-base text-slate-300">Photos must be taken here in real time.</p>
                          </div>
                        </div>
                      )}
                      {isCapturing || isCompressing ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {isCapturing ? "Capturing" : "Compressing"}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {cameraError ? (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 h-14 w-full border-gray-300 bg-white text-base font-semibold text-gray-900 hover:bg-gray-50"
                    disabled={isStartingCamera || isCapturing || isCompressing || allOnsiteReady}
                    onClick={() => {
                      if (cameraStream) {
                        void captureLivePhoto();
                      } else {
                        void startCamera();
                      }
                    }}
                  >
                    {isStartingCamera || isCapturing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                    {captureButtonLabel}
                  </Button>

                  <div className="mt-5 grid grid-cols-4 gap-3">
                    {onsiteImageFields.map((field, index) => {
                      const image = images[field.key];

                      return (
                        <div key={field.key} className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-white">
                          {image ? (
                            <>
                              <img src={image.previewUrl} alt={field.title} className="h-full w-full object-cover" />
                              <button
                                type="button"
                                aria-label={`Remove ${field.title}`}
                                onClick={() => clearImage(field)}
                                className="absolute right-1.5 top-1.5 rounded-md bg-white/95 p-1.5 text-red-600 shadow-sm hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              {image.isCompressing ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                              <Camera className="h-5 w-5" />
                            </div>
                          )}
                          <span className="absolute bottom-1.5 left-1.5 flex h-7 min-w-7 items-center justify-center rounded-md bg-[#16486b] px-2 text-sm font-bold text-white">
                            {index + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    disabled={!canSubmit}
                    onClick={() => submitMutation.mutate()}
                    className="mt-7 h-16 w-full rounded-xl bg-[#16486b] text-lg font-semibold hover:bg-[#0f3854]"
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
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-blue-600" />
                Recent submissions
              </CardTitle>
              <CardDescription>Your latest QC submissions and review status.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentSubmissions.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {recentSubmissions.map((submission: any) => (
                    <div key={submission.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">Job {submission.jobId}</p>
                        <p className="truncate text-sm text-gray-500">Account {submission.accountNumber || submission.address}</p>
                      </div>
                      <StatusBadge status={submission.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
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
