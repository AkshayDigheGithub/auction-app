import { UnauthorizedException } from '@nestjs/common';
import { Msg91WidgetService } from './msg91-widget.service';

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () =>
      Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }) as unknown as typeof fetch;
}

describe('Msg91WidgetService.verifyAccessToken', () => {
  let service: Msg91WidgetService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.MSG91_API_KEY = 'test-key';
    service = new Msg91WidgetService();
    jest
      .spyOn(
        (service as unknown as { logger: { error: () => void; warn: () => void } })
          .logger,
        'error',
      )
      .mockImplementation(() => undefined);
    jest
      .spyOn(
        (service as unknown as { logger: { error: () => void; warn: () => void } })
          .logger,
        'warn',
      )
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    delete process.env.MSG91_API_KEY;
  });

  it('returns the verified number in E.164, adding the missing +', async () => {
    // The widget reports identifiers without a leading +; the rest of the app
    // stores E.164, so the boundary has to normalise.
    mockFetch(200, { type: 'success', message: '919876543210' });
    await expect(service.verifyAccessToken('jwt')).resolves.toBe('+919876543210');
  });

  it('reads the number from a nested identifier field too', async () => {
    mockFetch(200, { type: 'success', message: { identifier: '+919876543210' } });
    await expect(service.verifyAccessToken('jwt')).resolves.toBe('+919876543210');
  });

  it('rejects a token MSG91 does not accept', async () => {
    // MSG91 signals failure in the body, not the status code.
    mockFetch(200, { type: 'error', message: 'invalid token' });
    await expect(service.verifyAccessToken('jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('fails closed when the response carries no identifier', async () => {
    // This is the important one. Without an identifier there is nothing tying
    // the token to a phone, so accepting it would mean trusting whatever number
    // the browser claimed — the account takeover this endpoint exists to stop.
    mockFetch(200, { type: 'success', message: 'ok' });
    await expect(service.verifyAccessToken('jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('fails closed on a non-JSON body', async () => {
    mockFetch(200, '<html>gateway error</html>');
    await expect(service.verifyAccessToken('jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sends the token under the hyphenated key MSG91 expects', async () => {
    mockFetch(200, { type: 'success', message: '919876543210' });
    await service.verifyAccessToken('the-jwt');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(JSON.parse(init.body)).toEqual({
      authkey: 'test-key',
      'access-token': 'the-jwt',
    });
  });
});
