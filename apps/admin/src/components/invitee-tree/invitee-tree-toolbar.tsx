import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InviteeTreeToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  showRevoked: boolean;
  onShowRevokedChange: (value: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
};

export function InviteeTreeToolbar({
  search,
  onSearchChange,
  showRevoked,
  onShowRevokedChange,
  onExpandAll,
  onCollapseAll,
}: InviteeTreeToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        className="max-w-xs"
        placeholder="Search invitees…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <Button size="sm" type="button" variant="outline" onClick={onExpandAll}>
        Expand all
      </Button>
      <Button size="sm" type="button" variant="outline" onClick={onCollapseAll}>
        Collapse all
      </Button>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={showRevoked}
          id="invitee-tree-show-revoked"
          onCheckedChange={(checked) => onShowRevokedChange(checked === true)}
        />
        <Label htmlFor="invitee-tree-show-revoked">Show revoked</Label>
      </div>
    </div>
  );
}
