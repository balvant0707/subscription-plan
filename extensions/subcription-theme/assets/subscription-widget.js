(function initSubscriptionWidgets() {
  const widgets = document.querySelectorAll("[data-subscription-widget]");
  widgets.forEach((widget) => {
    if (widget.dataset.initialized === "true") {
      return;
    }

    widget.dataset.initialized = "true";
    setupWidget(widget).catch(() => {
      setStatusMessage(widget, "Unable to load subscription options.");
    });
  });
})();

async function setupWidget(widget) {
  const productId = widget.dataset.productId || "";
  const apiPath = widget.dataset.apiPath || "/apps/subscription-plan/extensions/theme-widget";
  const endpoint = `${apiPath}?productId=${encodeURIComponent(productId)}`;

  const buyOnceLabelNode = widget.querySelector("[data-buy-once-label]");
  const subscribeLabelNode = widget.querySelector("[data-subscribe-label]");
  const frequencyWrapper = widget.querySelector("[data-frequency-wrapper]");
  const frequencySelect = widget.querySelector("[data-frequency-select]");
  const discountLabel = widget.querySelector("[data-discount-label]");
  const addToCartButton = widget.querySelector("[data-add-to-cart-button]");
  const optionInputs = widget.querySelectorAll("[data-purchase-option]");

  const response = await fetch(endpoint, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error("Unable to fetch widget configuration.");
  }

  const payload = await response.json();
  const widgetConfig = payload?.widget ?? {};
  const productConfig = payload?.productConfig ?? null;
  const enabled = Boolean(widgetConfig.enabled);

  if (!enabled) {
    widget.hidden = true;
    return;
  }

  const buyOnceLabel = String(widgetConfig.buyOnceLabel || "Buy once");
  const subscribeLabel = String(widgetConfig.subscribeLabel || "Subscribe & save");
  const addToCartLabel = String(widgetConfig.addToCartLabel || "Add to cart");
  const defaultOption = String(widgetConfig.defaultPurchaseOption || "BUY_ONCE");
  const defaultFrequency = String(widgetConfig.defaultFrequency || "MONTHLY");
  const discountType = String(productConfig?.discountType || "PERCENTAGE");
  const discountValue = Number(productConfig?.discountValue || 0);
  const frequencies = Array.isArray(productConfig?.frequencyOptions)
    ? productConfig.frequencyOptions
    : Array.isArray(widgetConfig.frequencyOptions)
      ? widgetConfig.frequencyOptions
      : ["MONTHLY"];

  if (buyOnceLabelNode) {
    buyOnceLabelNode.textContent = buyOnceLabel;
  }
  if (subscribeLabelNode) {
    subscribeLabelNode.textContent = subscribeLabel;
  }
  if (addToCartButton) {
    addToCartButton.textContent = addToCartLabel;
  }

  if (frequencySelect) {
    renderFrequencyOptions(frequencySelect, frequencies);
    frequencySelect.value = frequencies.includes(defaultFrequency)
      ? defaultFrequency
      : frequencies[0];
  }

  optionInputs.forEach((optionInput) => {
    optionInput.checked = optionInput.value === defaultOption;
    optionInput.addEventListener("change", () => {
      refreshVisibility();
    });
  });

  if (addToCartButton) {
    addToCartButton.addEventListener("click", async () => {
      clearStatusMessage(widget);
      addToCartButton.disabled = true;

      try {
        const productForm = findProductForm();
        const variantId = getVariantId(productForm);
        const quantity = getQuantity(productForm);
        const selectedOption = getSelectedPurchaseOption(optionInputs);
        const selectedFrequency = frequencySelect?.value || defaultFrequency;

        if (!variantId) {
          throw new Error("Variant id not found.");
        }

        const properties =
          selectedOption === "SUBSCRIBE"
            ? {
                _subscription_app: "true",
                subscription_frequency: selectedFrequency,
                subscription_discount: buildDiscountText(discountType, discountValue),
              }
            : undefined;

        const body = {
          items: [
            {
              id: Number(variantId),
              quantity,
              ...(properties ? { properties } : {}),
            },
          ],
        };

        const addResponse = await fetch("/cart/add.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!addResponse.ok) {
          throw new Error("Failed to add item to cart.");
        }

        window.location.href = "/cart";
      } catch (error) {
        setStatusMessage(widget, "Unable to add item. Please try again.");
      } finally {
        addToCartButton.disabled = false;
      }
    });
  }

  function refreshVisibility() {
    const selectedOption = getSelectedPurchaseOption(optionInputs);
    const subscribing = selectedOption === "SUBSCRIBE";

    if (frequencyWrapper) {
      frequencyWrapper.hidden = !subscribing;
    }

    if (discountLabel) {
      if (subscribing && discountValue > 0) {
        discountLabel.hidden = false;
        discountLabel.textContent = `${buildDiscountText(
          discountType,
          discountValue,
        )} off with subscription`;
      } else {
        discountLabel.hidden = true;
        discountLabel.textContent = "";
      }
    }
  }

  refreshVisibility();
}

function renderFrequencyOptions(selectNode, options) {
  selectNode.innerHTML = "";
  options.forEach((option) => {
    const normalized = String(option || "").toUpperCase();
    if (!normalized) {
      return;
    }

    const optionNode = document.createElement("option");
    optionNode.value = normalized;
    optionNode.textContent = prettyFrequencyLabel(normalized);
    selectNode.appendChild(optionNode);
  });
}

function prettyFrequencyLabel(value) {
  const labels = {
    WEEKLY: "Weekly",
    BIWEEKLY: "Bi-weekly",
    MONTHLY: "Monthly",
    QUARTERLY: "Quarterly",
  };

  return labels[value] || value;
}

function buildDiscountText(discountType, discountValue) {
  if (!discountValue || Number.isNaN(discountValue)) {
    return "No discount";
  }

  if (discountType === "FIXED") {
    return `$${discountValue.toFixed(2)}`;
  }

  return `${discountValue}%`;
}

function findProductForm() {
  return document.querySelector('form[action*="/cart/add"]');
}

function getVariantId(form) {
  if (!form) {
    return "";
  }

  const variantInput = form.querySelector('[name="id"]');
  return variantInput ? String(variantInput.value || "") : "";
}

function getQuantity(form) {
  if (!form) {
    return 1;
  }

  const quantityInput = form.querySelector('[name="quantity"]');
  const quantityValue = Number.parseInt(String(quantityInput?.value || "1"), 10);
  if (Number.isNaN(quantityValue) || quantityValue < 1) {
    return 1;
  }

  return quantityValue;
}

function getSelectedPurchaseOption(optionInputs) {
  const selected = Array.from(optionInputs).find((optionInput) => optionInput.checked);
  return selected ? selected.value : "BUY_ONCE";
}

function setStatusMessage(widget, message) {
  const messageNode = widget.querySelector("[data-status-message]");
  if (!messageNode) {
    return;
  }

  messageNode.hidden = false;
  messageNode.textContent = message;
}

function clearStatusMessage(widget) {
  const messageNode = widget.querySelector("[data-status-message]");
  if (!messageNode) {
    return;
  }

  messageNode.hidden = true;
  messageNode.textContent = "";
}
