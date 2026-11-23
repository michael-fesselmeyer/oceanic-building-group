// The facts beside the About page headline, from the business facts in
// src/lib/site.ts. A fact that is not known yet is left out.
import type { SiteFacts } from './site';

export interface AboutFact {
  label: string;
  value: string;
}

export function aboutFacts(
  site: Pick<SiteFacts, 'address' | 'serviceArea' | 'principalsExperienceYears'>,
): AboutFact[] {
  const facts: AboutFact[] = [
    { label: 'Office', value: `${site.address.city}, ${site.address.region}` },
    { label: 'Serving', value: site.serviceArea },
  ];
  const years = site.principalsExperienceYears;
  if (years) facts.push({ label: 'Principals’ experience', value: `${years}+ years` });
  return facts;
}
