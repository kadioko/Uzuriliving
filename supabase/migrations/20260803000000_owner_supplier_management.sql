alter table public.shops
  add column if not exists "ownerSupplierManagementEnabled" boolean not null default false;

comment on column public.shops."ownerSupplierManagementEnabled" is
  'Allows the shop owner to add, edit, and verify suppliers. Platform admins control this per shop.';
