import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('submitLead', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true })
      }))
    );
    vi.stubGlobal('location', { href: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts FormData to FormSubmit when CONTACT_EMAIL is set', async () => {
    vi.stubEnv('VITE_CONTACT_EMAIL', 'test@example.com');
    vi.stubEnv('VITE_FORMSPREE_WAITLIST', '');
    vi.stubEnv('VITE_FORMSPREE_FEEDBACK', '');

    const { submitLead, isLeadCaptureConfigured } = await import('./leadCapture.js');
    expect(isLeadCaptureConfigured('waitlist')).toBe(true);

    const result = await submitLead('waitlist', {
      email: 'user@example.com',
      name: 'Test User',
      intent: 'updates'
    });

    expect(result.channel).toBe('formsubmit');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('formsubmit.co/ajax/test%40example.com');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.get('email')).toBe('user@example.com');
  });

  it('falls back to mailto when FormSubmit returns 500', async () => {
    vi.stubEnv('VITE_CONTACT_EMAIL', 'test@example.com');
    vi.stubEnv('VITE_FORMSPREE_WAITLIST', '');
    vi.stubEnv('VITE_FORMSPREE_FEEDBACK', '');
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal Server Error' })
    });

    const { submitLead } = await import('./leadCapture.js');
    const result = await submitLead('feedback', {
      email: 'user@example.com',
      message: 'broken export'
    });

    expect(result.channel).toBe('mailto');
    expect(result.warning).toMatch(/Activate|backup/i);
    expect(String(location.href)).toMatch(/^mailto:/);
  });

  it('posts to Formspree when waitlist id is set', async () => {
    vi.stubEnv('VITE_CONTACT_EMAIL', '');
    vi.stubEnv('VITE_FORMSPREE_WAITLIST', 'abcd1234');
    vi.stubEnv('VITE_FORMSPREE_FEEDBACK', '');

    const { submitLead } = await import('./leadCapture.js');
    const result = await submitLead('waitlist', { email: 'a@b.com' });
    expect(result.channel).toBe('formspree');
    expect(fetch.mock.calls[0][0]).toBe('https://formspree.io/f/abcd1234');
  });
});
