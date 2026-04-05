import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useEffect, useMemo, useState} from "preact/hooks";

export default async () => {
  render(<Extension />, document.body)
}

function Extension() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [addressDrafts, setAddressDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const appUrl = useMemo(
    () => normalizeAppUrl(shopify.settings.value?.app_url),
    [shopify.settings.value?.app_url],
  );
  const customerId = String(shopify.buyerIdentity?.customer?.value?.id || "");
  const customerEmail = String(shopify.buyerIdentity?.email?.value || "").toLowerCase();

  useEffect(() => {
    if (!appUrl) {
      setLoading(false);
      setSubscriptions([]);
      return;
    }

    loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUrl, customerId, customerEmail]);

  async function loadSubscriptions() {
    setLoading(true);
    setError("");

    try {
      const token = await shopify.sessionToken.get();
      const params = new URLSearchParams();

      if (customerId) {
        params.set("customerId", customerId);
      }
      if (customerEmail) {
        params.set("customerEmail", customerEmail);
      }

      const response = await fetch(
        `${appUrl}/api/extensions/customer-subscriptions?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await response.json().catch(() => ({ subscriptions: [] }));
      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load subscriptions.");
      }

      const nextSubscriptions = Array.isArray(payload.subscriptions)
        ? payload.subscriptions
        : [];

      setSubscriptions(nextSubscriptions);
      setAddressDrafts(buildAddressDrafts(nextSubscriptions));
    } catch (requestError) {
      setError("Unable to load subscription portal.");
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateSubscription(subscriptionId, intent, extraPayload = {}) {
    if (!appUrl) {
      return;
    }

    setBusyKey(`${subscriptionId}:${intent}`);
    setError("");

    try {
      const token = await shopify.sessionToken.get();
      const response = await fetch(`${appUrl}/api/extensions/customer-subscriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId,
          intent,
          customerId,
          customerEmail,
          ...extraPayload,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Subscription update failed.");
      }

      const updatedSubscription = payload.subscription;
      if (!updatedSubscription) {
        return;
      }

      setSubscriptions((currentSubscriptions) =>
        currentSubscriptions.map((subscription) =>
          subscription.id === updatedSubscription.id ? updatedSubscription : subscription,
        ),
      );
      setAddressDrafts((currentDrafts) => ({
        ...currentDrafts,
        [updatedSubscription.id]: {
          line1: updatedSubscription.shippingAddressLine1 || "",
          line2: updatedSubscription.shippingAddressLine2 || "",
          city: updatedSubscription.shippingCity || "",
          province: updatedSubscription.shippingProvince || "",
          country: updatedSubscription.shippingCountry || "",
          zip: updatedSubscription.shippingZip || "",
        },
      }));
    } catch (requestError) {
      setError("Unable to update subscription.");
    } finally {
      setBusyKey("");
    }
  }

  function updateAddressField(subscriptionId, field, value) {
    setAddressDrafts((currentDrafts) => ({
      ...currentDrafts,
      [subscriptionId]: {
        ...(currentDrafts[subscriptionId] || emptyAddress()),
        [field]: value,
      },
    }));
  }

  if (!appUrl) {
    return (
      <s-banner heading="Subscription portal" tone="warning">
        Set the extension setting "App URL" to your app domain to enable customer actions.
      </s-banner>
    );
  }

  if (loading) {
    return (
      <s-stack gap="small">
        <s-spinner />
        <s-text>Loading subscriptions...</s-text>
      </s-stack>
    );
  }

  if (subscriptions.length === 0 && !error) {
    return (
      <s-banner heading="Subscription portal">
        <s-text>No subscriptions found for this customer account.</s-text>
      </s-banner>
    );
  }

  return (
    <s-stack gap="base">
      {error ? (
        <s-banner heading="Subscription portal" tone="critical">
          <s-text>{error}</s-text>
        </s-banner>
      ) : null}

      {subscriptions.map((subscription) => {
        const addressDraft = addressDrafts[subscription.id] || emptyAddress();
        const isPaused = subscription.status === "PAUSED";
        const isCanceled = subscription.status === "CANCELED";

        return (
          <s-stack key={subscription.id} gap="small">
            <s-text type="emphasis">{subscription.productTitle}</s-text>
            <s-text>Next order: {formatDate(subscription.nextOrderDate)}</s-text>
            <s-text>Status: {subscription.status}</s-text>

            <s-select
              label="Frequency"
              value={subscription.interval}
              onChange={(event) =>
                updateSubscription(subscription.id, "frequency", {
                  frequency: readEventValue(event),
                })}
            >
              {FREQUENCY_OPTIONS.map((frequencyOption) => (
                <s-option key={frequencyOption.value} value={frequencyOption.value}>
                  {frequencyOption.label}
                </s-option>
              ))}
            </s-select>

            <s-text-field
              label="Address line 1"
              value={addressDraft.line1}
              onChange={(event) =>
                updateAddressField(subscription.id, "line1", readEventValue(event))}
            />
            <s-text-field
              label="City"
              value={addressDraft.city}
              onChange={(event) =>
                updateAddressField(subscription.id, "city", readEventValue(event))}
            />
            <s-text-field
              label="ZIP"
              value={addressDraft.zip}
              onChange={(event) =>
                updateAddressField(subscription.id, "zip", readEventValue(event))}
            />
            <s-button
              disabled={busyKey.length > 0}
              onClick={() =>
                updateSubscription(subscription.id, "address", {
                  address: addressDraft,
                })}
            >
              Save address
            </s-button>

            <s-button
              disabled={busyKey.length > 0 || isCanceled}
              onClick={() =>
                updateSubscription(subscription.id, isPaused ? "resume" : "pause")}
            >
              {isPaused ? "Resume" : "Pause subscription"}
            </s-button>
            <s-button
              disabled={busyKey.length > 0 || isCanceled}
              onClick={() => updateSubscription(subscription.id, "skip")}
            >
              Skip order
            </s-button>
            <s-button
              disabled={busyKey.length > 0 || isCanceled}
              onClick={() => updateSubscription(subscription.id, "cancel")}
            >
              Cancel subscription
            </s-button>
            <s-divider />
          </s-stack>
        );
      })}
    </s-stack>
  );
}

const FREQUENCY_OPTIONS = [
  { label: "Weekly", value: "WEEKLY" },
  { label: "Bi-weekly", value: "BIWEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Quarterly", value: "QUARTERLY" },
];

function normalizeAppUrl(value) {
  const appUrl = String(value || "").trim();
  return appUrl.replace(/\/$/, "");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function emptyAddress() {
  return {
    line1: "",
    line2: "",
    city: "",
    province: "",
    country: "",
    zip: "",
  };
}

function buildAddressDrafts(subscriptions) {
  return subscriptions.reduce((drafts, subscription) => {
    drafts[subscription.id] = {
      line1: subscription.shippingAddressLine1 || "",
      line2: subscription.shippingAddressLine2 || "",
      city: subscription.shippingCity || "",
      province: subscription.shippingProvince || "",
      country: subscription.shippingCountry || "",
      zip: subscription.shippingZip || "",
    };
    return drafts;
  }, {});
}

function readEventValue(event) {
  return String(event?.target?.value ?? event?.currentTarget?.value ?? "");
}
