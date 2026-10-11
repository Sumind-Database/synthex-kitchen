create table public.products (
  id text primary key, ord bigserial, name text not null, sku text not null unique,
  category text not null check (category in ('materia','preparacion','venta')),
  unit text not null check (unit in ('kg','l','und')),
  stock numeric not null default 0 check (stock >= 0),
  min numeric not null default 0 check (min >= 0),
  cost numeric not null default 0 check (cost >= 0),
  price numeric, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.recipes (
  id text primary key, ord bigserial, name text not null,
  product_id text not null unique references public.products(id),
  yield numeric not null check (yield > 0),
  created_at timestamptz not null default now()
);
create table public.recipe_ingredients (
  recipe_id text not null references public.recipes(id) on delete cascade,
  product_id text not null references public.products(id),
  position int not null default 0,
  qty numeric not null check (qty > 0),
  unit text not null check (unit in ('kg','g','l','ml','und')),
  primary key (recipe_id, product_id)
);
create table public.production_orders (
  id text primary key, ord bigserial, code text not null unique, date timestamptz not null,
  recipe_id text not null references public.recipes(id),
  qty numeric not null check (qty > 0),
  status text not null check (status in ('borrador','pendiente','en_produccion','completada','cancelada')),
  consumed jsonb, produced numeric, completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.sales (
  id text primary key, ord bigserial, number text not null unique, date timestamptz not null,
  method text not null check (method in ('Efectivo','Tarjeta','Transferencia')),
  status text not null check (status in ('borrador','confirmada','anulada')),
  total numeric not null default 0,
  created_at timestamptz not null default now()
);
create table public.sale_items (
  sale_id text not null references public.sales(id) on delete cascade,
  position int not null,
  product_id text not null references public.products(id),
  name text not null, qty numeric not null check (qty > 0), price numeric not null check (price >= 0),
  primary key (sale_id, position)
);
create table public.movements (
  id uuid primary key default gen_random_uuid(), ord bigserial, date timestamptz not null,
  product_id text not null references public.products(id),
  type text not null check (type in ('entrada','salida','ajuste')),
  qty numeric not null, before numeric not null, after numeric not null check (after >= 0),
  reason text not null,
  ref_type text not null check (ref_type in ('produccion','venta','ajuste','anulacion')),
  ref_id text, ref_code text not null,
  created_at timestamptz not null default now()
);
create unique index movements_once_per_ref on public.movements (ref_type, ref_id, product_id) where ref_id is not null;
create index movements_product_idx on public.movements (product_id);

grant select on public.products, public.recipes, public.recipe_ingredients, public.production_orders, public.sales, public.sale_items, public.movements to anon, authenticated;
grant all on public.products, public.recipes, public.recipe_ingredients, public.production_orders, public.sales, public.sale_items, public.movements to service_role;

alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.production_orders enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.movements enable row level security;

create policy "read products" on public.products for select to anon, authenticated using (true);
create policy "read recipes" on public.recipes for select to anon, authenticated using (true);
create policy "read ingredients" on public.recipe_ingredients for select to anon, authenticated using (true);
create policy "read orders" on public.production_orders for select to anon, authenticated using (true);
create policy "read sales" on public.sales for select to anon, authenticated using (true);
create policy "read sale items" on public.sale_items for select to anon, authenticated using (true);
create policy "read movements" on public.movements for select to anon, authenticated using (true);

create or replace function public.sk_factor(u text) returns numeric language sql immutable set search_path = public as $$
  select case when u in ('g','ml') then 0.001 else 1 end::numeric $$;

create or replace function public.sk_apply(p_deltas jsonb, p_type text, p_reason text, p_ref_type text, p_ref_id text, p_ref_code text, p_date timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare d record; p public.products; v_after numeric;
begin
  for d in select e->>'productId' as pid, round((e->>'qty')::numeric, 4) as q
           from jsonb_array_elements(coalesce(p_deltas, '[]'::jsonb)) with ordinality t(e, n) order by n loop
    select * into p from public.products where id = d.pid for update;
    if not found then raise exception 'Producto inexistente en la operación'; end if;
    v_after := round(p.stock + d.q, 4);
    if v_after < 0 then
      raise exception 'Stock insuficiente de %: faltan % %', p.name, trim(to_char(-v_after, 'FM999999990.###')), p.unit;
    end if;
    update public.products set stock = v_after where id = p.id;
    insert into public.movements(date, product_id, type, qty, before, after, reason, ref_type, ref_id, ref_code)
    values (p_date, p.id, coalesce(p_type, case when d.q >= 0 then 'entrada' else 'salida' end), d.q, p.stock, v_after, p_reason, p_ref_type, p_ref_id, p_ref_code);
  end loop;
exception when unique_violation then
  raise exception 'Esta operación ya descontó inventario; no se aplicó dos veces';
end $$;

create or replace function public.sk_next_adj() returns text language sql set search_path = public as $$
  select 'AJ-' || lpad((coalesce(max(substring(ref_code from 4)::int), 0) + 1)::text, 4, '0')
  from public.movements where ref_code ~ '^AJ-[0-9]+$' $$;

create or replace function public.sk_get_state() returns jsonb language sql stable security definer set search_path = public as $$
select jsonb_build_object(
  'products', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'sku',sku,'category',category,'unit',unit,'stock',stock,'min',min,'cost',cost,'price',price,'active',active) order by ord) from public.products), '[]'),
  'recipes', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'productId',r.product_id,'yield',r.yield,
      'ingredients', coalesce((select jsonb_agg(jsonb_build_object('productId',i.product_id,'qty',i.qty,'unit',i.unit) order by i.position) from public.recipe_ingredients i where i.recipe_id = r.id), '[]')) order by r.ord) from public.recipes r), '[]'),
  'orders', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'code',code,'date',date,'recipeId',recipe_id,'qty',qty,'status',status,'consumed',consumed,'produced',produced,'completedAt',completed_at)) order by ord desc) from public.production_orders), '[]'),
  'sales', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'number',s.number,'date',s.date,'method',s.method,'status',s.status,'total',s.total,
      'items', coalesce((select jsonb_agg(jsonb_build_object('productId',i.product_id,'name',i.name,'qty',i.qty,'price',i.price) order by i.position) from public.sale_items i where i.sale_id = s.id), '[]')) order by s.ord desc) from public.sales s), '[]'),
  'movements', coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',date,'productId',product_id,'type',type,'qty',qty,'before',before,'after',after,'reason',reason,'refType',ref_type,'refId',ref_id,'refCode',ref_code) order by date desc, ord desc) from public.movements), '[]'),
  'seq', jsonb_build_object(
    'order', (select coalesce(max(substring(code from 4)::int), 0) from public.production_orders where code ~ '^OP-[0-9]+$'),
    'sale', (select coalesce(max(substring(number from 3)::int), 0) from public.sales where number ~ '^V-[0-9]+$'),
    'adj', (select coalesce(max(substring(ref_code from 4)::int), 0) from public.movements where ref_code ~ '^AJ-[0-9]+$'))
) $$;

create or replace function public.sk_save_product(p jsonb) returns void language plpgsql security definer set search_path = public as $$
declare v_cur public.products; v_target numeric := coalesce((p->>'stock')::numeric, 0); v_new boolean;
begin
  if coalesce(trim(p->>'name'), '') = '' or coalesce(trim(p->>'sku'), '') = '' then raise exception 'Nombre y SKU son obligatorios'; end if;
  if v_target < 0 then raise exception 'Los valores no pueden ser negativos'; end if;
  if exists (select 1 from public.products where lower(sku) = lower(trim(p->>'sku')) and id <> p->>'id') then raise exception 'Ya existe un producto con ese SKU'; end if;
  select * into v_cur from public.products where id = p->>'id' for update;
  v_new := not found;
  insert into public.products(id, name, sku, category, unit, stock, min, cost, price, active)
  values (p->>'id', trim(p->>'name'), trim(p->>'sku'), p->>'category', p->>'unit', 0, (p->>'min')::numeric, (p->>'cost')::numeric, (p->>'price')::numeric, coalesce((p->>'active')::boolean, true))
  on conflict (id) do update set name = excluded.name, sku = excluded.sku, category = excluded.category, unit = excluded.unit,
    min = excluded.min, cost = excluded.cost, price = excluded.price, active = excluded.active;
  if v_new and v_target > 0 then
    perform public.sk_apply(jsonb_build_array(jsonb_build_object('productId', p->>'id', 'qty', v_target)), 'entrada', 'Stock inicial', 'ajuste', gen_random_uuid()::text, public.sk_next_adj(), now());
  elsif not v_new and v_target <> v_cur.stock then
    perform public.sk_apply(jsonb_build_array(jsonb_build_object('productId', p->>'id', 'qty', v_target - v_cur.stock)), 'ajuste', 'Ajuste desde edición de producto', 'ajuste', gen_random_uuid()::text, public.sk_next_adj(), now());
  end if;
end $$;

create or replace function public.sk_set_product_active(p_id text, p_active boolean) returns void language sql security definer set search_path = public as $$
  update public.products set active = p_active where id = p_id $$;

create or replace function public.sk_delete_product(p_id text) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.movements where product_id = p_id) then raise exception 'No se puede eliminar: tiene movimientos de inventario registrados. Puedes desactivarlo.'; end if;
  if exists (select 1 from public.recipes where product_id = p_id) or exists (select 1 from public.recipe_ingredients where product_id = p_id) then raise exception 'No se puede eliminar: está vinculado a una o más recetas. Puedes desactivarlo.'; end if;
  if exists (select 1 from public.sale_items where product_id = p_id) then raise exception 'No se puede eliminar: aparece en ventas registradas. Puedes desactivarlo.'; end if;
  delete from public.products where id = p_id;
end $$;

create or replace function public.sk_adjust(p_product text, p_type text, p_qty numeric, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare v_stock numeric; v_delta numeric;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'El motivo es obligatorio'; end if;
  select stock into v_stock from public.products where id = p_product for update;
  if not found then raise exception 'Selecciona un producto'; end if;
  if p_type <> 'ajuste' and p_qty <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  if p_type = 'ajuste' and p_qty < 0 then raise exception 'El stock final no puede ser negativo'; end if;
  v_delta := case p_type when 'entrada' then p_qty when 'salida' then -p_qty else p_qty - v_stock end;
  perform public.sk_apply(jsonb_build_array(jsonb_build_object('productId', p_product, 'qty', v_delta)), p_type, trim(p_reason), 'ajuste', gen_random_uuid()::text, public.sk_next_adj(), now());
end $$;

create or replace function public.sk_save_recipe(r jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(r->>'name'), '') = '' then raise exception 'El nombre es obligatorio'; end if;
  if coalesce((r->>'yield')::numeric, 0) <= 0 then raise exception 'El rendimiento debe ser mayor a cero'; end if;
  if jsonb_array_length(coalesce(r->'ingredients', '[]')) = 0 then raise exception 'Agrega al menos un ingrediente'; end if;
  if exists (select 1 from jsonb_array_elements(r->'ingredients') e where e->>'productId' = r->>'productId') then raise exception 'Un producto no puede ser ingrediente de sí mismo'; end if;
  if exists (select 1 from public.recipes where product_id = r->>'productId' and id <> r->>'id') then raise exception 'Ese producto ya tiene una receta'; end if;
  insert into public.recipes(id, name, product_id, yield) values (r->>'id', trim(r->>'name'), r->>'productId', (r->>'yield')::numeric)
  on conflict (id) do update set name = excluded.name, product_id = excluded.product_id, yield = excluded.yield;
  delete from public.recipe_ingredients where recipe_id = r->>'id';
  insert into public.recipe_ingredients(recipe_id, product_id, position, qty, unit)
  select r->>'id', e->>'productId', n, (e->>'qty')::numeric, e->>'unit' from jsonb_array_elements(r->'ingredients') with ordinality t(e, n);
exception when unique_violation then raise exception 'Hay ingredientes duplicados';
end $$;

create or replace function public.sk_delete_recipe(p_id text) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.production_orders where recipe_id = p_id) then raise exception 'La receta tiene órdenes de producción asociadas'; end if;
  delete from public.recipes where id = p_id;
end $$;

create or replace function public.sk_save_order(o jsonb) returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if (o->>'qty')::numeric <= 0 then raise exception 'La cantidad debe ser mayor a cero'; end if;
  if o->>'status' not in ('borrador','pendiente') then raise exception 'Estado inválido'; end if;
  select status into v_status from public.production_orders where id = o->>'id' for update;
  if found then
    if v_status not in ('borrador','pendiente') then raise exception 'Solo se editan órdenes en borrador o pendientes'; end if;
    update public.production_orders set recipe_id = o->>'recipeId', qty = (o->>'qty')::numeric, date = (o->>'date')::timestamptz, status = o->>'status' where id = o->>'id';
  else
    insert into public.production_orders(id, code, date, recipe_id, qty, status)
    values (o->>'id', 'OP-' || lpad((select coalesce(max(substring(code from 4)::int), 0) + 1 from public.production_orders where code ~ '^OP-[0-9]+$')::text, 4, '0'),
            (o->>'date')::timestamptz, o->>'recipeId', (o->>'qty')::numeric, o->>'status');
  end if;
end $$;

create or replace function public.sk_set_order_status(p_id text, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.production_orders where id = p_id for update;
  if not found then raise exception 'Orden no encontrada'; end if;
  if v_status in ('completada','cancelada') then raise exception 'La orden ya está cerrada'; end if;
  if p_status = 'cancelada' and v_status = 'en_produccion' then raise exception 'Solo se cancelan borradores o pendientes'; end if;
  if p_status not in ('pendiente','en_produccion','cancelada') then raise exception 'Estado inválido'; end if;
  update public.production_orders set status = p_status where id = p_id;
end $$;

create or replace function public.sk_complete_order(p_id text, p_at timestamptz default null) returns void language plpgsql security definer set search_path = public as $$
declare o public.production_orders; r public.recipes; v_cons jsonb; v_now timestamptz := coalesce(p_at, now());
begin
  update public.production_orders set status = 'completada', completed_at = v_now
  where id = p_id and status in ('borrador','pendiente','en_produccion') returning * into o;
  if not found then raise exception 'La orden ya fue completada o está cancelada'; end if;
  select * into r from public.recipes where id = o.recipe_id;
  select jsonb_agg(jsonb_build_object('productId', i.product_id, 'qty', -round(i.qty * public.sk_factor(i.unit) * o.qty / r.yield, 4)) order by i.position)
    into v_cons from public.recipe_ingredients i where i.recipe_id = r.id;
  perform public.sk_apply(v_cons, null, 'Consumo producción ' || o.code, 'produccion', o.id, o.code, v_now);
  perform public.sk_apply(jsonb_build_array(jsonb_build_object('productId', r.product_id, 'qty', o.qty)), null, 'Producción terminada ' || o.code, 'produccion', o.id, o.code, v_now);
  update public.production_orders set produced = o.qty,
    consumed = (select jsonb_agg(jsonb_build_object('productId', e->>'productId', 'qty', -(e->>'qty')::numeric)) from jsonb_array_elements(v_cons) e)
  where id = o.id;
end $$;

create or replace function public.sk_delete_order(p_id text) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.production_orders where id = p_id and status = 'borrador';
  if not found then raise exception 'Solo se eliminan órdenes en borrador'; end if;
end $$;

create or replace function public.sk_save_sale(s jsonb, p_confirm boolean) returns void language plpgsql security definer set search_path = public as $$
declare v_status text; v_number text; v_deltas jsonb; v_missing text;
begin
  if jsonb_array_length(coalesce(s->'items', '[]')) = 0 then raise exception 'Agrega al menos un producto'; end if;
  select i->>'name' into v_missing from jsonb_array_elements(s->'items') i
    where not exists (select 1 from public.recipes r where r.product_id = i->>'productId') limit 1;
  if v_missing is not null then raise exception '% no tiene receta definida', v_missing; end if;
  select status, number into v_status, v_number from public.sales where id = s->>'id' for update;
  if found then
    if v_status <> 'borrador' then raise exception 'Solo se editan ventas en borrador'; end if;
    update public.sales set date = (s->>'date')::timestamptz, method = s->>'method' where id = s->>'id';
  else
    v_number := 'V-' || lpad((select coalesce(max(substring(number from 3)::int), 0) + 1 from public.sales where number ~ '^V-[0-9]+$')::text, 5, '0');
    insert into public.sales(id, number, date, method, status, total) values (s->>'id', v_number, (s->>'date')::timestamptz, s->>'method', 'borrador', 0);
  end if;
  delete from public.sale_items where sale_id = s->>'id';
  insert into public.sale_items(sale_id, position, product_id, name, qty, price)
  select s->>'id', n, i->>'productId', i->>'name', (i->>'qty')::numeric, (i->>'price')::numeric from jsonb_array_elements(s->'items') with ordinality t(i, n);
  update public.sales set total = (select coalesce(sum(qty * price), 0) from public.sale_items where sale_id = s->>'id'),
    status = case when p_confirm then 'confirmada' else 'borrador' end where id = s->>'id';
  if p_confirm then
    select jsonb_agg(jsonb_build_object('productId', pid, 'qty', -need)) into v_deltas from (
      select ri.product_id as pid, round(sum(ri.qty * public.sk_factor(ri.unit) * si.qty / r.yield), 4) as need
      from public.sale_items si join public.recipes r on r.product_id = si.product_id join public.recipe_ingredients ri on ri.recipe_id = r.id
      where si.sale_id = s->>'id' group by ri.product_id) x;
    perform public.sk_apply(v_deltas, null, 'Consumo por venta ' || v_number, 'venta', s->>'id', v_number, (s->>'date')::timestamptz);
  end if;
end $$;

create or replace function public.sk_void_sale(p_id text) returns void language plpgsql security definer set search_path = public as $$
declare v public.sales; v_deltas jsonb;
begin
  update public.sales set status = 'anulada' where id = p_id and status = 'confirmada' returning * into v;
  if not found then raise exception 'Solo se anulan ventas confirmadas'; end if;
  select jsonb_agg(jsonb_build_object('productId', product_id, 'qty', -qty) order by ord) into v_deltas
    from public.movements where ref_type = 'venta' and ref_id = p_id;
  perform public.sk_apply(v_deltas, null, 'Anulación de venta ' || v.number, 'anulacion', p_id, v.number, now());
end $$;

create or replace function public.sk_delete_sale(p_id text) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.sales where id = p_id and status = 'borrador';
  if not found then raise exception 'Solo se eliminan ventas no confirmadas'; end if;
end $$;

create or replace function public.sk_reset_demo() returns void language plpgsql security definer set search_path = public as $fn$
declare
  d0 timestamptz := date_trunc('day', now());
  sp jsonb := '[[6,[["margarita",2],["pizzapep",1]],"Efectivo"],[6,[["vegetariana",1]],"Tarjeta"],[5,[["pizzapep",2]],"Transferencia"],[5,[["margarita",1],["vegetariana",1]],"Tarjeta"],[4,[["margarita",3]],"Efectivo"],[3,[["pizzapep",1],["vegetariana",1]],"Tarjeta"],[3,[["margarita",1]],"Efectivo"],[2,[["pizzapep",2],["margarita",1]],"Transferencia"],[1,[["vegetariana",2]],"Tarjeta"],[1,[["margarita",1],["pizzapep",1]],"Efectivo"],[0,[["pizzapep",1],["margarita",1]],"Tarjeta"]]';
  e jsonb; n int := 0;
begin
  delete from public.movements where true; delete from public.sale_items where true; delete from public.sales where true;
  delete from public.production_orders where true; delete from public.recipe_ingredients where true;
  delete from public.recipes where true; delete from public.products where true;
  insert into public.products(id, name, sku, category, unit, min, cost, price) values
    ('harina','Harina de trigo','MP-001','materia','kg',5,4000,null),
    ('queso','Queso mozzarella','MP-002','materia','kg',3,28000,null),
    ('tomate','Salsa de tomate','MP-003','materia','kg',2,9000,null),
    ('pepperoni','Pepperoni','MP-004','materia','kg',1,32000,null),
    ('champ','Champiñones','MP-005','materia','kg',1,14000,null),
    ('aceite','Aceite de oliva','MP-006','materia','l',0.5,25000,null),
    ('masa','Masa de pizza','PR-001','preparacion','und',6,1000,null),
    ('salsa','Salsa preparada','PR-002','preparacion','kg',2,9500,null),
    ('margarita','Pizza Margarita','PV-001','venta','und',0,0,24000),
    ('pizzapep','Pizza Pepperoni','PV-002','venta','und',0,0,32000),
    ('vegetariana','Pizza Vegetariana','PV-003','venta','und',0,0,29000);
  insert into public.recipes(id, name, product_id, yield) values
    ('r-masa','Masa de pizza','masa',4),('r-salsa','Salsa preparada','salsa',1),
    ('r-marg','Pizza Margarita','margarita',1),('r-pep','Pizza Pepperoni','pizzapep',1),('r-veg','Pizza Vegetariana','vegetariana',1);
  insert into public.recipe_ingredients(recipe_id, product_id, position, qty, unit) values
    ('r-masa','harina',1,1,'kg'),('r-masa','aceite',2,20,'ml'),
    ('r-salsa','tomate',1,1,'kg'),('r-salsa','aceite',2,20,'ml'),
    ('r-marg','masa',1,1,'und'),('r-marg','queso',2,150,'g'),('r-marg','salsa',3,100,'g'),
    ('r-pep','masa',1,1,'und'),('r-pep','queso',2,150,'g'),('r-pep','salsa',3,100,'g'),('r-pep','pepperoni',4,50,'g'),
    ('r-veg','masa',1,1,'und'),('r-veg','queso',2,150,'g'),('r-veg','salsa',3,100,'g'),('r-veg','champ',4,80,'g');
  perform public.sk_apply('[{"productId":"harina","qty":30},{"productId":"queso","qty":16},{"productId":"tomate","qty":10},{"productId":"pepperoni","qty":4.8},{"productId":"champ","qty":1.3},{"productId":"aceite","qty":0.66},{"productId":"masa","qty":6},{"productId":"salsa","qty":2}]',
    'entrada', 'Inventario inicial', 'ajuste', 'seed-initial', 'AJ-0001', d0 - interval '8 days' + interval '8 hours');
  perform public.sk_save_order(jsonb_build_object('id','o-seed-1','recipeId','r-masa','qty',20,'status','pendiente','date',d0 - interval '7 days' + interval '9 hours'));
  perform public.sk_complete_order('o-seed-1', d0 - interval '7 days' + interval '10 hours');
  perform public.sk_save_order(jsonb_build_object('id','o-seed-2','recipeId','r-salsa','qty',4,'status','pendiente','date',d0 - interval '7 days' + interval '9 hours'));
  perform public.sk_complete_order('o-seed-2', d0 - interval '7 days' + interval '10 hours');
  perform public.sk_save_order(jsonb_build_object('id','o-seed-3','recipeId','r-masa','qty',8,'status','pendiente','date',d0 - interval '3 days' + interval '9 hours'));
  perform public.sk_complete_order('o-seed-3', d0 - interval '3 days' + interval '10 hours');
  for e in select x from jsonb_array_elements(sp) x loop
    n := n + 1;
    perform public.sk_save_sale(jsonb_build_object('id','s-seed-'||n,'method',e->>2,'date',d0 - make_interval(days => (e->>0)::int) + interval '19 hours',
      'items',(select jsonb_agg(jsonb_build_object('productId',it->>0,'name',p.name,'qty',(it->>1)::numeric,'price',p.price)) from jsonb_array_elements(e->1) it join public.products p on p.id = it->>0)), true);
  end loop;
  perform public.sk_save_order(jsonb_build_object('id','o-seed-4','recipeId','r-salsa','qty',3,'status','pendiente','date',d0 + interval '9 hours'));
  perform public.sk_save_order(jsonb_build_object('id','o-seed-5','recipeId','r-masa','qty',12,'status','borrador','date',d0 + interval '9 hours'));
  perform public.sk_save_sale(jsonb_build_object('id','s-seed-12','method','Efectivo','date',d0 + interval '20 hours',
    'items','[{"productId":"vegetariana","name":"Pizza Vegetariana","qty":1,"price":29000}]'::jsonb), false);
end $fn$;

revoke execute on function public.sk_apply(jsonb, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.sk_next_adj() from public, anon, authenticated;

select public.sk_reset_demo();