-- KMITORA DEV golden target
BEGIN;

CREATE SCHEMA IF NOT EXISTS public;

DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.customers;

CREATE TABLE public.customers (
  customer_id varchar(20) PRIMARY KEY,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(255) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('ACTIVE','INACTIVE')),
  region varchar(30) NOT NULL
);

CREATE TABLE public.orders (
  order_id varchar(20) PRIMARY KEY,
  customer_id varchar(20) NOT NULL REFERENCES public.customers(customer_id),
  order_date date NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('NEW','PAID','SHIPPED','CANCELLED')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0)
);

CREATE TABLE public.order_items (
  item_id varchar(20) PRIMARY KEY,
  order_id varchar(20) NOT NULL REFERENCES public.orders(order_id),
  product_code varchar(50) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0)
);

COMMIT;
