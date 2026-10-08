import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { closeDatabase, initializeDatabase } from '../db/index.js';
import { loadTestConfig } from './test-app.js';

describe('portfolio integration lifecycle', () => {
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof initializeDatabase>>;
  let cookie = '';
  const config = loadTestConfig();

  beforeAll(async () => {
    database = await initializeDatabase(config);
    app = await buildApp({ database, config });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    cookie = String(login.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
    await closeDatabase(database);
  });

  it('serves empty collections gracefully on initial state', async () => {
    const projectsRes = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(projectsRes.statusCode).toBe(200);
    expect(projectsRes.json().success).toBe(true);
    expect(projectsRes.json().data).toEqual([]);

    const skillsRes = await app.inject({ method: 'GET', url: '/api/skills' });
    expect(skillsRes.statusCode).toBe(200);
    expect(skillsRes.json().success).toBe(true);
    expect(skillsRes.json().data).toEqual([]);

    const expRes = await app.inject({ method: 'GET', url: '/api/experience' });
    expect(expRes.statusCode).toBe(200);
    expect(expRes.json().success).toBe(true);
    expect(expRes.json().data).toEqual([]);

    const certRes = await app.inject({ method: 'GET', url: '/api/certificates' });
    expect(certRes.statusCode).toBe(200);
    expect(certRes.json().success).toBe(true);
    expect(certRes.json().data).toEqual([]);

    const configRes = await app.inject({ method: 'GET', url: '/api/config' });
    expect(configRes.statusCode).toBe(200);
    expect(configRes.json().success).toBe(true);
    expect(typeof configRes.json().data).toBe('object');
  });

  it('creates, reads, and hides projects with GitHub metadata', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/projects',
      headers: { cookie },
      payload: {
        name: 'SecureVault',
        description: 'Zero-knowledge encryption vault',
        long_description: 'Full markdown documentation of the vault system.',
        technologies: ['TypeScript', 'Cryptography', 'React'],
        github_repo: 'pratyushrobert/SecureVault',
        github_url: 'https://github.com/pratyushrobert/SecureVault',
        live_url: 'https://securevault.example.com',
        visibility: 'public',
        featured: true,
        sort_order: 1,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const project = createRes.json().data;
    expect(project.name).toBe('SecureVault');
    expect(project.github_repo).toBe('pratyushrobert/SecureVault');
    expect(project.featured).toBe(true);

    // Public list contains it
    const publicList = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(publicList.statusCode).toBe(200);
    const items = publicList.json().data;
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('SecureVault');
    expect(items[0].technologies).toEqual(['TypeScript', 'Cryptography', 'React']);

    // Single public get
    const singleRes = await app.inject({ method: 'GET', url: `/api/projects/${project.id}` });
    expect(singleRes.statusCode).toBe(200);
    expect(singleRes.json().data.name).toBe('SecureVault');

    // Hide project
    const hideRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/projects/${project.id}`,
      headers: { cookie },
      payload: { visibility: 'hidden' },
    });
    expect(hideRes.statusCode).toBe(200);

    // Public list is now empty
    const hiddenList = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(hiddenList.json().data).toHaveLength(0);

    // Re-publish
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/projects/${project.id}`,
      headers: { cookie },
      payload: { visibility: 'public' },
    });
  });

  it('creates, reads, and manages skills by category and visibility', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/skills',
      headers: { cookie },
      payload: {
        name: 'TypeScript',
        category: 'programming',
        level: 'expert',
        sort_order: 1,
        visibility: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const skill = createRes.json().data;
    expect(skill.name).toBe('TypeScript');
    expect(skill.category).toBe('programming');
    expect(skill.level).toBe('expert');

    // Public list
    const publicList = await app.inject({ method: 'GET', url: '/api/skills' });
    expect(publicList.statusCode).toBe(200);
    expect(publicList.json().data).toHaveLength(1);
    expect(publicList.json().data[0].name).toBe('TypeScript');

    // Hide skill
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/skills/${skill.id}`,
      headers: { cookie },
      payload: { visibility: false },
    });

    const hiddenList = await app.inject({ method: 'GET', url: '/api/skills' });
    expect(hiddenList.json().data).toHaveLength(0);
  });

  it('creates, reads, and manages experience timeline', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/experience',
      headers: { cookie },
      payload: {
        organization: 'Acme Corp',
        role: 'Senior Systems Architect',
        start_date: '2023-01-01',
        end_date: null,
        description: 'Architecting distributed infrastructure and microservices.',
        technologies: ['Go', 'Docker', 'Kubernetes'],
        link: 'https://acme.example.com',
        sort_order: 1,
        visibility: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const exp = createRes.json().data;
    expect(exp.organization).toBe('Acme Corp');
    expect(exp.role).toBe('Senior Systems Architect');

    // Public list
    const publicList = await app.inject({ method: 'GET', url: '/api/experience' });
    expect(publicList.statusCode).toBe(200);
    expect(publicList.json().data).toHaveLength(1);
    expect(publicList.json().data[0].organization).toBe('Acme Corp');
    expect(publicList.json().data[0].technologies).toEqual(['Go', 'Docker', 'Kubernetes']);
  });

  it('creates, reads, and manages certificates', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/certificates',
      headers: { cookie },
      payload: {
        name: 'Certified Kubernetes Administrator (CKA)',
        issuer: 'CNCF / Linux Foundation',
        date: '2024-05-15',
        description: 'Demonstrated competence in Kubernetes container management.',
        link: 'https://cncf.io/verify/12345',
        sort_order: 1,
        visibility: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const cert = createRes.json().data;
    expect(cert.name).toBe('Certified Kubernetes Administrator (CKA)');

    // Public list
    const publicList = await app.inject({ method: 'GET', url: '/api/certificates' });
    expect(publicList.statusCode).toBe(200);
    expect(publicList.json().data).toHaveLength(1);
    expect(publicList.json().data[0].name).toBe('Certified Kubernetes Administrator (CKA)');
  });

  it('updates and serves portfolio content (about/contact notes)', async () => {
    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/api/admin/portfolio',
      headers: { cookie },
      payload: {
        key: 'about',
        content: '# Pratyush Robert\n\nFull-stack engineer and security researcher.',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().data.key).toBe('about');

    const getRes = await app.inject({ method: 'GET', url: '/api/portfolio/about' });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.content).toContain('Pratyush Robert');
  });
});
