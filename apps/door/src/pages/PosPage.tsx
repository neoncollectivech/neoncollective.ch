import { useMutation, useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DoorModeShell } from "@/components/layout/DoorModeShell";
import { AdmissionQrDisplay } from "@/components/pos/AdmissionQrDisplay";
import {
  GuestContactForm,
  type GuestContactValues,
} from "@/components/pos/GuestContactForm";
import { GuestPeopleSearch } from "@/components/pos/GuestPeopleSearch";
import { GuestLookupScanner } from "@/components/pos/GuestLookupScanner";
import { ReaderSelect } from "@/components/pos/ReaderSelect";
import { SoloPaymentStep } from "@/components/pos/SoloPaymentStep";
import { TierPicker } from "@/components/pos/TierPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { posApi } from "@/hooks/use-pos-api/api";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  fetchPosSaleStatus,
  type PosPersonSearchRow,
  type PosResolvedGuest,
  type PosTier,
} from "@/lib/pos-api";
import {
  clearDoorSessionConfig,
  getDoorSessionConfig,
} from "@/lib/storage/session-config";

type SaleMode = "new" | "addon";

type PosStep = "reader" | "mode" | "guest" | "tiers" | "payment" | "success";

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function personToGuestContact(person: PosPersonSearchRow): GuestContactValues {
  return {
    givenName: person.givenName,
    familyName: person.familyName,
    email: person.email ?? "",
    phoneE164: person.phone
      ? person.phone.startsWith("+")
        ? person.phone
        : `+${person.phone}`
      : "",
  };
}

export function PosPage() {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const session = getDoorSessionConfig();

  const [step, setStep] = useState<PosStep>(
    session?.readerId ? "mode" : "reader",
  );
  const [saleMode, setSaleMode] = useState<SaleMode>("new");
  const [guest, setGuest] = useState<PosResolvedGuest | null>(null);
  const [guestContact, setGuestContact] = useState<GuestContactValues | null>(
    null,
  );
  const [credential, setCredential] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [exclusiveTierId, setExclusiveTierId] = useState("");
  const [addonTierIds, setAddonTierIds] = useState<string[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentAmountCents, setPaymentAmountCents] = useState(0);
  const [paymentCurrency, setPaymentCurrency] = useState("CHF");
  const [successCredential, setSuccessCredential] = useState<string | null>(
    null,
  );
  const [successGuestName, setSuccessGuestName] = useState<string | null>(null);
  const [successTiers, setSuccessTiers] = useState<string | null>(null);

  const catalogQuery = useQuery({
    ...posApi.catalog.detail(),
    enabled: step !== "reader",
  });
  const guestMutation = useMutation(posApi.guest.resolve());
  const saleMutation = useMutation(posApi.sale.create());

  const pricingParams = useMemo(
    () => ({ exclusiveTierId, addonTierIds }),
    [exclusiveTierId, addonTierIds],
  );
  const pricingQuery = useQuery({
    ...posApi.pricing.preview(pricingParams),
    enabled:
      step === "tiers" && (Boolean(exclusiveTierId) || addonTierIds.length > 0),
  });

  const pickerTiers: PosTier[] = useMemo(() => {
    if (!catalogQuery.data) {
      return [];
    }
    if (saleMode === "addon" && guest) {
      return guest.availableUpsellTiers;
    }

    return catalogQuery.data.tiers;
  }, [catalogQuery.data, guest, saleMode]);

  const resetFlow = () => {
    setStep(session?.readerId ? "mode" : "reader");
    setSaleMode("new");
    setGuest(null);
    setGuestContact(null);
    setCredential(null);
    setScanning(false);
    setExclusiveTierId("");
    setAddonTierIds([]);
    setOrderId(null);
    setPaymentAmountCents(0);
    setPaymentCurrency("CHF");
    setSuccessCredential(null);
    setSuccessGuestName(null);
    setSuccessTiers(null);
  };

  const handleSignOut = () => {
    clearDoorSessionConfig();
    navigate("/setup", { replace: true });
  };

  const selectPersonFromSearch = async (person: PosPersonSearchRow) => {
    try {
      const resolved = await guestMutation.mutateAsync({ personId: person.id });

      if (saleMode === "addon" && !resolved.hasPaidExclusive) {
        toast.error("Guest has no existing admission for this event.");

        return;
      }
      if (saleMode === "new" && resolved.hasPaidExclusive) {
        toast.error("Guest already has admission. Use add-ons instead.");

        return;
      }

      setGuest(resolved);
      setGuestContact(personToGuestContact(person));
      setCredential(null);
      setExclusiveTierId("");
      setAddonTierIds([]);
      setStep("tiers");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load person."));
    }
  };

  const startSale = async () => {
    if (!session?.readerId) {
      setStep("reader");

      return;
    }

    const body = {
      readerId: session.readerId,
      locale: "en" as const,
      exclusiveTierId: saleMode === "addon" ? "" : exclusiveTierId,
      addonTierIds,
      personId: guest?.personId ?? null,
      credential,
      email: guestContact?.email || null,
      phoneE164: guestContact?.phoneE164 || null,
      givenName:
        guestContact?.givenName || guest?.guestName.split(" ")[0] || null,
      familyName:
        guestContact?.familyName ||
        guest?.guestName.split(" ").slice(1).join(" ") ||
        null,
    };

    try {
      const result = await saleMutation.mutateAsync(body);

      if (!result.requiresPayment) {
        const status = await fetchPosSaleStatus(result.orderId);

        if (status.signedCredential) {
          setSuccessCredential(status.signedCredential);
          setSuccessGuestName(status.guestName);
          setSuccessTiers(status.tiers);
          setStep("success");

          return;
        }
      }
      setOrderId(result.orderId);
      setPaymentAmountCents(result.amountCents);
      setPaymentCurrency(pricingQuery.data?.currency ?? "CHF");
      setStep("payment");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not start sale."));
    }
  };

  return (
    <DoorModeShell>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="border-border/60 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-wide">NEON POS</h1>
            {session?.eventTitle ? (
              <p className="truncate text-xs text-muted-foreground">
                {session.eventTitle}
              </p>
            ) : null}
            {!online ? (
              <p className="text-xs text-amber-500">
                Offline — POS requires network
              </p>
            ) : null}
          </div>
          <Button
            aria-label="Sign out"
            size="icon"
            variant="ghost"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex w-full max-w-md flex-col gap-4">
            {step === "reader" ? (
              <ReaderSelect
                onReaderRemoved={() => {
                  setStep("reader");
                }}
                onSelected={() => {
                  setStep("mode");
                }}
              />
            ) : null}

            {step === "mode" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sale type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    className="w-full"
                    type="button"
                    variant={saleMode === "new" ? "default" : "outline"}
                    onClick={() => {
                      setSaleMode("new");
                      setGuest(null);
                      setCredential(null);
                      setStep("guest");
                    }}
                  >
                    New admission
                  </Button>
                  <Button
                    className="w-full"
                    type="button"
                    variant={saleMode === "addon" ? "default" : "outline"}
                    onClick={() => {
                      setSaleMode("addon");
                      setGuestContact(null);
                      setStep("guest");
                    }}
                  >
                    Add-ons for existing guest
                  </Button>
                  <Button
                    className="w-full"
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("reader")}
                  >
                    Change Solo reader
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {step === "guest" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {saleMode === "new" ? "Guest details" : "Find guest"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <GuestPeopleSearch
                    disabled={guestMutation.isPending}
                    onSelect={(person) => void selectPersonFromSearch(person)}
                  />
                  {saleMode === "addon" ? (
                    <>
                      {scanning ? (
                        <GuestLookupScanner
                          onClose={() => setScanning(false)}
                          onCredential={async (value) => {
                            setScanning(false);
                            setCredential(value);
                            try {
                              const resolved = await guestMutation.mutateAsync({
                                credential: value,
                              });

                              setGuest(resolved);
                              setExclusiveTierId("");
                              setAddonTierIds([]);
                              setStep("tiers");
                            } catch (error) {
                              toast.error(
                                getApiErrorMessage(error, "Guest not found."),
                              );
                            }
                          }}
                        />
                      ) : (
                        <Button
                          className="w-full"
                          type="button"
                          variant="outline"
                          onClick={() => setScanning(true)}
                        >
                          Scan admission QR
                        </Button>
                      )}
                      <GuestContactForm
                        disabled={guestMutation.isPending}
                        onSubmit={async (values) => {
                          setGuestContact(values);
                          try {
                            const resolved = await guestMutation.mutateAsync({
                              email: values.email || null,
                              phoneE164: values.phoneE164 || null,
                              givenName: values.givenName,
                              familyName: values.familyName,
                            });

                            if (!resolved.hasPaidExclusive) {
                              toast.error(
                                "Guest has no existing admission for this event.",
                              );

                              return;
                            }
                            setGuest(resolved);
                            setCredential(null);
                            setExclusiveTierId("");
                            setAddonTierIds([]);
                            setStep("tiers");
                          } catch (error) {
                            toast.error(
                              getApiErrorMessage(error, "Guest not found."),
                            );
                          }
                        }}
                      />
                      <div aria-hidden className="border-border/60 border-t" />
                    </>
                  ) : (
                    <>
                      <div aria-hidden className="border-border/60 border-t" />
                      <GuestContactForm
                        disabled={guestMutation.isPending}
                        onSubmit={(values) => {
                          setGuestContact(values);
                          setGuest(null);
                          setCredential(null);
                          setExclusiveTierId("");
                          setAddonTierIds([]);
                          setStep("tiers");
                        }}
                      />
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("mode")}
                  >
                    Back
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {step === "tiers" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select tiers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {guest ? (
                    <p className="text-sm">
                      Guest:{" "}
                      <span className="font-medium">{guest.guestName}</span>
                    </p>
                  ) : null}
                  {catalogQuery.isLoading ? (
                    <p className="text-muted-foreground text-sm">
                      Loading tiers…
                    </p>
                  ) : (
                    <TierPicker
                      addonOnly={saleMode === "addon"}
                      addonTierIds={addonTierIds}
                      exclusiveTierId={exclusiveTierId}
                      tiers={pickerTiers}
                      onAddonToggle={(tierId) => {
                        setAddonTierIds((current) =>
                          current.includes(tierId)
                            ? current.filter((id) => id !== tierId)
                            : [...current, tierId],
                        );
                      }}
                      onExclusiveChange={setExclusiveTierId}
                    />
                  )}
                  {pricingQuery.data ? (
                    <p className="text-lg font-semibold tabular-nums">
                      Total:{" "}
                      {formatPrice(
                        pricingQuery.data.amountCents,
                        pricingQuery.data.currency,
                      )}
                    </p>
                  ) : null}
                  <Button
                    className="w-full"
                    disabled={
                      saleMutation.isPending ||
                      !online ||
                      (saleMode === "new"
                        ? !exclusiveTierId
                        : addonTierIds.length === 0)
                    }
                    type="button"
                    onClick={() => void startSale()}
                  >
                    Charge on Solo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("guest")}
                  >
                    Back
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {step === "payment" && orderId ? (
              <SoloPaymentStep
                amountCents={paymentAmountCents}
                currency={paymentCurrency}
                orderId={orderId}
                readerName={session?.readerName ?? null}
                onCancelled={() => {
                  setOrderId(null);
                  setStep("tiers");
                }}
                onPaid={(signedCredential, guestName, tiers) => {
                  setSuccessCredential(signedCredential);
                  setSuccessGuestName(guestName);
                  setSuccessTiers(tiers);
                  setStep("success");
                }}
              />
            ) : null}

            {step === "success" && successCredential ? (
              <>
                <AdmissionQrDisplay
                  guestName={successGuestName}
                  signedCredential={successCredential}
                  tiers={successTiers}
                />
                <Button className="w-full" type="button" onClick={resetFlow}>
                  New sale
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </DoorModeShell>
  );
}
