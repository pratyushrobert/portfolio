import { request } from './client';
import type { Entity } from './types';

export interface Certificate extends Entity {
  name: string;
  issuer: string;
  date: string;
  description: string | null;
  asset_id: string | null;
  link: string | null;
  sort_order: number;
  visibility: boolean;
}

export type CertificateInput = Pick<Certificate, 'name' | 'issuer' | 'date'> & Partial<Omit<Certificate, keyof Entity | 'name' | 'issuer' | 'date'>>;

export const certificatesApi = {
  list: () => request<Certificate[]>('/api/certificates'),
  listAdmin: () => request<Certificate[]>('/api/admin/certificates'),
  create: (body: CertificateInput) => request<Certificate>('/api/admin/certificates', { method: 'POST', body }),
  update: (id: string, body: Partial<CertificateInput>) => request<Certificate>(`/api/admin/certificates/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  remove: (id: string) => request<void>(`/api/admin/certificates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
