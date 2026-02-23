"use node";

import { Mistral } from "@mistralai/mistralai";
import type { OCRPageObject } from "@mistralai/mistralai/models/components/ocrpageobject";
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
    bboxAnnotationFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "response_schema",
        schemaDefinition: {
          type: "object",
          title: "SimpleResponse",
          properties: {
            answer: {
              type: "string",
              description:
                "Describe the the image in detail, and it's relevance to the document. Try to be very concise.",
            },
          },
          required: ["answer"],
        },
      },
    },
    includeImageBase64: false,
  });
  if (maxPages && response.pages.length > maxPages) {
    console.warn("[ocr: extractTextFromPdf] PDF page limit exceeded");
    throw new ConvexError({ code: "OCR_PAGE_LIMIT_EXCEEDED" });
  }

  return response.pages.map(getPageMarkdownWithAnnotations).join("\n\n");
}

function getPageMarkdownWithAnnotations(page: OCRPageObject): string {
  return page.images.reduce((markdown, image) => {
    const placeholder = `![${image.id}](${image.id})`;
    const annotation = image.imageAnnotation?.trim();
    return markdown.replace(
      placeholder,
      annotation && annotation.length > 0 ? annotation : ""
    );
  }, page.markdown);
}

export const extractTextFromPdfBase64 = async (
  base64Pdf: string,
  maxPages?: number
): Promise<string> => {
  const mistral = getMistralClient();
  return await extractDataFromPdf(mistral, base64Pdf, maxPages);
};
