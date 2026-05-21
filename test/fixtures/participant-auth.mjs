export const E2E_OTP = process.env.E2E_TEST_OTP?.trim() || "EEEEEE";

export async function signInWithPhone(page, phone) {
  const contact = page.getByTestId("participant-session-contact");
  await contact.waitFor({ state: "visible" });
  await contact.fill(phone);

  const requestResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/registrations/session/request") &&
      res.request().method() === "POST",
  );
  const exchangeResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/registrations/session/exchange") &&
      res.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Send code" }).click();
  const request = await requestResponse;
  if (!request.ok()) {
    throw new Error(
      `Session request failed (${request.status()}): ${await request.text()}`,
    );
  }
  await page.getByTestId("participant-session-code").fill(E2E_OTP);
  await page.getByTestId("participant-session-submit").click();

  const exchange = await exchangeResponse;
  if (!exchange.ok()) {
    throw new Error(
      `Session exchange failed (${exchange.status()}): ${await exchange.text()}`,
    );
  }

  await page.getByText("Welcome back").waitFor({ timeout: 30_000 });
}

export async function completeProfileWithPhone(page, params) {
  await page.getByTestId("participant-profile-given-name").fill(params.givenName);
  await page.getByTestId("participant-profile-family-name").fill(params.familyName);
  await page.getByTestId("participant-profile-phone").fill(params.phone);

  const verifyRequest = page.waitForResponse(
    (res) =>
      res.url().includes("/registrations/profile/verification/request") &&
      res.request().method() === "POST",
  );
  const verifyConfirm = page.waitForResponse(
    (res) =>
      res.url().includes("/registrations/profile/verification/confirm") &&
      res.request().method() === "POST",
  );

  await page.getByTestId("participant-profile-save").click();

  const request = await verifyRequest;
  if (!request.ok()) {
    throw new Error(
      `Profile verification request failed (${request.status()}): ${await request.text()}`,
    );
  }

  await page.getByTestId("participant-profile-verify-code").waitFor({
    timeout: 30_000,
  });
  await page.getByTestId("participant-profile-verify-code").fill(E2E_OTP);
  await page.getByTestId("participant-profile-verify-submit").click();

  const confirm = await verifyConfirm;
  if (!confirm.ok()) {
    throw new Error(
      `Profile verification confirm failed (${confirm.status()}): ${await confirm.text()}`,
    );
  }
}
