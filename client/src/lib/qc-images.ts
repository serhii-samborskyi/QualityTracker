export type QCImageSource = {
  onsiteImages?: string[] | null;
  tapImage?: string | null;
  groundBlockImage?: string | null;
  bondingImage?: string | null;
  houseImage?: string | null;
  jobScreenshot?: string | null;
};

export type QCImageItem = {
  title: string;
  url: string;
};

export function getOnsitePhotoItems(submission: QCImageSource): QCImageItem[] {
  const onsiteImages = Array.isArray(submission.onsiteImages)
    ? submission.onsiteImages.filter(Boolean)
    : [];

  const imageUrls = onsiteImages.length > 0
    ? onsiteImages
    : [
        submission.tapImage,
        submission.groundBlockImage,
        submission.bondingImage,
        submission.houseImage,
      ].filter(Boolean);

  return imageUrls.map((url, index) => ({
    title: `Onsite photo ${index + 1}`,
    url: String(url),
  }));
}

export function getQCViewerImages(submission: QCImageSource): QCImageItem[] {
  const images = getOnsitePhotoItems(submission);

  if (submission.jobScreenshot) {
    images.push({ title: "Job screenshot", url: submission.jobScreenshot });
  }

  return images;
}
