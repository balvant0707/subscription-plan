import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useEffect, useMemo, useState} from "preact/hooks";

export default async () => {
  render(<Extension />, document.body)
};

function Extension() {
  const [offers, setOffers] = useState([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [selectedFrequency, setSelectedFrequency] = useState("MONTHLY");
  const [selectedOfferType, setSelectedOfferType] = useState("upgrade");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const appUrl = useMemo(
    () => normalizeAppUrl(shopify.settings.value?.app_url),
    [shopify.settings.value?.app_url],
  );

  const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) || null;

  useEffect(() => {
    if (!appUrl) {
      setLoading(false);
      setOffers([]);
      return;
    }

    loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUrl]);

  async function loadOffers() {
    setLoading(true);
    setError("");
    setStatus("");

    try {
      const token = await shopify.sessionToken.get();
      const response = await fetch(`${appUrl}/api/extensions/checkout-offer`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({ offers: [] }));
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to fetch offers.");
      }

      const nextOffers = Array.isArray(payload.offers) ? payload.offers : [];
      setOffers(nextOffers);

      if (nextOffers.length > 0) {
        setSelectedOfferId(nextOffers[0].id);
        setSelectedFrequency(nextOffers[0].defaultFrequency || "MONTHLY");
      }
    } catch (requestError) {
      setError("Unable to load checkout subscription offers.");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }

  async function acceptUpsell() {
    if (!selectedOffer || !appUrl) {
      return;
    }

    setSaving(true);
    setError("");
    setStatus("");

    try {
      const token = await shopify.sessionToken.get();
      const customer = shopify.buyerIdentity?.customer?.value;
      const customerEmail = shopify.buyerIdentity?.email?.value || "";
      const customerName = customer?.fullName || customer?.firstName || "Checkout Customer";

      const response = await fetch(`${appUrl}/api/extensions/checkout-offer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "accept_upsell",
          subscriptionProductId: selectedOffer.id,
          offerType: selectedOfferType,
          frequency: selectedFrequency,
          customerId: customer?.id,
          customerName,
          customerEmail,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Unable to apply subscription offer.");
      }

      setStatus("Subscription offer applied.");
    } catch (requestError) {
      setError("Unable to apply subscription offer.");
    } finally {
      setSaving(false);
    }
  }

  if (!appUrl) {
    return (
      <s-banner heading="Subscription checkout" tone="warning">
        Set the extension setting "App URL" to your app domain to enable checkout upsells.
      </s-banner>
    );
  }

  if (loading) {
    return (
      <s-stack gap="small">
        <s-spinner />
        <s-text>Loading subscription offers...</s-text>
      </s-stack>
    );
  }

  if (offers.length === 0 && !error) {
    return (
      <s-banner heading="Subscription checkout">
        <s-text>No upsell offers are available for this checkout.</s-text>
      </s-banner>
    );
  }

  return (
    <s-banner heading="Subscription checkout">
      <s-stack gap="base">
        {error ? <s-text>{error}</s-text> : null}
        {status ? <s-text>{status}</s-text> : null}

        <s-select
          label="Offer product"
          value={selectedOfferId}
          onChange={(event) => {
            const nextOfferId = readEventValue(event);
            const nextOffer = offers.find((offer) => offer.id === nextOfferId);
            setSelectedOfferId(nextOfferId);
            setSelectedFrequency(nextOffer?.defaultFrequency || "MONTHLY");
          }}
        >
          {offers.map((offer) => (
            <s-option key={offer.id} value={offer.id}>
              {offer.productTitle} ({offer.discountText} off)
            </s-option>
          ))}
        </s-select>

        <s-select
          label="Frequency"
          value={selectedFrequency}
          onChange={(event) => setSelectedFrequency(readEventValue(event))}
        >
          {(selectedOffer?.frequencyOptions || ["MONTHLY"]).map((frequencyValue) => (
            <s-option key={frequencyValue} value={frequencyValue}>
              {prettyFrequencyLabel(frequencyValue)}
            </s-option>
          ))}
        </s-select>

        <s-select
          label="Offer type"
          value={selectedOfferType}
          onChange={(event) => setSelectedOfferType(readEventValue(event))}
        >
          <s-option value="upgrade">Upgrade to subscription</s-option>
          <s-option value="bundle">Bundle subscription</s-option>
          <s-option value="discount">Discount offer</s-option>
        </s-select>

        <s-button disabled={saving || !selectedOffer} onClick={acceptUpsell}>
          {saving ? "Applying..." : "Apply subscription offer"}
        </s-button>
      </s-stack>
    </s-banner>
  );
}

function normalizeAppUrl(value) {
  const appUrl = String(value || "").trim();
  return appUrl.replace(/\/$/, "");
}

function readEventValue(event) {
  return String(event?.target?.value ?? event?.currentTarget?.value ?? "");
}

function prettyFrequencyLabel(frequencyValue) {
  const labels = {
    WEEKLY: "Weekly",
    BIWEEKLY: "Bi-weekly",
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
  };

  return labels[frequencyValue] || frequencyValue;
}
