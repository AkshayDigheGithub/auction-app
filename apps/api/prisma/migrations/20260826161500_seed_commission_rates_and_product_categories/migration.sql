-- Seed data for monetization v2. Split into its own migration because Postgres
-- will not let a newly-added enum value be used in the same transaction that
-- added it — the ShopCategory values below were added by the previous migration.

-- Commission rates (AUC-51). Rule of thumb: take ~20% of the shop's typical
-- gross margin, never more. Values in basis points and paise.
--
--   category            shop margin   rate    cap      floor
--   mobile_electronics  3-6%          0.60%   Rs 300   Rs 20
--   computers           4-8%          0.60%   Rs 300   Rs 20
--   appliances          5-10%         0.80%   Rs 300   Rs 20
--   hardware            10-15%        1.00%   Rs 300   Rs 20
--   auto_parts          15-25%        1.25%   Rs 300   Rs 20
--   furniture           20-40%        1.50%   Rs 400   Rs 20
--   apparel             30-50%        2.00%   Rs 300   Rs 20
--   jewellery           5-10%         0.30%   Rs 500   Rs 20
--   grocery             small baskets flat Rs 10
INSERT INTO "commission_rates" ("category", "rate_bps", "cap_paise", "floor_paise", "flat_fee_paise", "active", "updated_at") VALUES
  ('mobile_electronics',  60, 30000, 2000, NULL, true, NOW()),
  ('computers',           60, 30000, 2000, NULL, true, NOW()),
  ('appliances',          80, 30000, 2000, NULL, true, NOW()),
  ('hardware',           100, 30000, 2000, NULL, true, NOW()),
  ('auto_parts',         125, 30000, 2000, NULL, true, NOW()),
  ('furniture',          150, 40000, 2000, NULL, true, NOW()),
  ('apparel',            200, 30000, 2000, NULL, true, NOW()),
  ('jewellery',           30, 50000, 2000, NULL, true, NOW()),
  ('grocery',              0,  NULL,    0, 1000, true, NOW())
ON CONFLICT ("category") DO NOTHING;

-- Product categories (AUC-58). The pilot category is seeded thoroughly; the
-- others get a parent row each so matching has something to hang off if the
-- founder ever opens them up. Ids are readable literals rather than cuids so
-- this migration is idempotent and easy to reference.
INSERT INTO "product_categories" ("id", "name", "slug", "parent_id", "shop_categories", "sort_order", "active", "created_at") VALUES
  ('pc_mobile_electronics', 'Mobile & Electronics', 'mobile-electronics', NULL, ARRAY['mobile_electronics']::"ShopCategory"[], 10, true, NOW()),
  ('pc_computers',          'Computers',            'computers',          NULL, ARRAY['computers']::"ShopCategory"[],           20, true, NOW()),
  ('pc_appliances',         'Home Appliances',      'home-appliances',    NULL, ARRAY['appliances']::"ShopCategory"[],          30, true, NOW()),
  ('pc_hardware',           'Hardware & Building',  'hardware-building',  NULL, ARRAY['hardware']::"ShopCategory"[],            40, true, NOW()),
  ('pc_auto_parts',         'Auto Parts',           'auto-parts',         NULL, ARRAY['auto_parts']::"ShopCategory"[],          50, true, NOW()),
  ('pc_furniture',          'Furniture',            'furniture',          NULL, ARRAY['furniture']::"ShopCategory"[],           60, true, NOW()),
  ('pc_apparel',            'Apparel & Footwear',   'apparel-footwear',   NULL, ARRAY['apparel']::"ShopCategory"[],             70, true, NOW()),
  ('pc_jewellery',          'Jewellery',            'jewellery',          NULL, ARRAY['jewellery']::"ShopCategory"[],           80, true, NOW()),
  ('pc_grocery',            'Grocery',              'grocery',            NULL, ARRAY['grocery']::"ShopCategory"[],             90, true, NOW())
ON CONFLICT ("id") DO NOTHING;

-- Children of the pilot category. Electronics shops also stock computer-adjacent
-- items, so laptops/tablets map to both shop categories.
INSERT INTO "product_categories" ("id", "name", "slug", "parent_id", "shop_categories", "sort_order", "active", "created_at") VALUES
  ('pc_smartphones',    'Smartphones',       'smartphones',       'pc_mobile_electronics', ARRAY['mobile_electronics']::"ShopCategory"[],              10, true, NOW()),
  ('pc_feature_phones', 'Feature Phones',    'feature-phones',    'pc_mobile_electronics', ARRAY['mobile_electronics']::"ShopCategory"[],              20, true, NOW()),
  ('pc_tablets',        'Tablets',           'tablets',           'pc_mobile_electronics', ARRAY['mobile_electronics','computers']::"ShopCategory"[],  30, true, NOW()),
  ('pc_smartwatches',   'Smartwatches',      'smartwatches',      'pc_mobile_electronics', ARRAY['mobile_electronics']::"ShopCategory"[],              40, true, NOW()),
  ('pc_audio',          'Headphones & Audio','headphones-audio',  'pc_mobile_electronics', ARRAY['mobile_electronics']::"ShopCategory"[],              50, true, NOW()),
  ('pc_mobile_access',  'Mobile Accessories','mobile-accessories','pc_mobile_electronics', ARRAY['mobile_electronics']::"ShopCategory"[],              60, true, NOW()),
  ('pc_laptops',        'Laptops',           'laptops',           'pc_computers',          ARRAY['computers','mobile_electronics']::"ShopCategory"[],  10, true, NOW()),
  ('pc_desktops',       'Desktops',          'desktops',          'pc_computers',          ARRAY['computers']::"ShopCategory"[],                       20, true, NOW()),
  ('pc_printers',       'Printers',          'printers',          'pc_computers',          ARRAY['computers']::"ShopCategory"[],                       30, true, NOW()),
  ('pc_pc_access',      'Computer Accessories','computer-accessories','pc_computers',      ARRAY['computers']::"ShopCategory"[],                       40, true, NOW())
ON CONFLICT ("id") DO NOTHING;
