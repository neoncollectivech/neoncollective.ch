import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  emptyPersonEditForm,
  personEditFormToPayload,
  type PersonEditForm,
} from "@/lib/person-form-utils";
import { PersonEditFormFields } from "@/components/person-edit-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/hooks/use-admin-api";

type AddPersonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddPersonDialog({ open, onOpenChange }: AddPersonDialogProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<PersonEditForm>(emptyPersonEditForm);
  const [markVerified, setMarkVerified] = useState(false);
  const createMutation = useMutation(adminApi.people.create());

  useEffect(() => {
    if (!open) {
      setForm(emptyPersonEditForm());
      setMarkVerified(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add person</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={markVerified}
            id="add-person-mark-verified"
            onCheckedChange={(checked) => setMarkVerified(checked === true)}
          />
          <Label className="font-normal" htmlFor="add-person-mark-verified">
            Mark email/phone as verified
          </Label>
        </div>
        <PersonEditFormFields
          form={form}
          isPending={createMutation.isPending}
          onCancel={() => onOpenChange(false)}
          onChange={setForm}
          onSubmit={() => {
            const payload = personEditFormToPayload(form);

            createMutation.mutate(
              { ...payload, markVerified },
              {
                onSuccess: (person) => {
                  toast.success("Person created");
                  onOpenChange(false);
                  navigate(`/people/${person.id}`);
                },
              },
            );
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
