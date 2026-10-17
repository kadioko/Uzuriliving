-- Earlier demo fixtures had header totals that did not agree with their lines.
-- Reconcile only shops explicitly marked as demos. Real merchant records are untouched.
WITH totals AS (
  SELECT s.id, COALESCE(SUM(i."totalPrice"),0)::INTEGER AS total,
    COALESCE(SUM(i."totalPrice"-i.quantity*i."buyingPrice"),0)::INTEGER AS profit
  FROM sales s JOIN shops sh ON sh.id=s."shopId" AND sh."isDemo"=TRUE
  LEFT JOIN sale_items i ON i."saleId"=s.id GROUP BY s.id
)
UPDATE sales s SET "totalAmount"=t.total,profit=t.profit FROM totals t
WHERE s.id=t.id AND (s."totalAmount" IS DISTINCT FROM t.total OR s.profit IS DISTINCT FROM t.profit);

WITH totals AS (
  SELECT o.id,COALESCE(SUM(i.quantity*i."unitPrice"),0)::INTEGER AS total
  FROM orders o JOIN shops sh ON sh.id=o."shopId" AND sh."isDemo"=TRUE
  LEFT JOIN order_items i ON i."orderId"=o.id GROUP BY o.id
)
UPDATE orders o SET "totalAmount"=t.total FROM totals t
WHERE o.id=t.id AND o."totalAmount" IS DISTINCT FROM t.total;

WITH ledger AS (
  SELECT d.id,d."amountPaid"-COALESCE(SUM(p.amount),0)::INTEGER AS missing
  FROM debts d JOIN shops sh ON sh.id=d."shopId" AND sh."isDemo"=TRUE
  LEFT JOIN debt_payments p ON p."debtId"=d.id GROUP BY d.id
)
INSERT INTO debt_payments(id,"debtId",amount,note)
SELECT gen_random_uuid()::TEXT,id,missing,'Reconciled opening payment in demo data'
FROM ledger WHERE missing>0;
