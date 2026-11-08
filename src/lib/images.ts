import { AppError } from "./errors";

const MAX_INPUT_BYTES = 30 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Redimensiona (lado maior ≤ maxSize) e regrava como JPEG.
 * Regravar no canvas também remove os metadados EXIF/GPS da foto.
 */
export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/") && file.type !== "") {
    throw new AppError("VALIDATION", "Escolha um arquivo de imagem (JPG, PNG ou WebP).");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new AppError("VALIDATION", "Essa imagem é grande demais (máximo de 30 MB).");
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      source = await loadImage(file);
    } catch (e) {
      throw new AppError(
        "VALIDATION",
        "Não consegui abrir essa imagem. Tente uma foto em JPG ou PNG.",
        e,
      );
    }
  }

  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AppError("UNKNOWN", "Seu navegador não conseguiu processar a imagem.");
  ctx.drawImage(source, 0, 0, w, h);
  if ("close" in source) source.close();

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob) throw new AppError("UNKNOWN", "Seu navegador não conseguiu processar a imagem.");
  return blob;
}
