import { CatalogService } from './catalog.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ShopCategoryName } from '../pricing/pricing.service';

interface FakeCategory {
  id: string;
  name: string;
  shopCategories: ShopCategoryName[];
  sortOrder: number;
  _count: { requests: number; children: number };
}

interface FakeShop {
  id: string;
  category: ShopCategoryName;
  secondaryCategories: ShopCategoryName[];
}

function makeFakePrisma(categories: FakeCategory[], shops: FakeShop[]) {
  const client = {
    productCategory: { findMany: jest.fn().mockResolvedValue(categories) },
    shop: { findMany: jest.fn().mockResolvedValue(shops) },
  };
  return { db: client } as unknown as PrismaService;
}

/**
 * `shopCount` is what an admin reads before deactivating or remapping a
 * category, so the number has to mean "shops that would actually be matched" —
 * not a sum of per-category tallies.
 */
describe('CatalogService.listAllWithUsage', () => {
  const categories: FakeCategory[] = [
    {
      id: 'pc_tablets',
      name: 'Tablets',
      shopCategories: ['mobile_electronics', 'computers'],
      sortOrder: 30,
      _count: { requests: 0, children: 0 },
    },
    {
      id: 'pc_furniture',
      name: 'Furniture',
      shopCategories: ['furniture'],
      sortOrder: 60,
      _count: { requests: 2, children: 0 },
    },
  ];

  it('counts a shop once even when it serves several of the mapped categories', async () => {
    const shops: FakeShop[] = [
      // Serves both categories Tablets maps to — still one shop.
      {
        id: 'shop_both',
        category: 'mobile_electronics',
        secondaryCategories: ['computers'],
      },
      {
        id: 'shop_mobile',
        category: 'mobile_electronics',
        secondaryCategories: [],
      },
      { id: 'shop_computers', category: 'computers', secondaryCategories: [] },
    ];
    const service = new CatalogService(makeFakePrisma(categories, shops));

    const rows = await service.listAllWithUsage();

    expect(rows.find((r) => r.id === 'pc_tablets')?.shopCount).toBe(3);
  });

  it('counts shops that serve the category only as a secondary', async () => {
    const shops: FakeShop[] = [
      {
        id: 'shop_electronics',
        category: 'mobile_electronics',
        secondaryCategories: ['furniture'],
      },
    ];
    const service = new CatalogService(makeFakePrisma(categories, shops));

    const rows = await service.listAllWithUsage();

    // Multi-category shops take deals outside their primary (AUC-60), so a
    // furniture-secondary shop is genuinely reachable through Furniture.
    expect(rows.find((r) => r.id === 'pc_furniture')?.shopCount).toBe(1);
  });

  it('reports zero for a category no shop serves, and keeps the request counts', async () => {
    const shops: FakeShop[] = [
      { id: 'shop_grocery', category: 'grocery', secondaryCategories: [] },
    ];
    const service = new CatalogService(makeFakePrisma(categories, shops));

    const rows = await service.listAllWithUsage();
    const furniture = rows.find((r) => r.id === 'pc_furniture');

    expect(furniture?.shopCount).toBe(0);
    // The request count still has to survive the mapping — it is the other half
    // of what the admin is shown before making a change.
    expect(furniture?._count.requests).toBe(2);
  });
});
