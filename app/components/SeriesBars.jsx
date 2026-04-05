import { BlockStack, Box, InlineStack, Text } from "@shopify/polaris";

export function SeriesBars({ data, formatValue }) {
  const maxValue = Math.max(1, ...data.map((item) => Number(item.value) || 0));

  return (
    <InlineStack align="space-between" gap="200" wrap={false}>
      {data.map((point) => {
        const height = Math.max(6, Math.round((point.value / maxValue) * 120));
        return (
          <BlockStack key={point.label} inlineAlign="center" gap="100">
            <Box minHeight="150px">
              <div
                style={{
                  height: "120px",
                  width: "28px",
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: `${height}px`,
                    borderRadius: "8px 8px 4px 4px",
                    background:
                      "linear-gradient(180deg, var(--p-color-bg-fill-brand), var(--p-color-bg-fill-brand-hover))",
                  }}
                />
              </div>
            </Box>
            <Text as="p" variant="bodySm" alignment="center">
              {point.label}
            </Text>
            <Text as="p" variant="bodySm" alignment="center">
              {formatValue(point.value)}
            </Text>
          </BlockStack>
        );
      })}
    </InlineStack>
  );
}

