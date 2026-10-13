DROP POLICY IF EXISTS "read products" ON public.products;
DROP POLICY IF EXISTS "read recipes" ON public.recipes;
DROP POLICY IF EXISTS "read ingredients" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "read orders" ON public.production_orders;
DROP POLICY IF EXISTS "read sales" ON public.sales;
DROP POLICY IF EXISTS "read sale items" ON public.sale_items;
DROP POLICY IF EXISTS "read movements" ON public.movements;

REVOKE SELECT ON public.products, public.recipes, public.recipe_ingredients, public.production_orders, public.sales, public.sale_items, public.movements FROM anon, authenticated;