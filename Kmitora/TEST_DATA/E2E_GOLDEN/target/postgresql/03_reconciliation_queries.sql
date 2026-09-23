SELECT 'customers' AS entity, COUNT(*) AS row_count FROM public.customers
UNION ALL SELECT 'orders', COUNT(*) FROM public.orders
UNION ALL SELECT 'order_items', COUNT(*) FROM public.order_items;

SELECT COUNT(*) AS orphan_customer_refs
FROM public.orders o LEFT JOIN public.customers c ON c.customer_id=o.customer_id
WHERE c.customer_id IS NULL;

SELECT COUNT(*) AS orphan_order_refs
FROM public.order_items i LEFT JOIN public.orders o ON o.order_id=i.order_id
WHERE o.order_id IS NULL;

SELECT COUNT(*) AS negative_order_amounts FROM public.orders WHERE amount < 0;
SELECT COUNT(*) AS non_positive_item_quantities FROM public.order_items WHERE quantity <= 0;
