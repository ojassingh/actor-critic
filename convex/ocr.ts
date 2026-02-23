"use node";

import { Mistral } from "@mistralai/mistralai";
import { ConvexError } from "convex/values";

function getMistralClient(): Mistral {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new ConvexError({ code: "OCR_CONFIG_ERROR" });
  }
  return new Mistral({ apiKey });
}

async function extractDataFromPdf(
  mistral: Mistral,
  base64Pdf: string,
  maxPages?: number
): Promise<string> {
  const response = await mistral.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "document_url",
      documentUrl: `data:application/pdf;base64,${base64Pdf}`,
    },
  });
  if (maxPages && response.pages.length > maxPages) {
    console.warn("[ocr: extractTextFromPdf] PDF page limit exceeded");
    throw new ConvexError({ code: "OCR_PAGE_LIMIT_EXCEEDED" });
  }
  return response.pages
    .map((p: { markdown: string }) => p.markdown)
    .join("\n\n");
}

async function extractDataFromImage(
  mistral: Mistral,
  base64Image: string,
  contentType: string
): Promise<string> {
  const response = await mistral.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "image_url",
      imageUrl: `data:${contentType};base64,${base64Image}`,
    },
    includeImageBase64: true,
  });
  return response.pages
    .map((p: { markdown: string }) => p.markdown)
    .join("\n\n");
}

export const extractTextFromPdfBase64 = async (
  base64Pdf: string,
  maxPages?: number
): Promise<string> => {
  const mistral = getMistralClient();
  return await extractDataFromPdf(mistral, base64Pdf, maxPages);
};

export const extractTextFromImageBase64 = async (
  base64Image: string,
  contentType: string
): Promise<string> => {
  const mistral = getMistralClient();
  return await extractDataFromImage(mistral, base64Image, contentType);
};
