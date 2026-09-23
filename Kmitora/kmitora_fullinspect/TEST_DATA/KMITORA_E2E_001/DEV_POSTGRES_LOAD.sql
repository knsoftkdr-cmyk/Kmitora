\set ON_ERROR_STOP on

BEGIN;

-- =========================================================
-- KMITORA DEV PHYSICAL TARGET LOAD
-- Migration: DEV-UNIFIED-20260904063105
-- Environment: DEV
-- Production: DISABLED
-- Cutover: DISABLED
-- =========================================================

-- Wave 1: Customers
INSERT INTO public.target_customers
(customer_id, customer_name, status, region, email, balance)
VALUES
(1001, 'ABC Industries',       'A', 'S', 'accounts@abc.com', 125000.00),
(1002, 'XYZ Enterprises',      'A', 'N', 'finance@xyz.com',  238500.00),
(1003, 'Delta Systems',        'I', 'W', 'ops@delta.com',      78000.00),
(1004, 'Nova Retail',          'A', 'E', 'admin@nova.com',    415000.00),
(1005, 'Omega Manufacturing',  'A', 'S', 'finance@omega.com',  92500.00);

-- Wave 2: Orders
INSERT INTO public.target_orders
(order_id, customer_id, order_date, status, amount)
VALUES
(9001, 1001, '2026-08-01', 'PENDING',   12500.00),
(9002, 1002, '2026-08-03', 'COMPLETED', 48000.00),
(9003, 1001, '2026-08-05', 'COMPLETED', 19500.00),
(9004, 1004, '2026-08-09', 'PENDING',   76000.00),
(9005, 1005, '2026-08-10', 'CANCELLED',  8400.00),
(9006, 1002, '2026-08-12', 'PENDING',   22400.00);

-- Wave 3: Payments
INSERT INTO public.target_payments
(payment_id, order_id, payment_date, payment_method, amount, status)
VALUES
('P001', 9001, '2026-08-01', 'BANK_TRANSFER', 12500.00, 'PAID'),
('P002', 9002, '2026-08-03', 'CARD',          48000.00, 'PAID'),
('P003', 9003, '2026-08-05', 'UPI',           19500.00, 'PAID'),
('P004', 9004, '2026-08-09', 'BANK_TRANSFER', 30000.00, 'PARTIAL'),
('P005', 9006, '2026-08-12', 'CARD',          22400.00, 'PAID');

-- =========================================================
-- GOVERNED VALIDATION BEFORE COMMIT
-- =========================================================

DO $$
DECLARE
    customer_count integer;
    order_count integer;
    payment_count integer;
    orphan_orders integer;
    orphan_payments integer;
BEGIN
    SELECT COUNT(*) INTO customer_count
    FROM public.target_customers;

    SELECT COUNT(*) INTO order_count
    FROM public.target_orders;

    SELECT COUNT(*) INTO payment_count
    FROM public.target_payments;

    SELECT COUNT(*) INTO orphan_orders
    FROM public.target_orders o
    LEFT JOIN public.target_customers c
      ON c.customer_id = o.customer_id
    WHERE c.customer_id IS NULL;

    SELECT COUNT(*) INTO orphan_payments
    FROM public.target_payments p
    LEFT JOIN public.target_orders o
      ON o.order_id = p.order_id
    WHERE o.order_id IS NULL;

    IF customer_count <> 5 THEN
        RAISE EXCEPTION 'Customer count mismatch: %', customer_count;
    END IF;

    IF order_count <> 6 THEN
        RAISE EXCEPTION 'Order count mismatch: %', order_count;
    END IF;

    IF payment_count <> 5 THEN
        RAISE EXCEPTION 'Payment count mismatch: %', payment_count;
    END IF;

    IF orphan_orders <> 0 THEN
        RAISE EXCEPTION 'Order FK validation failed: % orphan rows', orphan_orders;
    END IF;

    IF orphan_payments <> 0 THEN
        RAISE EXCEPTION 'Payment FK validation failed: % orphan rows', orphan_payments;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.target_customers
        WHERE status NOT IN ('A','I')
           OR region NOT IN ('S','N','E','W')
           OR email <> lower(email)
           OR balance < 0
    ) THEN
        RAISE EXCEPTION 'Customer transformation validation failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.target_orders
        WHERE status NOT IN ('PENDING','COMPLETED','CANCELLED')
           OR amount <= 0
    ) THEN
        RAISE EXCEPTION 'Order transformation validation failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.target_payments
        WHERE amount <= 0
    ) THEN
        RAISE EXCEPTION 'Payment validation failed';
    END IF;
END
$$;

COMMIT;

-- =========================================================
-- POST-COMMIT EVIDENCE
-- =========================================================

SELECT 'target_customers' AS table_name, COUNT(*) AS row_count
FROM public.target_customers
UNION ALL
SELECT 'target_orders', COUNT(*)
FROM public.target_orders
UNION ALL
SELECT 'target_payments', COUNT(*)
FROM public.target_payments;

SELECT customer_id, customer_name, status, region, email, balance
FROM public.target_customers
ORDER BY customer_id;

SELECT order_id, customer_id, order_date, status, amount
FROM public.target_orders
ORDER BY order_id;

SELECT payment_id, order_id, payment_date, payment_method, amount, status
FROM public.target_payments
ORDER BY payment_id;
