import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PosSaleSuccessStepProps = {
  guestName: string | null;
  tiers: string | null;
  onNewSale: () => void;
};

export function PosSaleSuccessStep({
  guestName,
  tiers,
  onNewSale,
}: PosSaleSuccessStepProps) {
  const body = guestName
    ? `${guestName} — admission updated.`
    : "Admission updated.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sale complete</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{body}</p>
        {tiers ? (
          <p className="text-muted-foreground text-sm">{tiers}</p>
        ) : null}
        <Button className="w-full" type="button" onClick={onNewSale}>
          New sale
        </Button>
      </CardContent>
    </Card>
  );
}
