"use client";

import { useAction, useQuery } from "convex/react";
import { BookOpen, Loader, RotateCw, Upload } from "lucide-react";
import {
  FileUpload,
  FileUploadContent,
  FileUploadTrigger,
} from "@/components/ui/ai/file-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { handleError } from "@/lib/handle-error";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

type FileStatus = "processing" | "ready" | "failed";

const getStatusBadgeVariant = (status: FileStatus) => {
  if (status === "failed") {
    return "destructive";
  }
  if (status === "processing") {
    return "secondary";
  }
  return "default";
};

const getStatusLabel = (status: FileStatus) => {
  if (status === "failed") {
    return "Failed";
  }
  if (status === "processing") {
    return "Processing";
  }
  return "Ready";
};

export function KnowledgeBaseDialog() {
  const generateUploadUrl = useAction(api.storage.generateUploadUrl);
  const registerUpload = useAction(api.knowledgeBase.kbActions.registerUpload);
  const retryProcessFile = useAction(
    api.knowledgeBase.kbActions.retryProcessFile
  );
  const deleteFile = useAction(api.knowledgeBase.kbActions.deleteFile);
  const files = useQuery(api.knowledgeBase.kb.listFiles);
  const fileList = files ?? [];
  const isLoading = files === undefined;
  const isEmpty = !isLoading && fileList.length === 0;

  const uploadFile = async (file: File) => {
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      const json: { storageId: Id<"_storage"> } = await response.json();
      await registerUpload({
        storageId: json.storageId,
        filename: file.name,
      });
    } catch (error) {
      handleError(error);
    }
  };

  const addFiles = (filesToAdd: File[]) => {
    for (const file of filesToAdd) {
      uploadFile(file).catch(() => undefined);
    }
  };
  const shouldShowList = !(isLoading || isEmpty);

  const handleRetry = (fileId: Id<"knowledgeBaseFiles">) => {
    retryProcessFile({ fileId }).catch(handleError);
  };

  const handleDelete = (fileId: Id<"knowledgeBaseFiles">) => {
    deleteFile({ fileId }).catch(handleError);
  };

  return (
    <Dialog>
      <SidebarMenuItem>
        <DialogTrigger asChild>
          <SidebarMenuButton>
            <BookOpen />
            <span>Knowledge Base</span>
          </SidebarMenuButton>
        </DialogTrigger>
      </SidebarMenuItem>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Knowledge Base</DialogTitle>
          <DialogDescription>
            Upload documents to build a shared knowledge base for all chats.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FileUpload onFilesAdded={addFiles}>
            <div className="flex flex-col gap-3">
              <FileUploadTrigger asChild>
                <Button className="w-full" type="button" variant="outline">
                  <Upload className="mr-2 size-4" />
                  Upload files
                </Button>
              </FileUploadTrigger>
              <div className="text-muted-foreground text-xs">
                Uploaded {fileList.length}
              </div>
            </div>
            <FileUploadContent>
              <div className="rounded-xl border bg-background px-6 py-4 text-center text-muted-foreground text-sm shadow-lg">
                Drop files to add to your knowledge base
              </div>
            </FileUploadContent>
          </FileUpload>
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs uppercase tracking-wide">
              Documents
            </div>
            {isLoading && <DocumentsSkeleton />}
            {isEmpty && (
              <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
                No documents uploaded yet.
              </div>
            )}
            {shouldShowList && (
              <div className="space-y-2">
                {fileList.map((file) => {
                  return (
                    <div
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                      key={file._id}
                    >
                      <div className="min-w-0">
                        <a
                          className="truncate font-medium hover:underline"
                          href={file.url}
                          rel="noopener"
                          target="_blank"
                        >
                          {file.filename}
                        </a>
                        {file.errorMessage && (
                          <div className="text-destructive text-xs">
                            Processing failed. Please try again.
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={getStatusBadgeVariant(file.status)}>
                          {file.status === "processing" && (
                            <Loader className="mr-1 size-3 animate-spin text-primary" />
                          )}
                          {getStatusLabel(file.status)}
                        </Badge>
                        {file.status === "failed" && (
                          <Button
                            aria-label="Retry processing"
                            onClick={() => handleRetry(file._id)}
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                          >
                            <RotateCw />
                          </Button>
                        )}
                        <ConfirmDeleteDialog
                          onConfirm={() => handleDelete(file._id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function DocumentsSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-10 animate-pulse rounded-md border bg-muted/30" />
      <div className="h-10 animate-pulse rounded-md border bg-muted/30" />
      <div className="h-10 animate-pulse rounded-md border bg-muted/30" />
    </div>
  );
}
