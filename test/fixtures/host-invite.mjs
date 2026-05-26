import { expect } from "@playwright/test";

/** Person A (host) sees a guest who paid via the host invite link. */
export async function expectHostInviteConversion(page, seed) {
  const guestName = `${seed.personBGivenName} ${seed.personBFamilyName}`;

  await expect(page.getByText("Bring your friends")).toBeVisible();
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
  if (guest.givenName !== seed.personBGivenName) {
    throw new Error(`Expected givenName ${seed.personBGivenName}, got ${guest.givenName}.`);
  }
  if (guest.familyName !== seed.personBFamilyName) {
    throw new Error(
      `Expected familyName ${seed.personBFamilyName}, got ${guest.familyName}.`,
    );
  }
  if (!guest.tierName?.includes(seed.exclusiveTierName)) {
    throw new Error(`Expected tier to include ${seed.exclusiveTierName}: ${guest.tierName}`);
  }
  if (!guest.tierName?.includes(seed.addonTierName)) {
    throw new Error(`Expected tier to include ${seed.addonTierName}: ${guest.tierName}`);
  }
}
