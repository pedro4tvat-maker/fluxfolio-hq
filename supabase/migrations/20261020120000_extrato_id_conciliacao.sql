-- Conciliação bancária – etapa 1
-- Guarda o identificador único que o banco dá a cada transação do extrato (FITID do OFX).
-- Com ele, o mesmo extrato (ou extratos com períodos sobrepostos) nunca é importado duas vezes.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS extrato_id text;

COMMENT ON COLUMN public.transactions.extrato_id IS
  'Identificador da transação no extrato do banco (FITID do OFX). Único por empresa e conta.';

-- Recupera o FITID dos extratos OFX já importados (estava gravado em observacoes como "Doc: <FITID>").
-- Se o mesmo FITID aparecer mais de uma vez (importação repetida no passado), só o lançamento mais antigo recebe o código.
WITH candidatos AS (
  SELECT t.id,
         substring(t.observacoes FROM '^Doc: (.+)$') AS fitid,
         row_number() OVER (
           PARTITION BY t.company_id, t.conta_id, substring(t.observacoes FROM '^Doc: (.+)$')
           ORDER BY t.created_at, t.id
         ) AS ordem
  FROM public.transactions t
  JOIN public.import_batches b ON b.id = t.import_batch_id
  WHERE lower(b.file_format) = 'ofx'
    AND t.deleted_at IS NULL
    AND t.extrato_id IS NULL
    AND t.conta_id IS NOT NULL
    AND t.observacoes ~ '^Doc: .+$'
)
UPDATE public.transactions t
SET extrato_id = c.fitid
FROM candidatos c
WHERE t.id = c.id AND c.ordem = 1;

-- Um mesmo código do banco só pode existir uma vez por empresa e conta (lançamentos ativos).
CREATE UNIQUE INDEX IF NOT EXISTS ux_transactions_extrato_id
  ON public.transactions (company_id, conta_id, extrato_id)
  WHERE extrato_id IS NOT NULL AND deleted_at IS NULL;
