"use client";

import { Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

const PDF_DOCUMENT_OPTIONS = {
  disableRange: true,
  disableStream: true,
  disableAutoFetch: true,
};

const LoadingState = ({ label }: { readonly label: string }) => (
  <div className="flex items-center gap-2 text-muted-foreground text-sm">
    <Loader2 className="size-4 animate-spin" />
    {label}
  </div>
);

export interface PdfDocumentViewerProps {
  readonly fileUrl: string;
  readonly highlight: {
    readonly left: string;
    readonly top: string;
    readonly width: string;
    readonly height: string;
  } | null;
  readonly pageNumber: number;
}

export function PdfDocumentViewer({
  fileUrl,
  pageNumber,
  highlight,
}: PdfDocumentViewerProps) {
  return (
    <div className="relative">
      <Document
        error={
          <div className="text-muted-foreground text-sm">
            Failed to load PDF file.
          </div>
        }
        file={fileUrl}
        key={fileUrl}
        loading={<LoadingState label="Loading document…" />}
        options={PDF_DOCUMENT_OPTIONS}
      >
        <Page
          loading={<LoadingState label="Rendering page…" />}
          pageNumber={pageNumber}
          renderAnnotationLayer={false}
          renderTextLayer={false}
        />
      </Document>
      {highlight && (
        <div
          className="pointer-events-none absolute rounded-sm bg-yellow-300/60 mix-blend-multiply"
          style={highlight}
        />
      )}
    </div>
  );
}
