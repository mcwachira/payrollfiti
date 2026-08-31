export const COUNTRY_NAMES: Record<string, string> = {
  KE: 'Kenya',
  NG: 'Nigeria',
  ZA: 'South Africa',
};

export function getCountryName(countryCode: string): string {
  return COUNTRY_NAMES[countryCode] ?? countryCode;
}
