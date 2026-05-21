export function verifyStaffBearer(
  header: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !header?.startsWith("Bearer ")) {
    return false;
  }
  const token = header.slice("Bearer ".length).trim();
  return token === expected;
}
