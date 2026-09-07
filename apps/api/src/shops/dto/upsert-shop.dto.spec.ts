import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertShopDto } from './upsert-shop.dto';

/** A profile that is valid apart from whatever a test overrides. */
function shopPayload(overrides: Record<string, unknown> = {}) {
  return {
    shopName: 'Krishna Mobiles',
    address: '12 MG Road, Bengaluru',
    latitude: 12.9716,
    longitude: 77.5946,
    category: 'mobile_electronics',
    contactPhone: '+919876543210',
    ...overrides,
  };
}

async function check(overrides: Record<string, unknown> = {}) {
  const dto = plainToInstance(UpsertShopDto, shopPayload(overrides));
  const errors = await validate(dto);
  return { dto, errors, failed: errors.map((e) => e.property) };
}

describe('UpsertShopDto.contactPhone (AUC-89)', () => {
  it('accepts a number already in E.164', async () => {
    const { dto, failed } = await check();
    expect(failed).toEqual([]);
    expect(dto.contactPhone).toBe('+919876543210');
  });

  it.each([
    ['bare 10 digits', '9876543210'],
    ['spaced', '+91 98765 43210'],
    ['dashed', '98765-43210'],
    ['country code without +', '919876543210'],
    ['leading zero on the country code', '0919876543210'],
    ['bracketed and spaced', '(+91) 98765 43210'],
  ])('normalises %s to E.164', async (_label, input) => {
    const { dto, failed } = await check({ contactPhone: input });
    expect(failed).toEqual([]);
    expect(dto.contactPhone).toBe('+919876543210');
  });

  it('is required — a shop cannot be onboarded without one', async () => {
    const { failed } = await check({ contactPhone: undefined });
    expect(failed).toContain('contactPhone');
  });

  it.each([
    ['too short', '98765'],
    ['too long', '98765432109876'],
    ['not a number', 'call the shop'],
    ['empty', ''],
    // 1234567890 is not an allocated Indian mobile prefix.
    ['implausible prefix', '1234567890'],
  ])('rejects %s', async (_label, input) => {
    const { failed } = await check({ contactPhone: input });
    expect(failed).toContain('contactPhone');
  });

  it('leaves an unrecognised shape alone for the validator to report', async () => {
    // The transform must not "fix" something it does not understand into a
    // plausible-looking number — a wrong number that validates is worse than
    // a rejection, because nobody finds out until an admin tries to call it.
    const { dto, failed } = await check({ contactPhone: '+1 415 555 0100' });
    expect(dto.contactPhone).toBe('+1 415 555 0100');
    expect(failed).toContain('contactPhone');
  });
});
