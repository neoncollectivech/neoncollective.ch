import { QRCodeSVG } from "qrcode.react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AdmissionQrDisplayProps = {
  guestName: string | null;
  tiers: string | null;
  signedCredential: string;
};

export function AdmissionQrDisplay({
  guestName,
  tiers,
  signedCredential,
}: AdmissionQrDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Admission ready</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {guestName ? <p className="font-medium">{guestName}</p> : null}
        {tiers ? (
          <p className="text-muted-foreground text-center text-sm">{tiers}</p>
        ) : null}
        <div className="rounded-lg bg-white p-4">
          <QRCodeSVG level="M" size={220} value={signedCredential} />
        </div>
        <p className="text-muted-foreground text-center text-xs">
          Guest can scan this QR at check-in, or use their existing admission
          pass.
        </p>
        <Button asChild className="w-full" variant="outline">
          <Link to="/">Go to scan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
