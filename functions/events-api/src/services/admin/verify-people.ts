import { peopleService } from "../people.service";

export type VerifyPeopleSummary = {
  updated: number;
  skipped: number;
  notFound: number;
};

/** Admin: mark present email/phone channels as verified (no OTP). */
export async function verifyPeopleBulk(personIds: string[]): Promise<VerifyPeopleSummary> {
  return peopleService.verifyPeopleBulk(personIds);
}
