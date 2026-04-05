export const FREQUENCY_OPTIONS = [
  { label: "Weekly", value: "WEEKLY" },
  { label: "Bi-weekly", value: "BIWEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
  { label: "Quarterly", value: "QUARTERLY" },
];

export const BILLING_TYPE_OPTIONS = [
  { label: "Pay as you go", value: "PAY_AS_YOU_GO" },
  { label: "Prepaid", value: "PREPAID" },
];

export const DATE_RANGE_OPTIONS = [
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
  { label: "Last 180 days", value: "180" },
];

export const PRICING_PLANS = [
  {
    value: "STARTER",
    name: "Starter Plan",
    price: 19,
    features: [
      "Up to 100 active subscribers",
      "Basic analytics dashboard",
      "Email support",
    ],
  },
  {
    value: "GROWTH",
    name: "Growth Plan",
    price: 49,
    features: [
      "Up to 1,000 active subscribers",
      "Advanced analytics and churn metrics",
      "Priority support",
    ],
  },
  {
    value: "PRO",
    name: "Pro Plan",
    price: 99,
    features: [
      "Unlimited subscribers",
      "Automation and retry workflows",
      "Dedicated success support",
    ],
  },
];

export const DEFAULT_EMAIL_TEMPLATE =
  "Hi {{customer_name}}, your subscription payment failed. Please update your payment method.";

