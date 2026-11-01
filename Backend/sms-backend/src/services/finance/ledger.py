"""Fee arithmetic (phase5-design.md §2), with no database access.

- owed = invoice lines - adjustments; paid = allocations of payments that are not void;
  balance = owed - paid. Every amount is per currency: USD and LRD are never added together.
- A currency is "on" an invoice only when every line has an amount in it.
- Before the account's currency is locked (first payment), bills show both currencies.
- Overdue: for each installment whose due date has passed (due_date < today), the cumulative
  share of the invoice due by then, minus what has been paid against the invoice.
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

CURRENCIES = ("USD", "LRD")
ZERO = Decimal("0.00")
CENT = Decimal("0.01")
HUNDRED = Decimal("100")


def q(value) -> Decimal:
    """Round to cents (half up)."""
    if value is None:
        return ZERO
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def money(value) -> Optional[str]:
    """JSON form of an amount: a string with two decimals ("120.00"), never a float."""
    return None if value is None else f"{q(value):.2f}"


def money_map(values: Dict[str, Decimal]) -> Dict[str, str]:
    return {c: money(values[c]) for c in CURRENCIES if c in values}


@dataclass
class Line:
    usd: Optional[Decimal]
    lrd: Optional[Decimal]

    def amount(self, currency: str) -> Optional[Decimal]:
        return self.usd if currency == "USD" else self.lrd


@dataclass
class Adjustment:
    percent: Optional[Decimal]
    usd: Optional[Decimal]
    lrd: Optional[Decimal]

    def value(self, currency: str, charged: Decimal) -> Decimal:
        if self.percent is not None:
            return q(charged * Decimal(self.percent) / HUNDRED)
        amount = self.usd if currency == "USD" else self.lrd
        return q(amount) if amount is not None else ZERO


@dataclass
class Installment:
    sequence: int
    due_date: date
    percent: Decimal


@dataclass
class InvoiceCalc:
    """One issued invoice: its charges, adjustments, what was paid against it and its plan."""
    lines: List[Line]
    adjustments: List[Adjustment] = field(default_factory=list)
    paid: Decimal = ZERO  # in the account's currency
    plan: List[Installment] = field(default_factory=list)

    def currencies(self) -> List[str]:
        return [c for c in CURRENCIES if self.lines and all(l.amount(c) is not None for l in self.lines)]

    def charged(self, currency: str) -> Optional[Decimal]:
        amounts = [l.amount(currency) for l in self.lines]
        if not amounts or any(a is None for a in amounts):
            return None
        return q(sum(amounts, ZERO))

    def adjusted(self, currency: str) -> Decimal:
        charged = self.charged(currency)
        if charged is None:
            return ZERO
        return q(sum((a.value(currency, charged) for a in self.adjustments), ZERO))

    def owed(self, currency: str) -> Optional[Decimal]:
        charged = self.charged(currency)
        if charged is None:
            return None
        return max(ZERO, q(charged - self.adjusted(currency)))

    def paid_in(self, currency: str, locked: Optional[str]) -> Decimal:
        return q(self.paid) if locked == currency else ZERO

    def schedule(self, currency: str, locked: Optional[str], today: date) -> List[Dict]:
        """The installments with what each asks for, what covers it and whether it's overdue."""
        owed = self.owed(currency) or ZERO
        left = self.paid_in(currency, locked)
        out, cumulative_pct, previous_due = [], Decimal(0), ZERO
        for i, inst in enumerate(self.plan):
            cumulative_pct += Decimal(inst.percent)
            due_by = owed if i == len(self.plan) - 1 and cumulative_pct >= HUNDRED else q(owed * cumulative_pct / HUNDRED)
            amount = max(ZERO, due_by - previous_due)
            previous_due = due_by
            covered = min(amount, left)
            left -= covered
            remaining = amount - covered
            passed = inst.due_date < today
            # "due" (the next installment to pay) is set by the caller across all invoices
            status = "paid" if remaining == 0 else ("overdue" if passed else "upcoming")
            out.append({"sequence": inst.sequence, "due_date": inst.due_date, "percent": Decimal(inst.percent),
                        "amount": amount, "paid": covered, "remaining": remaining, "status": status,
                        "due_by": due_by, "passed": passed})
        return out

    def overdue(self, currency: str, locked: Optional[str], today: date) -> Decimal:
        owed = self.owed(currency)
        if owed is None:
            return ZERO
        due_by = ZERO
        cumulative_pct = Decimal(0)
        for i, inst in enumerate(self.plan):
            cumulative_pct += Decimal(inst.percent)
            if inst.due_date < today:
                due_by = owed if cumulative_pct >= HUNDRED else q(owed * cumulative_pct / HUNDRED)
        return max(ZERO, due_by - self.paid_in(currency, locked))


@dataclass
class AccountCalc:
    locked: Optional[str]
    invoices: List[InvoiceCalc]

    def currencies(self) -> List[str]:
        """Currencies the account's balance is shown in: the locked one, or (before the first
        payment) every currency all of its invoices are priced in."""
        if self.locked:
            return [self.locked]
        if not self.invoices:
            return []
        shared = set(CURRENCIES)
        for inv in self.invoices:
            shared &= set(inv.currencies())
        return [c for c in CURRENCIES if c in shared]

    def primary_currency(self) -> Optional[str]:
        """The currency an account counts in for school-wide totals: the locked one, else USD
        when the bills are priced in USD, else LRD."""
        cs = self.currencies()
        return cs[0] if cs else None

    def totals(self, today: date) -> Dict[str, Dict[str, Decimal]]:
        out = {"owed": {}, "paid": {}, "balance": {}, "overdue": {}}
        for c in self.currencies():
            owed = q(sum(((inv.owed(c) or ZERO) for inv in self.invoices), ZERO))
            paid = q(sum((inv.paid_in(c, self.locked) for inv in self.invoices), ZERO))
            out["owed"][c] = owed
            out["paid"][c] = paid
            out["balance"][c] = q(owed - paid)
            out["overdue"][c] = q(sum((inv.overdue(c, self.locked, today) for inv in self.invoices), ZERO))
        return out


def status_of(totals: Dict[str, Dict[str, Decimal]]) -> Dict[str, bool]:
    balances = totals["balance"].values()
    owing = any(b > 0 for b in balances)
    overdue = any(v > 0 for v in totals["overdue"].values())
    return {"owing": owing, "overdue": overdue, "paid": bool(totals["owed"]) and not owing}


def allocate(amount: Decimal, outstanding: Sequence[Tuple[object, Decimal]]) -> List[Tuple[object, Decimal]]:
    """Split a payment over invoices in the given order (oldest semester first)."""
    left = q(amount)
    out = []
    for key, due in outstanding:
        if left <= 0:
            break
        take = min(left, q(due))
        if take > 0:
            out.append((key, take))
            left -= take
    return out


def add_into(target: Dict[str, Decimal], values: Dict[str, Decimal]) -> None:
    for c, v in values.items():
        target[c] = q(target.get(c, ZERO) + v)


def sum_by_currency(rows: Iterable[Tuple[str, Decimal]]) -> Dict[str, Decimal]:
    out: Dict[str, Decimal] = {}
    for currency, amount in rows:
        out[currency] = q(out.get(currency, ZERO) + q(amount))
    return out
