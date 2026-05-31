import { expect } from "@playwright/test";

/** Person A (host) sees a guest who paid via the host invite link. */
export async function expectHostInviteConversion(page, seed) {
  const guestName = `${seed.guestInvited.givenName} ${seed.guestInvited.familyName}`;

  await expect(page.getByText("Invite someone from your circle")).toBeVisible();
  await expect(
    page.getByText("Registered via your link", { exact: true }),
  ).toBeVisible();
  const conversions = page.getByTestId("host-invite-conversions");
  await expect(conversions).toBeVisible();
  await expect(conversions.getByText(guestName)).toBeVisible();
  await expect(conversions.getByText(seed.guestTierLine)).toBeVisible();
}

export function expectHostInviteConversionApi(detail, seed) {
  const conversions = detail.hostInvite?.conversions ?? [];
  if (conversions.length !== 1) {
    throw new Error(
      `Expected 1 host invite conversion, got ${conversions.length}.`,
    );
  }
  const guest = conversions[0];
  if (guest.givenName !== seed.guestInvited.givenName) {
    throw new Error(
      `Expected givenName ${seed.guestInvited.givenName}, got ${guest.givenName}.`,
    );
  }
  if (guest.familyName !== seed.guestInvited.familyName) {
    throw new Error(
      `Expected familyName ${seed.guestInvited.familyName}, got ${guest.familyName}.`,
    );
  }
  if (!guest.tierName?.includes(seed.exclusiveTierName)) {
    throw new Error(`Expected tier to include ${seed.exclusiveTierName}: ${guest.tierName}`);
  }
  if (!guest.tierName?.includes(seed.addonTierName)) {
    throw new Error(`Expected tier to include ${seed.addonTierName}: ${guest.tierName}`);
  }
}
