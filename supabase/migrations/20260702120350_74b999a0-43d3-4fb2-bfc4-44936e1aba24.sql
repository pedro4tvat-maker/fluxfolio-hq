ALTER FUNCTION public.recover_sale_from_stock_movements(uuid, text, boolean) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.recover_sale_from_stock_movements(uuid, text, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_sale_from_stock_movements(uuid, text, boolean) TO authenticated;