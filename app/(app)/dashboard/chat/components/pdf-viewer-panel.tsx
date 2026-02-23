"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { Loader2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SourceDocumentPart } from "@/lib/types/chat";
import { getNumber, getString, isRecord } from "@/lib/utils";
import type { PdfDocumentViewerProps } from "./pdf-document-viewer";

const PdfDocumentViewer = dynamic<PdfDocumentViewerProps>(
  () => import("./pdf-document-viewer").then((mod) => mod.PdfDocumentViewer),
  {
    ssr: false,
    loading: () => <LoadingState label="Preparing viewer…" />,
  }
);

const LoadingState = ({ label }: { readonly label: string }) => (
  <div className="flex items-center gap-2 text-muted-foreground text-sm">
    <Loader2 className="size-4 animate-spin" />
    {label}
  </div>
);

interface PdfViewerPanelProps {
  readonly onClose: () => void;
  readonly source: SourceDocumentPart;
}

const isKnowledgeBaseFileId = (
  value: unknown
): value is Id<"knowledgeBaseFiles"> => typeof value === "string";

const getBbox = (value: unknown) => {
  if (!isRecord(value)) {
    return undefined;
  }
  const left = getNumber(value.left);
  const top = getNumber(value.top);
  const width = getNumber(value.width);
  const height = getNumber(value.height);
  if (
    left === undefined ||
    top === undefined ||
    width === undefined ||
    height === undefined
  ) {
    return undefined;
  }
  return { left, top, width, height };
};

const getSourceMeta = (source: SourceDocumentPart) => {
  const metadata = isRecord(source.providerMetadata)
    ? source.providerMetadata
    : undefined;
  if (!metadata) {
    return null;
  }
  const meta = isRecord(metadata.rag) ? metadata.rag : metadata;
  if (!meta) {
    return null;
  }
  if (!isKnowledgeBaseFileId(meta.fileId)) {
    return null;
  }
  return {
    fileId: meta.fileId,
    pageNumber: getNumber(meta.pageNumber),
    pageWidth: getNumber(meta.pageWidth),
    pageHeight: getNumber(meta.pageHeight),
    bbox: getBbox(meta.bbox),
    snippet: getString(meta.snippet),
  };
};

export function PdfViewerPanel({ source, onClose }: PdfViewerPanelProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const meta = getSourceMeta(source);
  const fileInfo = useQuery(
    api.knowledgeBase.kb.getFileViewerInfo,
    meta && isAuthenticated ? { fileId: meta.fileId } : "skip"
  );
  const pageNumber = getPageNumber(meta?.pageNumber);
  const highlight =
    meta?.bbox &&
    typeof meta.pageWidth === "number" &&
    meta.pageWidth > 0 &&
    typeof meta.pageHeight === "number" &&
    meta.pageHeight > 0
      ? {
          left: `${(meta.bbox.left / meta.pageWidth) * 100}%`,
          top: `${(meta.bbox.top / meta.pageHeight) * 100}%`,
          width: `${(meta.bbox.width / meta.pageWidth) * 100}%`,
          height: `${(meta.bbox.height / meta.pageHeight) * 100}%`,
        }
      : null;
  const title = fileInfo?.filename ?? source.title ?? "Document";
  const panelContent = getPanelContent({
    fileInfo,
    highlight,
    isAuthenticated,
    isAuthLoading,
    meta,
    pageNumber,
  });

  return (
    <div className="flex h-full min-w-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="min-w-0 pr-2">
          <div
            className="line-clamp-2 break-all font-medium text-sm leading-tight"
            title={title}
          >
            {title}
          </div>
          {meta?.snippet && (
            <div className="line-clamp-1 break-all text-muted-foreground text-xs">
              {meta.snippet}
            </div>
          )}
        </div>
        <Button
          aria-label="Close PDF panel"
          onClick={onClose}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <X />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-3">{panelContent}</div>
    </div>
  );
}

const getPageNumber = (value: number | undefined) => {
  if (!(value && Number.isInteger(value)) || value < 1) {
    return 1;
  }
  return value;
};

interface PanelContentProps {
  readonly fileInfo:
    | {
        readonly contentType: string;
        readonly filename: string;
        readonly url: string;
      }
    | null
    | undefined;
  readonly highlight: PdfDocumentViewerProps["highlight"];
  readonly isAuthenticated: boolean;
  readonly isAuthLoading: boolean;
  readonly meta: ReturnType<typeof getSourceMeta>;
  readonly pageNumber: number;
}

const getPanelContent = ({
  fileInfo,
  highlight,
  isAuthenticated,
  isAuthLoading,
  meta,
  pageNumber,
}: PanelContentProps) => {
  if (isAuthLoading) {
    return <LoadingState label="Checking authentication…" />;
  }
  if (!isAuthenticated) {
    return (
      <div className="text-muted-foreground text-sm">
        Please sign in to preview this document.
      </div>
    );
  }
  if (!meta) {
    return (
      <div className="text-muted-foreground text-sm">
        No preview metadata is available for this source.
      </div>
    );
  }
  if (fileInfo === undefined) {
    return <LoadingState label="Fetching document URL…" />;
  }
  if (!fileInfo) {
    return (
      <div className="text-muted-foreground text-sm">
        Unable to load this document.
      </div>
    );
  }
  return (
    <PdfDocumentViewer
      fileUrl={fileInfo.url}
      highlight={highlight}
      pageNumber={pageNumber}
    />
  );
};
