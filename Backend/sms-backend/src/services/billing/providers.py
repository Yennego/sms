"""Online payment slot (phase7-design.md §1 "Payments"): the interface a payment provider implements.

No provider is live yet, so PROVIDERS is empty and POST /super-admin/billing/payments/webhook/{provider}
answers 404. To add one: implement PaymentProvider (checking the provider's signature in `verify`),
then register_provider() it at startup. A verified, completed payment is recorded like an operator's,
with method "online", the provider's name and its reference (unique, so a repeated notification is
recorded once).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Dict, Mapping, Optional
from uuid import UUID


@dataclass
class ProviderPayment:
    """A completed payment as the provider reports it."""
    invoice_id: UUID
    amount: Decimal
    currency: str
    provider_ref: str
    received_at: Optional[datetime] = None


class PaymentProvider(ABC):
    name: str

    @abstractmethod
    def checkout_url(self, invoice_id: UUID, amount: Decimal, currency: str) -> str:
        """Where a school admin is sent to pay the invoice online."""

    @abstractmethod
    def verify(self, headers: Mapping[str, str], body: bytes) -> bool:
        """Whether the notification really comes from the provider (its signature)."""

    @abstractmethod
    def parse(self, body: bytes) -> Optional[ProviderPayment]:
        """The completed payment the notification reports, or None for other notifications."""


PROVIDERS: Dict[str, PaymentProvider] = {}


def register_provider(provider: PaymentProvider) -> None:
    PROVIDERS[provider.name] = provider


def get_provider(name: str) -> Optional[PaymentProvider]:
    return PROVIDERS.get(name)
