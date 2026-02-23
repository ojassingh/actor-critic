"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConfirmDeleteDialogProps {
  description?: string;
  disabled?: boolean;
  onConfirm: () => void;
  title?: string;
}

export function ConfirmDeleteDialog({
  disabled = false,
  description = "Are you sure you want to delete this?",
  onConfirm,
  title = "Delete document?",
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-label="Delete document"
          disabled={disabled}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X />
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              disabled={disabled}
              onClick={onConfirm}
              type="button"
              variant="destructive"
            >
              <Trash2 />
              Delete
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
