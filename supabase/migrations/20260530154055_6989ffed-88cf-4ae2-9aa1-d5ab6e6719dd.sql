UPDATE transactions
SET descricao = replace(descricao, 'CAFÉ ESPECIAL 250G @35.00|c31.99', 'CAFÉ ESPECIAL 250G @35.00|c32.00')
WHERE id = '87f7a584-770f-450d-b9a9-7079862ee96b';

UPDATE stock_movements
SET custo_unitario = 32.00
WHERE id = 'a2c5584e-27c2-4b7d-938f-aadb7090cb40';