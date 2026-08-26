import { computeFee, rupeesToPaise, type FeeRule } from './fee.util';

const electronics: FeeRule = {
  rateBps: 60, // 0.60%
  capPaise: 30_000, // ₹300
  floorPaise: 2_000, // ₹20
  flatFeePaise: null,
};

const grocery: FeeRule = {
  rateBps: 0,
  capPaise: null,
  floorPaise: 0,
  flatFeePaise: 1_000, // ₹10
};

describe('computeFee', () => {
  it('charges the percentage between the floor and the cap', () => {
    // ₹30,000 phone at 0.60% = ₹180
    expect(computeFee(rupeesToPaise(30_000), electronics).amountPaise).toBe(
      18_000,
    );
  });

  it('caps the fee on high-value deals', () => {
    // ₹70,000 at 0.60% would be ₹420, but the cap holds it at ₹300. This cap is
    // the whole reason the pricing is sellable to a shop owner.
    expect(computeFee(rupeesToPaise(70_000), electronics).amountPaise).toBe(
      30_000,
    );
    expect(computeFee(rupeesToPaise(200_000), electronics).amountPaise).toBe(
      30_000,
    );
  });

  it('applies the floor on small deals', () => {
    // ₹1,000 at 0.60% = ₹6, floored up to ₹20.
    expect(computeFee(rupeesToPaise(1_000), electronics).amountPaise).toBe(
      2_000,
    );
  });

  it('never charges more than the deal is worth', () => {
    // A ₹15 sale must not attract the ₹20 floor.
    expect(computeFee(rupeesToPaise(15), electronics).amountPaise).toBe(1_500);
  });

  it('uses the flat fee for flat-fee categories, ignoring rate and cap', () => {
    expect(computeFee(rupeesToPaise(300), grocery).amountPaise).toBe(1_000);
    expect(computeFee(rupeesToPaise(5_000), grocery).amountPaise).toBe(1_000);
  });

  it('clamps a flat fee to the deal value', () => {
    expect(computeFee(rupeesToPaise(4), grocery).amountPaise).toBe(400);
  });

  it('handles a zero-value deal without going negative', () => {
    expect(computeFee(0, electronics).amountPaise).toBe(0);
  });

  it('snapshots the rate and cap it applied', () => {
    const quote = computeFee(rupeesToPaise(50_000), electronics);
    expect(quote.rateBps).toBe(60);
    expect(quote.capPaise).toBe(30_000);
  });

  it('respects an uncapped rule', () => {
    const uncapped: FeeRule = { ...electronics, capPaise: null };
    expect(computeFee(rupeesToPaise(70_000), uncapped).amountPaise).toBe(
      42_000,
    );
  });

  it('rejects invalid input rather than silently charging something wrong', () => {
    expect(() => computeFee(-1, electronics)).toThrow();
    expect(() => computeFee(1.5, electronics)).toThrow();
  });
});

describe('rupeesToPaise', () => {
  it('converts the Decimal strings Prisma returns', () => {
    expect(rupeesToPaise('74999.00')).toBe(7_499_900);
    expect(rupeesToPaise('0.01')).toBe(1);
  });

  it('rounds rather than truncating', () => {
    expect(rupeesToPaise(10.005)).toBe(1001);
  });

  it('rejects nonsense', () => {
    expect(() => rupeesToPaise('abc')).toThrow();
  });
});

describe('the old flat 2% vs the new rates', () => {
  it('is dramatically cheaper for the shop on a high-value phone', () => {
    // This is the deal already in the database: ₹74,999.
    const price = rupeesToPaise(74_999);
    const oldFlatTwoPercent = Math.round((price * 200) / 10_000);
    const now = computeFee(price, electronics).amountPaise;

    expect(oldFlatTwoPercent).toBe(149_998); // ₹1,499.98
    expect(now).toBe(30_000); // ₹300
    expect(now).toBeLessThan(oldFlatTwoPercent / 4);
  });
});
