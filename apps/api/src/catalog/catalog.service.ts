import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SHOP_CATEGORIES,
  type ShopCategoryName,
} from '../pricing/pricing.service';

export interface UpsertProductCategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
  shopCategories: ShopCategoryName[];
  sortOrder?: number;
  active?: boolean;
}

/** Product category taxonomy (AUC-58) and its admin CRUD (AUC-72). */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** The customer-facing picker: active categories only, parents with children. */
  async listActiveTree() {
    const rows = await this.prisma.db.productCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const parents = rows.filter((r) => !r.parentId);
    return parents.map((p) => ({
      ...p,
      children: rows.filter((r) => r.parentId === p.id),
    }));
  }

  /** Admin view: everything, with usage counts so nothing is changed blind. */
  async listAllWithUsage() {
    const rows = await this.prisma.db.productCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { requests: true, children: true } } },
    });
    return rows;
  }

  private validateShopCategories(categories: ShopCategoryName[]) {
    if (!categories.length) {
      throw new BadRequestException(
        'A product category must map to at least one shop category',
      );
    }
    const unknown = categories.filter((c) => !SHOP_CATEGORIES.includes(c));
    if (unknown.length) {
      throw new BadRequestException(
        `Unknown shop categories: ${unknown.join(', ')}`,
      );
    }
  }

  async create(input: UpsertProductCategoryInput) {
    this.validateShopCategories(input.shopCategories);
    if (input.parentId) {
      const parent = await this.prisma.db.productCategory.findUnique({
        where: { id: input.parentId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
      if (parent.parentId) {
        throw new BadRequestException(
          'Categories are two levels deep — a child cannot have children',
        );
      }
    }
    return this.prisma.db.productCategory.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        parentId: input.parentId ?? null,
        shopCategories: input.shopCategories,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      },
    });
  }

  async update(id: string, input: Partial<UpsertProductCategoryInput>) {
    const before = await this.prisma.db.productCategory.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Category not found');
    if (input.shopCategories) this.validateShopCategories(input.shopCategories);
    if (input.parentId === id)
      throw new BadRequestException('A category cannot be its own parent');

    const after = await this.prisma.db.productCategory.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.slug != null
          ? { slug: input.slug.trim().toLowerCase() }
          : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.shopCategories
          ? { shopCategories: input.shopCategories }
          : {}),
        ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
        ...(input.active != null ? { active: input.active } : {}),
      },
    });
    return { before, after };
  }

  /**
   * Deactivate rather than delete (AUC-72). A category in use is referenced by
   * historical requests; hard-deleting it would rewrite what customers actually
   * asked for.
   */
  async setActive(id: string, active: boolean) {
    const before = await this.prisma.db.productCategory.findUnique({
      where: { id },
      include: { _count: { select: { requests: true, children: true } } },
    });
    if (!before) throw new NotFoundException('Category not found');

    const after = await this.prisma.db.productCategory.update({
      where: { id },
      data: { active },
    });
    // Deactivating a parent hides its children from the picker too, so take
    // them with it rather than leaving orphans visible.
    if (!active && before._count.children > 0) {
      await this.prisma.db.productCategory.updateMany({
        where: { parentId: id },
        data: { active: false },
      });
    }
    return { before, after };
  }
}
