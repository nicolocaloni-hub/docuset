import type { Person, Production } from '../types';

export const DEFAULT_INVITE_TEMPLATE =
  "Ciao {{nome}}! Compila questi dati per la produzione '{{titolo_produzione}}':\n\n{{link_form}}\n\nI tuoi dati verranno gestiti nella piena sicurezza.";

export const DEFAULT_SOLICIT_TEMPLATE =
  "Ciao {{nome}},\n{{link_form}}\nricordati di firmare i documenti necessari per il set di '{{titolo_produzione}}'.";

export const TEMPLATE_VARIABLES = ['{{nome}}', '{{titolo_produzione}}', '{{link_form}}'] as const;

/** Variabili obbligatorie che mancano nel testo del messaggio. */
export const missingVariables = (text: string) => TEMPLATE_VARIABLES.filter(v => !text.includes(v));

/** Link Tally personale: `pid` e `mid` permettono di ricollegare la risposta alla persona. */
export const buildFormLink = (formLink: string, productionId: string, personId: string) => {
  const separator = formLink.includes('?') ? '&' : '?';
  return `${formLink}${separator}pid=${encodeURIComponent(productionId)}&mid=${encodeURIComponent(personId)}`;
};

export const buildMessage = (
  kind: 'invite' | 'solicit',
  production: Production,
  person: Person,
) => {
  const template = kind === 'invite'
    ? production.whatsappMessageTemplate || DEFAULT_INVITE_TEMPLATE
    : production.whatsappSolicitTemplate || DEFAULT_SOLICIT_TEMPLATE;
  const link = buildFormLink(production.formLink || '', production.id, person.id);
  return template
    .replace(/{{nome}}/g, person.name.split(' ')[0] || '')
    .replace(/{{titolo_produzione}}/g, production.title || '')
    .replace(/{{link_form}}/g, link);
};

export const whatsappUrl = (phone: string, message: string, userAgent: string) => {
  const digits = phone.replace(/[^\d+]/g, '');
  const text = encodeURIComponent(message);
  return /Android/i.test(userAgent)
    ? `intent://send?phone=${digits}&text=${text}#Intent;package=com.whatsapp;scheme=whatsapp;end;`
    : `https://api.whatsapp.com/send?phone=${digits}&text=${text}`;
};
