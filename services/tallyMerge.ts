import type { Person } from '../types';
import type { TallyCsvSubmission } from './tallyCsv';
import { normalizePhone } from './documentExtraction';

export interface TallyMergeResult {
  people: Person[];
  created: number;
  updated: number;
}

const normalizeName = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * Collega ogni risposta Tally alla persona giusta della produzione:
 * prima per `mid` (id membro passato nel link), poi per nome. Se non trova
 * nessuno crea un nuovo membro già segnato come consegnato.
 */
export const mergeTallySubmissions = (
  allPeople: Person[],
  submissions: TallyCsvSubmission[],
  productionId: string,
  newId: () => string = () => `per-${crypto.randomUUID()}`,
): TallyMergeResult => {
  const people = allPeople.map(person => ({ ...person }));
  let created = 0;
  let updated = 0;

  for (const submission of submissions) {
    const inProduction = (person: Person) => person.productionId === productionId && !person.removedAt;
    let index = submission.personId
      ? people.findIndex(person => person.id === submission.personId && inProduction(person))
      : -1;
    if (index < 0) {
      index = people.findIndex(person => inProduction(person) && normalizeName(person.name) === normalizeName(submission.name));
    }

    if (index < 0) {
      const canReuseId = Boolean(submission.personId) && !people.some(person => person.id === submission.personId);
      people.push({
        id: canReuseId ? submission.personId : newId(),
        productionId,
        name: submission.name,
        role: submission.role || 'Membro Troupe',
        department: 'Generico',
        whatsapp: normalizePhone(submission.phone),
        deliveredAt: submission.submittedAt,
        fieldsJSON: JSON.stringify(submission.formData),
        hubToken: crypto.randomUUID(),
      });
      created += 1;
    } else {
      const existing = people[index];
      people[index] = {
        ...existing,
        role: existing.role || submission.role || 'Membro Troupe',
        whatsapp: existing.whatsapp || normalizePhone(submission.phone),
        deliveredAt: submission.submittedAt,
        fieldsJSON: JSON.stringify(submission.formData),
      };
      updated += 1;
    }
  }

  return { people, created, updated };
};
