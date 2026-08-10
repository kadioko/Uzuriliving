alter table public.expenses
  add column if not exists "paymentMethod" text not null default 'CASH';

create table if not exists public.recurring_expense_templates (
  "id" text primary key,
  "title" text not null,
  "amount" integer not null,
  "category" text not null default 'OTHER',
  "vendor" text,
  "note" text,
  "paymentMethod" text not null default 'CASH',
  "dayOfMonth" integer not null default 1,
  "isActive" boolean not null default true,
  "shopId" text not null references public.shops("id") on delete cascade,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp
);

create index if not exists "recurring_expense_templates_shopId_idx"
  on public.recurring_expense_templates("shopId", "isActive");
