"use client";

import {
  Children,
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FileUploadContextValue {
  disabled?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  multiple?: boolean;
}

const FileUploadContext = createContext<FileUploadContextValue | null>(null);

export interface FileUploadProps {
  accept?: string;
  children: React.ReactNode;
  disabled?: boolean;
  multiple?: boolean;
  onFilesAdded: (files: File[]) => void;
}

function FileUpload({
  onFilesAdded,
  children,
  multiple = true,
  accept = "image/*,application/pdf",
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleFiles = useCallback(
    async (files: FileList) => {
      const newFiles = Array.from(files);
      const validFiles: File[] = [];

      for (const file of newFiles) {
        const validation = await validateFile(file);
        if (!validation.ok) {
          toast.error(`${file.name}: ${validation.reason}`);
          continue;
        }
        validFiles.push(file);
      }

      const selected = multiple ? validFiles : validFiles.slice(0, 1);
      if (selected.length > 0) {
        onFilesAdded(selected);
      }
    },
    [multiple, onFilesAdded]
  );

  useEffect(() => {
    const handleDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragIn = (e: DragEvent) => {
      handleDrag(e);
      dragCounter.current++;
      if (e.dataTransfer?.items.length) {
        setIsDragging(true);
      }
    };

    const handleDragOut = (e: DragEvent) => {
      handleDrag(e);
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      handleDrag(e);
      setIsDragging(false);
      dragCounter.current = 0;
      if (e.dataTransfer?.files.length) {
        handleFiles(e.dataTransfer.files).catch(() => {
          return;
        });
      }
    };

    window.addEventListener("dragenter", handleDragIn);
    window.addEventListener("dragleave", handleDragOut);
    window.addEventListener("dragover", handleDrag);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragIn);
      window.removeEventListener("dragleave", handleDragOut);
      window.removeEventListener("dragover", handleDrag);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files).catch(() => {
        return;
      });
      e.target.value = "";
    }
  };

  return (
    <FileUploadContext.Provider
      value={{ isDragging, inputRef, multiple, disabled }}
    >
      <input
        accept={accept}
        aria-hidden
        className="hidden"
        disabled={disabled}
        multiple={multiple}
        onChange={handleFileSelect}
        ref={inputRef}
        type="file"
      />
      {children}
    </FileUploadContext.Provider>
  );
}

export type FileUploadTriggerProps =
  React.ComponentPropsWithoutRef<"button"> & {
    asChild?: boolean;
  };

function FileUploadTrigger({
  asChild = false,
  className,
  children,
  ...props
}: FileUploadTriggerProps) {
  const context = useContext(FileUploadContext);
  const handleClick = () => context?.inputRef.current?.click();

  if (asChild) {
    const child = Children.only(children) as React.ReactElement<
      React.HTMLAttributes<HTMLElement>
    >;
    return cloneElement(child, {
      ...props,
      role: "button",
      className: cn(className, child.props.className),
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        handleClick();
        child.props.onClick?.(e as React.MouseEvent<HTMLElement>);
      },
    });
  }

  return (
    <button
      className={className}
      onClick={handleClick}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

type FileUploadContentProps = React.HTMLAttributes<HTMLDivElement>;

function FileUploadContent({ className, ...props }: FileUploadContentProps) {
  const context = useContext(FileUploadContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!(context?.isDragging && mounted) || context?.disabled) {
    return null;
  }

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        "fade-in-0 slide-in-from-bottom-10 zoom-in-90 animate-in duration-150",
        className
      )}
      {...props}
    />
  );

  return createPortal(content, document.body);
}

export { FileUpload, FileUploadTrigger, FileUploadContent };

async function countPdfPages(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(new Uint8Array(buffer));
    const matches = text.match(/\/Type\s*\/Page\b/g);
    return matches?.length ?? 0;
  } catch {
    return 0;
  }
}

async function validateFile(
  file: File
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const maxFileBytes = 5 * 1024 * 1024;
  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  if (!(isPdf || isImage)) {
    return { ok: false, reason: "Only images or PDFs are allowed." };
  }
  if (file.size > maxFileBytes) {
    return { ok: false, reason: "File is larger than 5 MB." };
  }
  if (isPdf) {
    const pageCount = await countPdfPages(file);
    if (pageCount === 0) {
      return { ok: false, reason: "Unable to read PDF pages." };
    }
  }
  return { ok: true };
}
