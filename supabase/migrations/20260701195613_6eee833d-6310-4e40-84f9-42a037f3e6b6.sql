REVOKE EXECUTE ON FUNCTION public.recover_sale_from_stock_movements(uuid, text, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revert_sales_recovery(uuid) FROM anon, PUBLIC;